/**
 * Gate de estrada para lares — rejeita sítio cujo carimbo (núcleo+avental)
 * encoste em rua/caminho de Kanto.
 *
 * Raio espelha LAR_NUCLEO_RAIO(2) + LAR_AVENTAL(2) + folga(1) em laresSitio.
 */
import { ehCaminhoKanto } from "../mundo/regiao/amostraKanto.js";

/** Folga além do sítio carimbado — ninho não cola na beira da rua. */
export const LAR_FOLGA_ESTRADA = 1;
const RAIO_SITIO_PADRAO = 2 + 2 + LAR_FOLGA_ESTRADA;

/**
 * True se alguma célula no raio Chebyshev do sítio é caminho/rua.
 * @param {number} x
 * @param {number} y
 * @param {number} [raio]
 */
export function larTocaEstrada(x, y, raio = RAIO_SITIO_PADRAO) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const r = Math.max(0, raio | 0);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (ehCaminhoKanto(ix + dx, iy + dy)) return true;
    }
  }
  return false;
}
