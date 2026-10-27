/**
 * Catálogo congelado FlapAround — gate de asset (≠ tipo Flying).
 * Base: Pokemon AI skyPasserCatalog + denylist Twirl/Rotate/Dance.
 */

/** Dex sem flap real (CopyOf Twirl / Rotate / Dance). */
export const FLAP_DENY_DEX = Object.freeze(
  new Set([
    187, // Hoppip
    188, // Skiploom
    189, // Jumpluff
    247, // Pupitar
    349, // Feebas
  ]),
);

/**
 * Allowlist com FlapAround assada (PMD).
 * @type {readonly { dex: number, key: string }[]}
 */
export const FLAP_ENTRIES = Object.freeze([
  Object.freeze({ dex: 12, key: "butterfree" }),
  Object.freeze({ dex: 16, key: "pidgey" }),
  Object.freeze({ dex: 17, key: "pidgeotto" }),
  Object.freeze({ dex: 18, key: "pidgeot" }),
  Object.freeze({ dex: 21, key: "spearow" }),
  Object.freeze({ dex: 22, key: "fearow" }),
  Object.freeze({ dex: 41, key: "zubat" }),
  Object.freeze({ dex: 42, key: "golbat" }),
  Object.freeze({ dex: 49, key: "venomoth" }),
  Object.freeze({ dex: 142, key: "aerodactyl" }),
  Object.freeze({ dex: 169, key: "crobat" }),
  Object.freeze({ dex: 176, key: "togetic" }),
  Object.freeze({ dex: 198, key: "murkrow" }),
  Object.freeze({ dex: 226, key: "mantine" }),
  Object.freeze({ dex: 267, key: "beautifly" }),
  Object.freeze({ dex: 269, key: "dustox" }),
  Object.freeze({ dex: 276, key: "taillow" }),
  Object.freeze({ dex: 277, key: "swellow" }),
  Object.freeze({ dex: 278, key: "wingull" }),
  Object.freeze({ dex: 279, key: "pelipper" }),
  Object.freeze({ dex: 284, key: "masquerain" }),
  Object.freeze({ dex: 330, key: "flygon" }),
  Object.freeze({ dex: 333, key: "swablu" }),
  Object.freeze({ dex: 334, key: "altaria" }),
  Object.freeze({ dex: 396, key: "starly" }),
  Object.freeze({ dex: 397, key: "staravia" }),
  Object.freeze({ dex: 398, key: "staraptor" }),
  Object.freeze({ dex: 430, key: "honchkrow" }),
  Object.freeze({ dex: 468, key: "togekiss" }),
]);

/** @type {ReadonlySet<number>} */
export const FLAP_DEXES = Object.freeze(new Set(FLAP_ENTRIES.map((e) => e.dex)));

/** @type {ReadonlyMap<string, number>} */
const KEY_PARA_DEX = new Map(FLAP_ENTRIES.map((e) => [e.key, e.dex]));

/**
 * @param {number} dex
 */
export function dexTemFlapAround(dex) {
  const n = Math.floor(Number(dex));
  if (!Number.isFinite(n) || n <= 0) return false;
  if (FLAP_DENY_DEX.has(n)) return false;
  return FLAP_DEXES.has(n);
}

/**
 * @param {string} key
 */
export function chaveTemFlapAround(key) {
  const k = String(key || "").toLowerCase();
  if (!k) return false;
  const dex = KEY_PARA_DEX.get(k);
  if (dex == null) return false;
  return dexTemFlapAround(dex);
}

/**
 * @param {number} [rng] 0..1
 * @param {readonly { dex: number, key: string }[] | null} [pool]
 */
export function sortearFlapEntry(rng = Math.random(), pool = null) {
  const list = Array.isArray(pool) && pool.length > 0 ? pool : FLAP_ENTRIES;
  if (!list.length) return null;
  const t = Number.isFinite(rng) ? Math.max(0, Math.min(0.999999, rng)) : Math.random();
  return list[Math.floor(t * list.length)] ?? list[0];
}
