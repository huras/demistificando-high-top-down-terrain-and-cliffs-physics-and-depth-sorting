/**
 * Plaza shrine-floor sob o AABB do glifo (sem peças soltas).
 * Paridade Pokemon AI letterPuzzlePlaza.
 */
import { CHUNK_XZ } from "../config.js";
import { letrasNoChunk, slotLetraPorId, versaoPlanoLetras } from "./plano.js";
import { layoutDoSlot } from "./colocacao.js";
import { ehNucleoPlanoLetra, temPlanoLetra } from "./relevo.js";

/**
 * Retângulo world sólido do glifo (inclui gaps entre células).
 * @param {{ x: number, y: number, letter?: string, w?: number, h?: number, glyphX0?: number, glyphY0?: number, glyphX1?: number, glyphY1?: number }} slot
 * @returns {{ x0: number, y0: number, x1: number, y1: number } | null}
 */
export function retanguloGlifoLetra(slot) {
  if (!slot) return null;
  if (
    Number.isFinite(slot.glyphX0) &&
    Number.isFinite(slot.glyphY0) &&
    Number.isFinite(slot.glyphX1) &&
    Number.isFinite(slot.glyphY1)
  ) {
    return {
      x0: slot.glyphX0 | 0,
      y0: slot.glyphY0 | 0,
      x1: slot.glyphX1 | 0,
      y1: slot.glyphY1 | 0,
    };
  }
  const w = slot.w | 0;
  const h = slot.h | 0;
  if (w < 1 || h < 1) return null;
  const x0 = Math.floor(slot.x);
  const y0 = Math.floor(slot.y);
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}

/**
 * Retângulo do sítio planificado (glifo + pad das soltas).
 * @param {object} slot
 */
export function retanguloSitioLetra(slot) {
  if (!slot) return null;
  if (
    Number.isFinite(slot.siteX0) &&
    Number.isFinite(slot.siteY0) &&
    Number.isFinite(slot.siteX1) &&
    Number.isFinite(slot.siteY1)
  ) {
    return {
      x0: slot.siteX0 | 0,
      y0: slot.siteY0 | 0,
      x1: slot.siteX1 | 0,
      y1: slot.siteY1 | 0,
    };
  }
  return retanguloGlifoLetra(slot);
}

/**
 * Células de piso da plaza neste chunk (AABB do glifo = núcleo shrine-floor).
 * @returns {Set<string> | null}
 */
export function celulasPlazaLetrasChunk(cx, cy) {
  const slots = letrasNoChunk(cx, cy);
  if (!slots.length) return null;
  const set = new Set();
  const baseX = cx * CHUNK_XZ;
  const baseY = cy * CHUNK_XZ;
  for (let s = 0; s < slots.length; s++) {
    const rect = retanguloGlifoLetra(slots[s]);
    if (!rect) continue;
    for (let ty = rect.y0; ty < rect.y1; ty++) {
      for (let tx = rect.x0; tx < rect.x1; tx++) {
        if (tx < baseX || ty < baseY || tx >= baseX + CHUNK_XZ || ty >= baseY + CHUNK_XZ) {
          continue;
        }
        set.add(`${tx},${ty}`);
      }
    }
  }
  return set.size ? set : null;
}

/**
 * Células do sítio inteiro (glifo + pad) neste chunk — limpa veg / física.
 * @returns {Set<string> | null}
 */
export function celulasSitioLetrasChunk(cx, cy) {
  const slots = letrasNoChunk(cx, cy);
  if (!slots.length) return null;
  const set = new Set();
  const baseX = cx * CHUNK_XZ;
  const baseY = cy * CHUNK_XZ;
  for (let s = 0; s < slots.length; s++) {
    const rect = retanguloSitioLetra(slots[s]);
    if (!rect) continue;
    for (let ty = rect.y0; ty < rect.y1; ty++) {
      for (let tx = rect.x0; tx < rect.x1; tx++) {
        if (tx < baseX || ty < baseY || tx >= baseX + CHUNK_XZ || ty >= baseY + CHUNK_XZ) {
          continue;
        }
        set.add(`${tx},${ty}`);
      }
    }
  }
  return set.size ? set : null;
}

/** @type {Map<string, Set<string> | null>} */
const cachePlaza = new Map();
let cacheVersao = -1;

function garantirCache() {
  const v = versaoPlanoLetras();
  if (cacheVersao !== v) {
    cachePlaza.clear();
    cacheVersao = v;
  }
}

export function limparCachePlazaLetras() {
  cachePlaza.clear();
  cacheVersao = -1;
}

export function ehPlazaLetra(wx, wy) {
  return ehNucleoPlanoLetra(wx, wy);
}

export function ehSitioLetra(wx, wy) {
  return temPlanoLetra(wx, wy);
}

/**
 * Dados de render da plaza + arcos pra um slot.
 * @param {string} id
 */
export function dadosVisuaisLetra(id) {
  const slot = slotLetraPorId(id);
  if (!slot) return null;
  const layout = layoutDoSlot(slot);
  const rect = retanguloGlifoLetra(slot);
  if (!layout || !rect) return null;
  return {
    slot,
    layout,
    rect,
    cells: layout.grid?.cells || [],
    originX: layout.originX,
    originY: layout.originY,
  };
}

/** Helper se algum código ainda usar cache por chunk. */
export function plazaCacheDoChunk(cx, cy) {
  garantirCache();
  const key = `${cx},${cy}`;
  if (cachePlaza.has(key)) return cachePlaza.get(key);
  const set = celulasPlazaLetrasChunk(cx, cy);
  cachePlaza.set(key, set);
  return set;
}
