/**
 * Injeta pedras fixas + soltas do glifo nos chunks (padrão santuário).
 */
import { CHUNK_XZ, RAIO_BASE_PEDRA } from "../config.js";
import { alturaDoRelevo } from "../mundo/bioma/catalogo.js";
import {
  LETRA_BURACOS,
  LETRA_SOLTAS_MAX,
  LETRA_SOLTAS_MIN,
  LETRA_SPRITE,
  gradeDaLetra,
} from "./catalogo.js";
import {
  buracoPreenchido,
  letraResolvida,
} from "./estado.js";
import { letrasNoChunk } from "./plano.js";

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

function pickHoleIndices(nCells, seed, count) {
  const n = Math.min(count | 0, nCells);
  const order = [];
  for (let i = 0; i < nCells; i++) order.push(i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = hash2(seed, i * 4099) % (i + 1);
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return order.slice(0, n);
}

function minCheb(lx, ly, cells) {
  let best = Infinity;
  for (let i = 0; i < cells.length; i++) {
    const d = Math.max(Math.abs(lx - cells[i].x), Math.abs(ly - cells[i].y));
    if (d < best) best = d;
  }
  return best;
}

/**
 * Layout completo de um slot (buracos + pedras).
 * @param {object} slot
 */
export function layoutDoSlot(slot) {
  if (!slot) return null;
  if (slot._layout) return slot._layout;
  const grid = gradeDaLetra(slot.letter);
  if (!grid?.cells?.length) return null;
  const originX = Math.floor(slot.x);
  const originY = Math.floor(slot.y);
  const cells = grid.cells;
  const holeIdx = pickHoleIndices(cells.length, hash2(originX, originY), LETRA_BURACOS);
  const holeSet = new Set(holeIdx);
  /** @type {{ cellX: number, cellY: number, x: number, y: number }[]} */
  const holes = [];
  /** @type {{ cellX: number, cellY: number, x: number, y: number }[]} */
  const fixed = [];
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const x = originX + c.x + 0.5;
    const y = originY + c.y + 0.5;
    const entry = { cellX: c.x, cellY: c.y, x, y };
    if (holeSet.has(i)) holes.push(entry);
    else fixed.push(entry);
  }

  /** @type {{ x: number, y: number }[]} */
  const loose = [];
  const letterKeys = new Set(cells.map((c) => `${c.x},${c.y}`));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  const cand = [];
  for (let ly = minY - LETRA_SOLTAS_MAX; ly <= maxY + LETRA_SOLTAS_MAX; ly++) {
    for (let lx = minX - LETRA_SOLTAS_MAX; lx <= maxX + LETRA_SOLTAS_MAX; lx++) {
      if (letterKeys.has(`${lx},${ly}`)) continue;
      const cheb = minCheb(lx, ly, cells);
      if (cheb < LETRA_SOLTAS_MIN || cheb > LETRA_SOLTAS_MAX) continue;
      cand.push({ lx, ly, score: hash2(originX + lx * 17, originY + ly * 31) });
    }
  }
  cand.sort((a, b) => a.score - b.score);
  const need = Math.min(LETRA_BURACOS + 1, cand.length);
  for (let i = 0; i < need; i++) {
    loose.push({
      x: originX + cand[i].lx + 0.5,
      y: originY + cand[i].ly + 0.5,
    });
  }

  slot._layout = { holes, fixed, loose, originX, originY, grid };
  return slot._layout;
}

function propBase(id, x, y, extra) {
  const z = alturaDoRelevo(x, y);
  return {
    id,
    x,
    y,
    z,
    r: RAIO_BASE_PEDRA,
    tipo: "pedra",
    sprite: LETRA_SPRITE,
    porte: 0,
    letterPuzzle: true,
    ...extra,
  };
}

/**
 * Props do puzzle que caem neste chunk.
 * @returns {object[]}
 */
export function propsLetrasChunk(cx, cy) {
  const slots = letrasNoChunk(cx, cy);
  if (!slots.length) return [];
  const baseX = cx * CHUNK_XZ;
  const baseY = cy * CHUNK_XZ;
  const out = [];

  for (let s = 0; s < slots.length; s++) {
    const slot = slots[s];
    const layout = layoutDoSlot(slot);
    if (!layout) continue;
    const solved = letraResolvida(slot.id);
    const holesShared = layout.holes.map((h) => ({
      x: h.x,
      y: h.y,
      cellX: h.cellX,
      cellY: h.cellY,
    }));

    // Pedras da silhueta (fixas) — não levantáveis.
    for (let i = 0; i < layout.fixed.length; i++) {
      const c = layout.fixed[i];
      if (c.x < baseX || c.y < baseY || c.x >= baseX + CHUNK_XZ || c.y >= baseY + CHUNK_XZ) {
        continue;
      }
      out.push(
        propBase(`letra:${slot.id}:fix:${i}`, c.x, c.y, {
          letterPuzzleId: slot.id,
          letterPuzzleLoose: false,
          letter: slot.letter,
          letterCellX: c.cellX,
          letterCellY: c.cellY,
          letterPuzzleHoles: holesShared,
        }),
      );
    }

    // Buracos já preenchidos (persistidos) ou puzzle resolvido: pedra sentada.
    for (let i = 0; i < layout.holes.length; i++) {
      const h = layout.holes[i];
      if (h.x < baseX || h.y < baseY || h.x >= baseX + CHUNK_XZ || h.y >= baseY + CHUNK_XZ) {
        continue;
      }
      const filled = solved || buracoPreenchido(slot.id, h.cellX, h.cellY);
      if (!filled) continue;
      out.push(
        propBase(`letra:${slot.id}:seat:${i}`, h.x, h.y, {
          letterPuzzleId: slot.id,
          letterPuzzleLoose: false,
          letter: slot.letter,
          letterCellX: h.cellX,
          letterCellY: h.cellY,
          letterHoleX: h.x,
          letterHoleY: h.y,
          letterPuzzleHoles: holesShared,
        }),
      );
    }

    // Pedras soltas (só se não resolvido).
    if (!solved) {
      for (let i = 0; i < layout.loose.length; i++) {
        const p = layout.loose[i];
        if (p.x < baseX || p.y < baseY || p.x >= baseX + CHUNK_XZ || p.y >= baseY + CHUNK_XZ) {
          continue;
        }
        out.push(
          propBase(`letra:${slot.id}:loose:${i}`, p.x, p.y, {
            letterPuzzleId: slot.id,
            letterPuzzleLoose: true,
            letter: slot.letter,
            letterPuzzleHoles: holesShared,
          }),
        );
      }
    }
  }
  return out;
}

/** Células a limpar de vegetação genérica sob o glifo. */
export function celulasLetrasChunk(cx, cy) {
  const slots = letrasNoChunk(cx, cy);
  if (!slots.length) return null;
  const set = new Set();
  const baseX = cx * CHUNK_XZ;
  const baseY = cy * CHUNK_XZ;
  for (let s = 0; s < slots.length; s++) {
    const layout = layoutDoSlot(slots[s]);
    if (!layout) continue;
    const all = layout.fixed.concat(layout.holes).concat(
      layout.loose.map((p) => ({ x: p.x, y: p.y })),
    );
    for (let i = 0; i < all.length; i++) {
      const fx = Math.floor(all[i].x);
      const fy = Math.floor(all[i].y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const wx = fx + dx;
          const wy = fy + dy;
          if (wx < baseX || wy < baseY || wx >= baseX + CHUNK_XZ || wy >= baseY + CHUNK_XZ) {
            continue;
          }
          set.add(`${wx},${wy}`);
        }
      }
    }
  }
  return set.size ? set : null;
}
