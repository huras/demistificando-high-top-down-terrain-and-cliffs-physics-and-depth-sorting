/**
 * Estado dos arcos elétricos: quais arestas estão vivas (duas pedras presentes).
 */
import { getWorldLetterPuzzlePlan } from "./plano.js";
import { layoutDoSlot } from "./colocacao.js";
import { letraResolvida } from "./estado.js";
import { arestasArcoLetra, centrosArcoLetra } from "./arcosTopo.js";
import { todaVegetacao } from "../mundo/bioma/propsBioma.js";

/** @type {Map<string, number>} puzzleId:i-j → bornMs */
const edgeBornMs = new Map();
/** @type {Set<string>} */
const activeEdgeKeys = new Set();

function cellKey(x, y) {
  return `${x},${y}`;
}

function edgeKey(puzzleId, i, j) {
  const a = i < j ? i : j;
  const b = i < j ? j : i;
  return `${puzzleId}:${a}-${b}`;
}

function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/**
 * @param {string} puzzleId
 * @param {Set<string>} out
 * @param {Map<string, { x: number, y: number, z: number }>} centersOut
 */
function preencherOcupadas(puzzleId, out, centersOut) {
  out.clear();
  centersOut.clear();
  const lista = todaVegetacao();
  for (let i = 0; i < lista.length; i++) {
    const p = lista[i];
    if (p.letterPuzzleId !== puzzleId) continue;
    if (p.letterPuzzleLoose || p.oculto || p.forcaCarregado) continue;
    const cx = p.letterCellX;
    const cy = p.letterCellY;
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
    out.add(cellKey(cx, cy));
    centersOut.set(cellKey(cx, cy), {
      x: p.x,
      y: p.y,
      z: (p.z ?? 0) + 0.55,
    });
  }
}

/**
 * Arestas ativas perto do jogador (pra render 3D).
 * @param {{ x: number, y: number }} foco
 * @param {number} [raio]
 * @returns {{
 *   id: string,
 *   letter: string,
 *   sx: number, sy: number, sz: number,
 *   ex: number, ey: number, ez: number,
 *   grow: number,
 *   seed: number,
 * }[]}
 */
export function arcosLetrasAtivos(foco, raio = 48) {
  const slots = getWorldLetterPuzzlePlan().slots;
  if (!slots.length) return [];
  const now = performance.now();
  const connectMs = 480;
  const r2 = raio * raio;
  /** @type {ReturnType<typeof arcosLetrasAtivos>} */
  const out = [];
  /** @type {Set<string>} */
  const occupied = new Set();
  /** @type {Map<string, { x: number, y: number, z: number }>} */
  const live = new Map();

  activeEdgeKeys.clear();

  for (let s = 0; s < slots.length; s++) {
    const slot = slots[s];
    if (!slot || letraResolvida(slot.id)) continue;
    const dx = slot.x - foco.x;
    const dy = slot.y - foco.y;
    if (dx * dx + dy * dy > r2) continue;

    const layout = layoutDoSlot(slot);
    const cells = layout?.grid?.cells;
    if (!cells?.length) continue;
    const edges = arestasArcoLetra(cells);
    if (!edges.length) continue;
    const centers = centrosArcoLetra(layout.originX, layout.originY, cells);

    preencherOcupadas(slot.id, occupied, live);
    if (occupied.size < 2) continue;

    const edgeCount = edges.length >>> 1;
    for (let e = 0; e < edgeCount; e++) {
      const i = edges[e * 2];
      const j = edges[e * 2 + 1];
      const a = cells[i];
      const b = cells[j];
      const keyA = cellKey(a.x, a.y);
      const keyB = cellKey(b.x, b.y);
      if (!occupied.has(keyA) || !occupied.has(keyB)) continue;

      const ek = edgeKey(slot.id, i, j);
      activeEdgeKeys.add(ek);
      let born = edgeBornMs.get(ek);
      if (born == null) {
        born = now;
        edgeBornMs.set(ek, born);
      }
      const grow = smoothstep(Math.min(1, (now - born) / connectMs));
      if (grow < 0.02) continue;

      const liveA = live.get(keyA);
      const liveB = live.get(keyB);
      const sx0 = liveA?.x ?? centers.xs[i];
      const sy0 = liveA?.y ?? centers.ys[i];
      const sz0 = liveA?.z ?? (slot.z || 0) + 0.55;
      const ex0 = liveB?.x ?? centers.xs[j];
      const ey0 = liveB?.y ?? centers.ys[j];
      const ez0 = liveB?.z ?? (slot.z || 0) + 0.55;

      const mx = (sx0 + ex0) * 0.5;
      const my = (sy0 + ey0) * 0.5;
      const mz = (sz0 + ez0) * 0.5;
      out.push({
        id: ek,
        letter: slot.letter,
        sx: mx + (sx0 - mx) * grow,
        sy: my + (sy0 - my) * grow,
        sz: mz + (sz0 - mz) * grow,
        ex: mx + (ex0 - mx) * grow,
        ey: my + (ey0 - my) * grow,
        ez: mz + (ez0 - mz) * grow,
        grow,
        seed: (hashId(slot.id) + e * 9973) | 0,
      });
    }
  }

  for (const key of edgeBornMs.keys()) {
    if (!activeEdgeKeys.has(key)) edgeBornMs.delete(key);
  }
  return out;
}

function hashId(id) {
  const s = String(id || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
