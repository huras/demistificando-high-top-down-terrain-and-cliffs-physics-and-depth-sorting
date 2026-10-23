/**
 * Uma pedra por Pokémon das gens 1–4 (dex 1–493).
 */
import { listarEspecies } from "../pokemon/dados.js";
import { shrineDefByElement } from "./catalogo.js";

export const GEN_DEX_RANGES = Object.freeze([
  Object.freeze({ gen: 1, min: 1, max: 151 }),
  Object.freeze({ gen: 2, min: 152, max: 251 }),
  Object.freeze({ gen: 3, min: 252, max: 386 }),
  Object.freeze({ gen: 4, min: 387, max: 493 }),
]);

export const DEX_MIN = 1;
export const DEX_MAX = 493;

/** @type {Map<number, object> | null} */
let porDex = null;

export function mapaPorDex() {
  if (porDex) return porDex;
  porDex = new Map();
  const lista = listarEspecies();
  for (let i = 0; i < lista.length; i++) {
    const esp = lista[i];
    const dex = esp?.dex | 0;
    if (dex >= DEX_MIN && dex <= DEX_MAX && !porDex.has(dex)) {
      porDex.set(dex, esp);
    }
  }
  return porDex;
}

export function especiePorDex(dex) {
  return mapaPorDex().get(dex | 0) ?? null;
}

export function shrineElementForSpecies(species) {
  const types = species?.tipos ?? species?.types ?? [];
  for (let i = 0; i < types.length; i++) {
    if (shrineDefByElement(types[i])) return String(types[i]).toLowerCase();
  }
  return "normal";
}

/**
 * Uma entrada por dex 1..493.
 * @returns {{ dex: number, speciesKey: string, element: string }[]}
 */
export function shrineSpeciesAll() {
  const map = mapaPorDex();
  const out = [];
  for (let dex = DEX_MIN; dex <= DEX_MAX; dex++) {
    const esp = map.get(dex);
    out.push({
      dex,
      speciesKey: esp?.key ?? `dex-${dex}`,
      element: shrineElementForSpecies(esp),
    });
  }
  return out;
}

export function shrineQuotaTotal() {
  return DEX_MAX - DEX_MIN + 1;
}
