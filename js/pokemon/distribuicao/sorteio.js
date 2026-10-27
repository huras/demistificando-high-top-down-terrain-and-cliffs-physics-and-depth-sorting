/** Sorteio ponderado casa (3) / extras (1), filtrado pelo nível e habitat. */

import { especie } from "../dados.js";
import {
  especieServeHabitat,
  HABITAT,
  temFlapAround,
  ehAquatico,
} from "../habitat/index.js";
import { resolverEspecieNoNivel } from "../pack.js";
import { filtrarPorNivel } from "./nivelSelvagem.js";
import { poolDoBioma } from "./indice.js";

const PESO_CASA = 3;
const PESO_EXTRA = 1;
const FALLBACK = "pidgey";
const FALLBACK_AGUA = "magikarp";
const FALLBACK_AGUA_ALT = "tentacool";

/** Pad aquático quando o bioma não tem Water no pool. */
export const WET_ENCOUNTER_PAD = Object.freeze([
  "magikarp",
  "tentacool",
  "goldeen",
  "psyduck",
  "poliwag",
  "staryu",
  "shellder",
  "horsea",
]);

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
 * @param {string[]} lista
 * @param {string} kind
 */
function filtrarPorHabitat(lista, kind) {
  if (!kind || !lista?.length) return lista || [];
  const out = [];
  for (let i = 0; i < lista.length; i++) {
    const esp = especie(lista[i]);
    if (!esp) continue;
    if (especieServeHabitat(esp, kind)) out.push(lista[i]);
  }
  return out;
}

function padAguaFiltrado() {
  return filtrarLista(WET_ENCOUNTER_PAD);
}

/**
 * @param {string} biomaId
 * @param {number} h hash uint32
 * @param {number} [nivel] nível da área
 * @param {{ habitat?: string } | string} [opts] kind HABITAT ou legacy string
 * @returns {string} species key
 */
export function sortearEspecie(biomaId, h, nivel = 1, opts = null) {
  const lv = Math.max(1, nivel | 0);
  const habitat =
    typeof opts === "string"
      ? opts
      : opts && typeof opts === "object"
        ? opts.habitat || null
        : null;

  let pool = poolFiltrado(biomaId);
  let casa = filtrarPorHabitat(filtrarPorNivel(pool.casa, lv), habitat);
  let extras = filtrarPorHabitat(filtrarPorNivel(pool.extras, lv), habitat);

  if (!casa.length && !extras.length) {
    if (habitat === HABITAT.SURFACE || habitat === HABITAT.UNDERSEA) {
      const pad = filtrarPorNivel(padAguaFiltrado(), lv);
      casa = pad;
      extras = [];
    } else if (habitat === HABITAT.HIGH || habitat === HABITAT.SKY) {
      pool = poolFiltrado("light-grass");
      casa = filtrarPorHabitat(filtrarPorNivel(pool.casa, lv), habitat);
      extras = filtrarPorHabitat(filtrarPorNivel(pool.extras, lv), habitat);
      if (!casa.length && !extras.length) {
        // Força allowlist flap conhecida.
        const flapKeys = ["pidgey", "spearow", "zubat", "taillow", "starly"];
        casa = filtrarPorNivel(filtrarLista(flapKeys), lv);
      }
    } else {
      pool = poolFiltrado("light-grass");
      casa = filtrarPorHabitat(filtrarPorNivel(pool.casa, lv), habitat);
      extras = filtrarPorHabitat(filtrarPorNivel(pool.extras, lv), habitat);
    }
  }

  let chave = ticketNoPool(casa, extras, h);
  if (!chave) {
    pool = poolFiltrado(biomaId);
    let c0 = filtrarPorHabitat(pool.casa, habitat);
    let e0 = filtrarPorHabitat(pool.extras, habitat);
    if (!c0.length && !e0.length && (habitat === HABITAT.SURFACE || habitat === HABITAT.UNDERSEA)) {
      c0 = padAguaFiltrado();
    }
    chave =
      ticketNoPool(c0, e0, h) ||
      (habitat === HABITAT.SURFACE || habitat === HABITAT.UNDERSEA
        ? especie(FALLBACK_AGUA)?.key || FALLBACK_AGUA_ALT
        : FALLBACK);
  }

  const resolvida = resolverEspecieNoNivel(chave, lv) || chave;
  // Habitat HIGH: se o demote removeu flap, sobe de novo se possível.
  if (habitat === HABITAT.HIGH || habitat === HABITAT.SKY) {
    const esp = especie(resolvida);
    if (esp && !temFlapAround(esp) && temFlapAround(especie(chave))) return chave;
    if (esp && !temFlapAround(esp)) {
      const flapKeys = ["pidgey", "spearow", "zubat", "taillow"];
      return flapKeys[h % flapKeys.length];
    }
  }
  if (habitat === HABITAT.SURFACE || habitat === HABITAT.UNDERSEA) {
    const esp = especie(resolvida);
    if (esp && !ehAquatico(esp)) {
      return especie(FALLBACK_AGUA)?.key || FALLBACK_AGUA;
    }
  }
  return resolvida || FALLBACK;
}
