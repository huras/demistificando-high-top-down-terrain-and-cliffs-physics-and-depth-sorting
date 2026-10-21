/**
 * Conhecimento simples de habitat: espécie → nomes de áreas
 * a partir da distribuição por bioma / áreas do mundo.
 */

import { AREAS_MUNDO, areaPorId } from "../../mundo/bioma/areasMundo.js";
import {
  distribuicaoPronta,
  poolDoBioma,
} from "../../pokemon/distribuicao/indice.js";
import { idsDeKit, obterKit } from "../../mundo/bioma/kits.js";

/** @type {Map<string, string[]> | null} */
let cache = null;

function nomeDoBioma(id) {
  const area = areaPorId(id);
  if (area?.nome) return area.nome;
  for (let i = 0; i < AREAS_MUNDO.length; i++) {
    if (AREAS_MUNDO[i].encontro === id) return AREAS_MUNDO[i].nome;
  }
  const kit = obterKit(id);
  if (kit?.nome) return kit.nome;
  if (kit?.label) return kit.label;
  return String(id || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function reconstruir() {
  /** @type {Map<string, Set<string>>} */
  const mapa = new Map();

  function registrar(chave, nomeArea) {
    if (!chave || !nomeArea) return;
    let set = mapa.get(chave);
    if (!set) {
      set = new Set();
      mapa.set(chave, set);
    }
    set.add(nomeArea);
  }

  for (let i = 0; i < AREAS_MUNDO.length; i++) {
    const area = AREAS_MUNDO[i];
    const pool = poolDoBioma(area.id);
    const nomes = new Set();
    const casa = pool.casa || [];
    const extras = pool.extras || [];
    for (let j = 0; j < casa.length; j++) {
      const k = typeof casa[j] === "string" ? casa[j] : casa[j]?.key || casa[j]?.species;
      if (k) nomes.add(k);
    }
    for (let j = 0; j < extras.length; j++) {
      const k =
        typeof extras[j] === "string" ? extras[j] : extras[j]?.key || extras[j]?.species;
      if (k) nomes.add(k);
    }
    for (const chave of nomes) registrar(chave, area.nome);
  }

  // Biomas de kit que não batem com AREAS_MUNDO
  try {
    const ids = idsDeKit();
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const pool = poolDoBioma(id);
      const nome = nomeDoBioma(id);
      const casa = pool.casa || [];
      const extras = pool.extras || [];
      for (let j = 0; j < casa.length; j++) {
        const k = typeof casa[j] === "string" ? casa[j] : casa[j]?.key;
        if (k) registrar(k, nome);
      }
      for (let j = 0; j < extras.length; j++) {
        const k = typeof extras[j] === "string" ? extras[j] : extras[j]?.key;
        if (k) registrar(k, nome);
      }
    }
  } catch {
    /* kits ainda não carregados */
  }

  /** @type {Map<string, string[]>} */
  const pronto = new Map();
  for (const [chave, set] of mapa) {
    pronto.set(chave, [...set].sort((a, b) => a.localeCompare(b, "pt-BR")));
  }
  cache = pronto;
}

/**
 * @param {string} speciesKey
 * @returns {string[]}
 */
export function listarHabitats(speciesKey) {
  const chave = String(speciesKey || "");
  if (!chave) return [];
  if (!distribuicaoPronta()) return [];
  if (!cache) reconstruir();
  return cache?.get(chave)?.slice() || [];
}

/** Invalida o índice (ex.: após recarregar distribuição). */
export function invalidarHabitats() {
  cache = null;
}
