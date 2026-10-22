/**
 * Detalhe residual: o relevo pintado manda no macro;
 * o grafo do bioma só soma variação em torno da faixa média.
 */
import { clampAltura } from "../../config.js";
import { alturaGrafoDoPar, midBandDoPar } from "../bioma/catalogo.js";

const PESO_MILO = 0.45;
/** Abaixo disso o detalhe some (costa / raso). */
const U_INICIO = 0.55;
/** Acima disso o peso fica cheio. */
const U_CHEIO = 0.85;

function suave01(t) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/**
 * @param {number} hMacro
 * @param {number} wx
 * @param {number} wy
 * @param {{ bioma: object, biomaB?: object, dominio?: number } | null} par
 * @param {number} perfilU
 * @param {boolean} [travado]
 * @returns {number}
 */
export function aplicarDetalheBioma(hMacro, wx, wy, par, perfilU, travado = false) {
  if (travado || !par?.bioma) return hMacro;
  const u = Number.isFinite(perfilU) ? perfilU : 0;
  if (u < U_INICIO) return hMacro;

  let peso = PESO_MILO;
  if (u < U_CHEIO) {
    peso = PESO_MILO * suave01((u - U_INICIO) / (U_CHEIO - U_INICIO));
  }
  if (peso < 0.01) return hMacro;

  const hGrafo = alturaGrafoDoPar(par, wx, wy);
  const mid = midBandDoPar(par);
  return clampAltura(hMacro + peso * (hGrafo - mid));
}
