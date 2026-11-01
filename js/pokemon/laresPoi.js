/**
 * Gate de POI outdoor para lares — rejeita ninho cujo carimbo (núcleo+avental)
 * encoste na plaza/avental do sítio (farm, cemitério, posto, doca, mirante).
 *
 * Mesma eficiência da estrada: resolve o site da área (cache O(1)) e testa AABB.
 */
import { paraLocalKanto } from "../mundo/bounds.js";
import { AREA_KANTO, LADO_KANTO } from "../mundo/regiao/grafoKanto.js";
import { resolverSiteDaArea } from "../mundo/sites/plano.js";
import { LAR_FOLGA_ESTRADA } from "./laresEstrada.js";

/** Folga além do terraço do POI — ninho não cola na beira do pad. */
export const LAR_FOLGA_POI = LAR_FOLGA_ESTRADA;
const RAIO_SITIO_PADRAO = 2 + 2 + LAR_FOLGA_POI;

/**
 * Disco Chebyshev do ninho intersecta AABB [x0,x1)×[y0,y1)?
 * @param {number} ix
 * @param {number} iy
 * @param {number} r
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1 exclusive
 * @param {number} y1 exclusive
 */
function tocaAabb(ix, iy, r, x0, y0, x1, y1) {
  const nx0 = ix - r;
  const ny0 = iy - r;
  const nx1 = ix + r + 1;
  const ny1 = iy + r + 1;
  return nx0 < x1 && nx1 > x0 && ny0 < y1 && ny1 > y0;
}

/**
 * True se o sítio do ninho invade plaza+avental de um POI outdoor.
 * @param {number} x
 * @param {number} y
 * @param {number} [raio]
 */
export function larTocaPoi(x, y, raio = RAIO_SITIO_PADRAO) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const r = Math.max(0, raio | 0);
  const local = paraLocalKanto(ix, iy);
  const ax0 = Math.floor(local.x / AREA_KANTO);
  const ay0 = Math.floor(local.y / AREA_KANTO);
  const folga = LAR_FOLGA_POI;

  // Área atual + vizinhos (POI perto da borda da área).
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const ax = ax0 + dx;
      const ay = ay0 + dy;
      if (ax < 0 || ay < 0 || ax >= LADO_KANTO || ay >= LADO_KANTO) continue;
      const site = resolverSiteDaArea(ax, ay);
      const plaza = site?.plaza;
      if (!plaza) continue;
      const anel = plaza.anel | 0;
      const x0 = (plaza.x0 | 0) - anel - folga;
      const y0 = (plaza.y0 | 0) - anel - folga;
      const x1 = (plaza.x1 | 0) + anel + folga;
      const y1 = (plaza.y1 | 0) + anel + folga;
      if (tocaAabb(ix, iy, r, x0, y0, x1, y1)) return true;
    }
  }
  return false;
}
