/** Sorteio ponderado casa (3) / extras (1), filtrado pelo nível da área. */

import { especie } from "../dados.js";
import { resolverEspecieNoNivel } from "../pack.js";
import { filtrarPorNivel } from "./nivelSelvagem.js";
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

function ticketNoPool(casa, extras, h) {
  const total = casa.length * PESO_CASA + extras.length * PESO_EXTRA;
  if (!total) return null;
  let ticket = h % total;
  for (let i = 0; i < casa.length; i++) {
    if (ticket < PESO_CASA) return casa[i];
    ticket -= PESO_CASA;
  }
  for (let i = 0; i < extras.length; i++) {
    if (ticket < PESO_EXTRA) return extras[i];
    ticket -= PESO_EXTRA;
  }
  return casa[0] || extras[0] || null;
}

/**
 * @param {string} biomaId
 * @param {number} h hash uint32
 * @param {number} [nivel] nível da área (porta formas evolutivas cedo demais)
 * @returns {string} species key
 */
export function sortearEspecie(biomaId, h, nivel = 1) {
  const lv = Math.max(1, nivel | 0);
  let pool = poolFiltrado(biomaId);
  let casa = filtrarPorNivel(pool.casa, lv);
  let extras = filtrarPorNivel(pool.extras, lv);

  if (!casa.length && !extras.length) {
    pool = poolFiltrado("light-grass");
    casa = filtrarPorNivel(pool.casa, lv);
    extras = filtrarPorNivel(pool.extras, lv);
  }

  let chave = ticketNoPool(casa, extras, h);
  if (!chave) {
    // Pool vazio no nível: tira do bruto e demote na linha.
    pool = poolFiltrado(biomaId);
    chave =
      ticketNoPool(pool.casa, pool.extras, h) ||
      ticketNoPool(
        poolFiltrado("light-grass").casa,
        poolFiltrado("light-grass").extras,
        h,
      ) ||
      FALLBACK;
  }

  return resolverEspecieNoNivel(chave, lv) || FALLBACK;
}
