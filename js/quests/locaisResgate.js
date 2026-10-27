/**
 * Células de busca e tile de spawn para resgate (só selvagem).
 */

import { deLocalKanto } from "../mundo/bounds.js";
import { AREA_KANTO, LADO_KANTO, zonaEm } from "../mundo/regiao/grafoKanto.js";
import { alturaEm } from "../mundo/altura.js";
import { cidadePorId } from "./cidades.js";
import { hashQuestId, QUEST_RING } from "./tipos.js";

function celulaTerra(ax, ay) {
  if (ax < 0 || ay < 0 || ax >= LADO_KANTO || ay >= LADO_KANTO) return false;
  const z = zonaEm(ax, ay);
  if (!z || z.tipo === "cidade") return false;
  return true;
}

function anel(cx, cy, raio) {
  const out = [];
  for (let dy = -raio; dy <= raio; dy++) {
    for (let dx = -raio; dx <= raio; dx++) {
      if (dx === 0 && dy === 0) continue;
      const ax = cx + dx;
      const ay = cy + dy;
      if (celulaTerra(ax, ay)) out.push({ ax, ay });
    }
  }
  return out;
}

function terraMaisProxima(cx, cy, maxDist = 12) {
  const out = [];
  for (let dist = 1; dist <= maxDist; dist++) {
    for (let dy = -dist; dy <= dist; dy++) {
      for (let dx = -dist; dx <= dist; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== dist) continue;
        const ax = cx + dx;
        const ay = cy + dy;
        if (celulaTerra(ax, ay)) out.push({ ax, ay });
      }
    }
    if (out.length) return out;
  }
  return out;
}

/**
 * @param {string} cityId
 * @returns {{ ax: number, ay: number }[]}
 */
export function celulasResgate(cityId) {
  const city = cidadePorId(cityId);
  if (!city) return [];
  let cells = anel(city.ax, city.ay, QUEST_RING);
  if (!cells.length) cells = terraMaisProxima(city.ax, city.ay);
  return cells;
}

/**
 * @param {object} posting
 * @param {{ ax: number, ay: number }[]} [pre]
 */
export function escolherAreaResgate(posting, pre = null) {
  const cells = pre?.length ? pre : celulasResgate(posting.cityId);
  if (!cells.length) return null;
  const i = hashQuestId(posting.id) % cells.length;
  return cells[i];
}

export function distanciaArea(cityAx, cityAy, targetAx, targetAy) {
  const dx = Math.abs((targetAx | 0) - (cityAx | 0));
  const dy = Math.abs((targetAy | 0) - (cityAy | 0));
  return Math.max(1, Math.max(dx, dy));
}

/**
 * Ponto walkable dentro da célula alvo (mundo).
 * @returns {{ x: number, y: number } | null}
 */
export function escolherTileResgate(posting, ax, ay) {
  if (!posting || !Number.isFinite(ax) || !Number.isFinite(ay)) return null;
  const seed = hashQuestId(`${posting.id}:tile`);
  const ox = ax * AREA_KANTO;
  const oy = ay * AREA_KANTO;
  let best = null;
  let bestRank = -1;
  const step = 4;
  const margin = 16;
  for (let ly = margin; ly < AREA_KANTO - margin; ly += step) {
    for (let lx = margin; lx < AREA_KANTO - margin; lx += step) {
      const world = deLocalKanto(ox + lx + 0.5, oy + ly + 0.5);
      const h = alturaEm(world.x | 0, world.y | 0);
      if (!(h > 0)) continue;
      const rank = hashQuestId(`${seed}:${lx},${ly}`) >>> 0;
      if (rank > bestRank) {
        bestRank = rank;
        best = { x: world.x, y: world.y };
      }
    }
  }
  if (best) return best;
  const mid = deLocalKanto(ox + AREA_KANTO * 0.5, oy + AREA_KANTO * 0.5);
  return { x: mid.x, y: mid.y };
}

/**
 * Nome amigável da área de busca.
 */
export function nomeAreaBusca(posting) {
  const ax = posting?.targetAx;
  const ay = posting?.targetAy;
  if (!Number.isFinite(ax) || !Number.isFinite(ay)) return null;
  const z = zonaEm(ax, ay);
  return z?.nome || null;
}
