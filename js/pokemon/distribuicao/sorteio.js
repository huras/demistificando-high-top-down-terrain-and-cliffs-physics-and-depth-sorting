/** Sorteio ponderado casa (3) / extras (1) a partir do índice de bioma. */

import { especie } from "../dados.js";
import { poolDoBioma } from "./indice.js";

const PESO_CASA = 3;
const PESO_EXTRA = 1;
const FALLBACK = "pidgey";

/** @type {Map<string, { casa: string[], extras: string[] }>} */
const cacheFiltro = new Map();

function filtrarLista(lista) {
  const saida = [];
  for (let i = 0; i < lista.length; i++) {
    if (especie(lista[i])) saida.push(lista[i]);
  }
  return saida;
}

function poolFiltrado(biomaId) {
  let hit = cacheFiltro.get(biomaId);
  if (hit) return hit;
  const bruto = poolDoBioma(biomaId);
  const casa = filtrarLista(bruto.casa);
  const extras = filtrarLista(bruto.extras);
  hit = { casa, extras };
  // Só cacheia com catálogo pronto (evita cache vazio no boot).
  if (especie(FALLBACK) || (!bruto.casa.length && !bruto.extras.length)) {
    cacheFiltro.set(biomaId, hit);
  }
  return hit;
}

/**
 * @param {string} biomaId
 * @param {number} h hash uint32
 * @returns {string} species key
 */
export function sortearEspecie(biomaId, h) {
  let pool = poolFiltrado(biomaId);
  let total = pool.casa.length * PESO_CASA + pool.extras.length * PESO_EXTRA;
  if (!total) {
    pool = poolFiltrado("light-grass");
    total = pool.casa.length * PESO_CASA + pool.extras.length * PESO_EXTRA;
  }
  if (!total) return FALLBACK;

  let ticket = h % total;
  for (let i = 0; i < pool.casa.length; i++) {
    if (ticket < PESO_CASA) return pool.casa[i];
    ticket -= PESO_CASA;
  }
  for (let i = 0; i < pool.extras.length; i++) {
    if (ticket < PESO_EXTRA) return pool.extras[i];
    ticket -= PESO_EXTRA;
  }
  return pool.casa[0] || pool.extras[0] || FALLBACK;
}
