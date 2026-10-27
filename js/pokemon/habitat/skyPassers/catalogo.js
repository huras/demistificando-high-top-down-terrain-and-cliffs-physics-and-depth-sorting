/**
 * Allowlist sky passers — subset FlapAround (paridade Pokemon AI).
 */
import {
  FLAP_DENY_DEX,
  FLAP_ENTRIES,
  dexTemFlapAround,
  sortearFlapEntry,
} from "../flapCatalog.js";

/** Dexes dedicados a passagem aérea (curado). */
export const SKY_PASSER_KEYS = Object.freeze([
  "butterfree",
  "pidgey",
  "pidgeotto",
  "pidgeot",
  "spearow",
  "fearow",
  "zubat",
  "golbat",
  "venomoth",
  "murkrow",
  "beautifly",
  "dustox",
  "taillow",
  "swellow",
  "wingull",
  "pelipper",
  "flygon",
  "swablu",
  "altaria",
  "starly",
  "staravia",
  "staraptor",
]);

const KEY_SET = new Set(SKY_PASSER_KEYS);

/**
 * @param {number} dex
 * @param {string} [key]
 */
export function ehSkyPasser(dex, key) {
  if (FLAP_DENY_DEX.has(dex | 0)) return false;
  if (key && KEY_SET.has(String(key).toLowerCase())) return true;
  return dexTemFlapAround(dex);
}

/**
 * Intersecta pool local (keys) com catálogo flap/sky.
 * @param {string[]} chaves
 * @returns {{ dex: number, key: string }[]}
 */
export function poolSkyDeChaves(chaves) {
  const out = [];
  const seen = new Set();
  for (let i = 0; i < (chaves?.length || 0); i++) {
    const key = String(chaves[i] || "").toLowerCase();
    if (!key || seen.has(key) || !KEY_SET.has(key)) continue;
    const entry = FLAP_ENTRIES.find((e) => e.key === key);
    if (!entry || !dexTemFlapAround(entry.dex)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

export function sortearSkyPasser(rng, pool = null) {
  if (pool?.length) return sortearFlapEntry(rng, pool);
  const filtrado = FLAP_ENTRIES.filter((e) => KEY_SET.has(e.key));
  return sortearFlapEntry(rng, filtrado);
}
