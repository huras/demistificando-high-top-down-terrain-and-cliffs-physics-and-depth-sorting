/**
 * Gate de POI outdoor para lares — rejeita ninho cujo carimbo (núcleo+avental)
 * encoste na plaza/avental do sítio (farm, cemitério, posto, doca, mirante).
 *
 * Mesma eficiência da estrada: só lê o carimbo de relevo (O(1) por célula).
 * NÃO chama resolverSiteDaArea — isso rebentava o boot (acharAncora × 9 áreas × ninho).
 * Quem gera o chunk resolve/carimba o POI antes dos lares (celulasSiteChunk).
 */
import { temPlanoSite } from "../mundo/sites/relevo.js";
import { LAR_FOLGA_ESTRADA } from "./laresEstrada.js";

/** Folga além do terraço do POI — ninho não cola na beira do pad. */
export const LAR_FOLGA_POI = LAR_FOLGA_ESTRADA;
const RAIO_SITIO_PADRAO = 2 + 2 + LAR_FOLGA_POI;

/**
 * True se alguma célula no raio Chebyshev do sítio já tem carimbo de POI.
 * @param {number} x
 * @param {number} y
 * @param {number} [raio]
 */
export function larTocaPoi(x, y, raio = RAIO_SITIO_PADRAO) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const r = Math.max(0, raio | 0);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (temPlanoSite(ix + dx, iy + dy)) return true;
    }
  }
  return false;
}
