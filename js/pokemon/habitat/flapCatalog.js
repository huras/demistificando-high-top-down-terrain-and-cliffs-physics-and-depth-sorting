/**
 * Catálogo congelado de pose aérea (FlapAround | Hover | Hop | Float).
 * Gate de asset ≠ tipo Flying. Gerado por tools/pokemon/audit-pose-voo.mjs --write.
 */

/** Dex sem pose aérea real (CopyOf Twirl / Rotate / Dance). */
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
 * Allowlist com strip aérea confirmada no SpriteCollab (e/ou overworld).
 * @type {readonly { dex: number, key: string }[]}
 */
export const FLAP_ENTRIES = Object.freeze([
  Object.freeze({ dex: 12, key: "butterfree" }), // FlapAround
  Object.freeze({ dex: 16, key: "pidgey" }), // FlapAround
  Object.freeze({ dex: 17, key: "pidgeotto" }), // FlapAround
  Object.freeze({ dex: 18, key: "pidgeot" }), // FlapAround
  Object.freeze({ dex: 21, key: "spearow" }), // Hover
  Object.freeze({ dex: 22, key: "fearow" }), // Hover
  Object.freeze({ dex: 41, key: "zubat" }), // Hover
  Object.freeze({ dex: 42, key: "golbat" }), // Hover
  Object.freeze({ dex: 49, key: "venomoth" }), // FlapAround
  Object.freeze({ dex: 142, key: "aerodactyl" }), // Hover
  Object.freeze({ dex: 169, key: "crobat" }), // Hop
  Object.freeze({ dex: 176, key: "togetic" }), // Hover
  Object.freeze({ dex: 198, key: "murkrow" }), // FlapAround
  Object.freeze({ dex: 226, key: "mantine" }), // Hover
  Object.freeze({ dex: 267, key: "beautifly" }), // FlapAround
  Object.freeze({ dex: 269, key: "dustox" }), // FlapAround
  Object.freeze({ dex: 276, key: "taillow" }), // FlapAround
  Object.freeze({ dex: 277, key: "swellow" }), // FlapAround
  Object.freeze({ dex: 278, key: "wingull" }), // Hover
  Object.freeze({ dex: 279, key: "pelipper" }), // Hop
  Object.freeze({ dex: 284, key: "masquerain" }), // Hover
  Object.freeze({ dex: 330, key: "flygon" }), // FlapAround
  Object.freeze({ dex: 333, key: "swablu" }), // Hover
  Object.freeze({ dex: 334, key: "altaria" }), // Hover
  Object.freeze({ dex: 396, key: "starly" }), // Hover
  Object.freeze({ dex: 397, key: "staravia" }), // Hover
  Object.freeze({ dex: 398, key: "staraptor" }), // Hover
  Object.freeze({ dex: 430, key: "honchkrow" }), // Hover
  Object.freeze({ dex: 468, key: "togekiss" }), // Hover
]);

/** Alias semântico — pose aérea, não só FlapAround. */
export const FLIGHT_POSE_ENTRIES = FLAP_ENTRIES;

/** @type {ReadonlySet<number>} */
export const FLAP_DEXES = Object.freeze(new Set(FLAP_ENTRIES.map((e) => e.dex)));
export const FLIGHT_POSE_DEXES = FLAP_DEXES;

/** @type {ReadonlyMap<string, number>} */
const KEY_PARA_DEX = new Map(FLAP_ENTRIES.map((e) => [e.key, e.dex]));

/**
 * @param {number} dex
 */
export function dexTemPoseVoo(dex) {
  const n = Math.floor(Number(dex));
  if (!Number.isFinite(n) || n <= 0) return false;
  if (FLAP_DENY_DEX.has(n)) return false;
  return FLAP_DEXES.has(n);
}

/** @deprecated use dexTemPoseVoo */
export const dexTemFlapAround = dexTemPoseVoo;

/**
 * @param {string} key
 */
export function chaveTemPoseVoo(key) {
  const k = String(key || "").toLowerCase();
  if (!k) return false;
  const dex = KEY_PARA_DEX.get(k);
  if (dex == null) return false;
  return dexTemPoseVoo(dex);
}

/** @deprecated use chaveTemPoseVoo */
export const chaveTemFlapAround = chaveTemPoseVoo;

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

export const sortearPoseVooEntry = sortearFlapEntry;
