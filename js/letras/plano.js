/**
 * 1 puzzle por letra A–Z espalhado no overworld (farthest-point, longe de cidade/santuário).
 * Cada sítio é planificado: âncora plana + carimbo de altura (núcleo + avental).
 */
import { SEED_MUNDO, CHUNK_XZ } from "../config.js";
import { LADO_MUNDO, dentroDoKanto } from "../mundo/bounds.js";
import { AREA_KANTO, ehCidade, zonaNoMundo } from "../mundo/regiao/grafoKanto.js";
import { alturaDoRelevoNatural, nivelMarBlocos } from "../mundo/bioma/catalogo.js";
import { getWorldShrinePlan } from "../santuario/colocacao.js";
import {
  LETTER_ORDER,
  LETRA_AVENTAL,
  LETRA_DESNIVEL_MAX,
  LETRA_PAD_SOLTAS,
  gradeDaLetra,
  letraPuzzleId,
  letraQuota,
} from "./catalogo.js";
import { carimbarPlanoLetra, limparRelevoLetras } from "./relevo.js";

const AREA = AREA_KANTO;
const LADO_AREAS = (LADO_MUNDO / AREA) | 0;

/** @type {{ slots: object[], byChunk: Map<string, object[]>, byArea: Map<string, object[]> } | null} */
let worldPlan = null;
let versaoPlano = 0;

export function versaoPlanoLetras() {
  return versaoPlano;
}

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

function hashStr(value) {
  const s = String(value ?? "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffleDet(list, seed) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = hash2(seed, i * 7919) % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function manhattan(a, b) {
  return Math.abs(a.ax - b.ax) + Math.abs(a.ay - b.ay);
}

function areaKey(ax, ay) {
  return `${ax},${ay}`;
}

function chunkKey(cx, cy) {
  return `${cx | 0},${cy | 0}`;
}

function zonaElegivel(ax, ay) {
  const wx = ax * AREA + AREA * 0.5;
  const wy = ay * AREA + AREA * 0.5;
  if (ehCidade(wx, wy)) return false;
  if (dentroDoKanto(wx, wy)) {
    const z = zonaNoMundo(wx, wy);
    if (!z) return false;
    if (z.tipo === "cidade") return false;
    if (z.agua && !z.tipo) return false;
    if (z.generation?.ocean || z.generation?.water) return false;
  }
  const h = alturaDoRelevoNatural(wx, wy);
  if (h <= nivelMarBlocos()) return false;
  return true;
}

function pickSpreadCells(candidates, count) {
  const n = Math.max(0, Math.min(count | 0, candidates.length));
  if (!n) return [];
  const picked = [];
  let first = candidates[0];
  let bestH = hash2(first.ax ^ 0x4c5452, first.ay ^ 0x414c50);
  for (const c of candidates) {
    const h = hash2(c.ax ^ 0x4c5452, c.ay ^ 0x414c50);
    if (h < bestH) {
      bestH = h;
      first = c;
    }
  }
  picked.push(first);
  while (picked.length < n) {
    let best = null;
    let bestScore = -1;
    for (const c of candidates) {
      if (picked.some((p) => p.ax === c.ax && p.ay === c.ay)) continue;
      const score = Math.min(...picked.map((p) => manhattan(c, p)));
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (!best) break;
    picked.push(best);
  }
  return picked;
}

/**
 * Amostra o retângulo do sítio (glifo + pad das soltas).
 * @returns {{ ok: boolean, minH: number, maxH: number } | null}
 */
function amostrarSitio(x0, y0, x1, y1) {
  const mar = nivelMarBlocos();
  let minH = Infinity;
  let maxH = -Infinity;
  let n = 0;
  // Subamostra 2 em 2 pra custo; bordas sempre entram.
  for (let ty = y0; ty < y1; ty++) {
    for (let tx = x0; tx < x1; tx++) {
      const borda = tx === x0 || ty === y0 || tx === x1 - 1 || ty === y1 - 1;
      if (!borda && ((tx + ty) & 1) === 1) continue;
      if (ehCidade(tx + 0.5, ty + 0.5)) return null;
      const h = alturaDoRelevoNatural(tx + 0.5, ty + 0.5) | 0;
      if (h <= mar) return null;
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
      n++;
    }
  }
  if (!n || !Number.isFinite(minH)) return null;
  return { ok: maxH - minH <= LETRA_DESNIVEL_MAX, minH, maxH };
}

/**
 * Procura âncora plana o bastante pro glifo + pad das soltas.
 * @returns {{ ox: number, oy: number, z: number, x0: number, y0: number, x1: number, y1: number } | null}
 */
function tentarAncora(ax, ay, salt, gridW, gridH) {
  const baseX = ax * AREA;
  const baseY = ay * AREA;
  const pad = LETRA_PAD_SOLTAS;
  const siteW = gridW + pad * 2;
  const siteH = gridH + pad * 2;
  const margem = Math.max(pad + 2, 8);
  const spanX = Math.max(1, AREA - siteW - margem * 2);
  const spanY = Math.max(1, AREA - siteH - margem * 2);

  for (let t = 0; t < 64; t++) {
    const hx = hash2(baseX + t * 17 + salt, baseY + t * 31 + SEED_MUNDO);
    const hy = hash2(baseY + t * 41 + salt, baseX + t * 13 + SEED_MUNDO);
    const siteX0 = baseX + margem + (hx % spanX);
    const siteY0 = baseY + margem + (hy % spanY);
    const siteX1 = siteX0 + siteW;
    const siteY1 = siteY0 + siteH;
    const amostra = amostrarSitio(siteX0, siteY0, siteX1, siteY1);
    if (!amostra?.ok) continue;
    // Glifo no miolo do sítio (pad ao redor pras soltas).
    const ox = siteX0 + pad + 0.5;
    const oy = siteY0 + pad + 0.5;
    return {
      ox,
      oy,
      z: amostra.minH,
      x0: siteX0,
      y0: siteY0,
      x1: siteX1,
      y1: siteY1,
    };
  }
  return null;
}

/**
 * @returns {{ slots: object[], byChunk: Map<string, object[]>, byArea: Map<string, object[]> }}
 */
export function getWorldLetterPuzzlePlan() {
  if (worldPlan) return worldPlan;

  limparRelevoLetras();
  versaoPlano = (versaoPlano + 1) | 0;

  const candidates = [];
  const shrineAreas = new Set();
  try {
    const shrines = getWorldShrinePlan();
    for (let i = 0; i < (shrines.slots?.length || 0); i++) {
      const s = shrines.slots[i];
      if (s) shrineAreas.add(areaKey(s.ax, s.ay));
    }
  } catch {
    /* plano de santuário pode ainda não existir */
  }

  for (let ay = 0; ay < LADO_AREAS; ay++) {
    for (let ax = 0; ax < LADO_AREAS; ax++) {
      if (shrineAreas.has(areaKey(ax, ay))) continue;
      if (zonaElegivel(ax, ay)) candidates.push({ ax, ay });
    }
  }

  const quota = letraQuota();
  const locations = pickSpreadCells(candidates, quota);
  const letters = shuffleDet(LETTER_ORDER.slice(), hashStr(`letras:${SEED_MUNDO}:${quota}`));

  /** @type {object[]} */
  const slots = [];
  /** @type {Map<string, object[]>} */
  const byChunk = new Map();
  /** @type {Map<string, object[]>} */
  const byArea = new Map();

  const usados = new Set();
  const filaLoc = locations.slice();
  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i];
    const grid = gradeDaLetra(letter);
    if (!grid) continue;

    let ancora = null;
    let loc = null;
    // Tenta as localizações spread; se o sítio não achata, passa pra próxima área livre.
    for (let k = 0; k < filaLoc.length && !ancora; k++) {
      const cand = filaLoc[k];
      const uk = areaKey(cand.ax, cand.ay);
      if (usados.has(uk)) continue;
      ancora = tentarAncora(cand.ax, cand.ay, i * 97 + k * 13, grid.w, grid.h);
      if (ancora) {
        loc = cand;
        usados.add(uk);
      }
    }
    // Fallback: varre candidatos restantes (menos spread, mas garante A–Z).
    if (!ancora) {
      for (let k = 0; k < candidates.length && !ancora; k++) {
        const cand = candidates[k];
        const uk = areaKey(cand.ax, cand.ay);
        if (usados.has(uk) || shrineAreas.has(uk)) continue;
        ancora = tentarAncora(cand.ax, cand.ay, i * 911 + k * 17, grid.w, grid.h);
        if (ancora) {
          loc = cand;
          usados.add(uk);
        }
      }
    }
    if (!ancora || !loc) continue;
    const id = letraPuzzleId(letter);
    const glyphX0 = Math.floor(ancora.ox);
    const glyphY0 = Math.floor(ancora.oy);
    const glyphX1 = glyphX0 + grid.w;
    const glyphY1 = glyphY0 + grid.h;

    // Núcleo = sítio inteiro (glifo + pad); avental = degraus suaves.
    carimbarPlanoLetra(
      ancora.x0,
      ancora.y0,
      ancora.x1,
      ancora.y1,
      ancora.z,
      LETRA_AVENTAL,
    );

    const slot = {
      id,
      ax: loc.ax,
      ay: loc.ay,
      letter,
      x: ancora.ox,
      y: ancora.oy,
      z: ancora.z,
      w: grid.w,
      h: grid.h,
      siteX0: ancora.x0,
      siteY0: ancora.y0,
      siteX1: ancora.x1,
      siteY1: ancora.y1,
      glyphX0,
      glyphY0,
      glyphX1,
      glyphY1,
    };
    slots.push(slot);

    const ak = areaKey(loc.ax, loc.ay);
    let areaSlots = byArea.get(ak);
    if (!areaSlots) {
      areaSlots = [];
      byArea.set(ak, areaSlots);
    }
    areaSlots.push(slot);

    const cx0 = Math.floor((ancora.x0 - LETRA_AVENTAL) / CHUNK_XZ);
    const cy0 = Math.floor((ancora.y0 - LETRA_AVENTAL) / CHUNK_XZ);
    const cx1 = Math.floor((ancora.x1 - 1 + LETRA_AVENTAL) / CHUNK_XZ);
    const cy1 = Math.floor((ancora.y1 - 1 + LETRA_AVENTAL) / CHUNK_XZ);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const ck = chunkKey(cx, cy);
        let lista = byChunk.get(ck);
        if (!lista) {
          lista = [];
          byChunk.set(ck, lista);
        }
        if (!lista.includes(slot)) lista.push(slot);
      }
    }
  }

  worldPlan = { slots, byChunk, byArea };
  return worldPlan;
}

export function limparCacheLetras() {
  worldPlan = null;
  limparRelevoLetras();
  versaoPlano = (versaoPlano + 1) | 0;
}

export function letrasNoChunk(cx, cy) {
  return getWorldLetterPuzzlePlan().byChunk.get(chunkKey(cx, cy)) ?? [];
}

export function slotLetraPorId(id) {
  return getWorldLetterPuzzlePlan().slots.find((s) => s.id === id) ?? null;
}
