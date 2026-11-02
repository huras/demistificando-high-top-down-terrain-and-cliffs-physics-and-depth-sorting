/**
 * Tipos e receitas de cerca / portão.
 */

export const FENCE_KIND = Object.freeze({
  SEGMENT: "segment",
  GATE: "gate",
});

export const FENCE_CATALOG_ID = Object.freeze({
  SEGMENT: "white-fence",
  GATE: "white-fence-gate",
});

export const FENCE_MAX_STROKE = 64;
export const FENCE_MAX_PER_AREA = 512;

export const FENCE_SEGMENT_COST = Object.freeze({ wood: 2, plantFiber: 1 });
export const FENCE_GATE_COST = Object.freeze({ wood: 8, stone: 2, plantFiber: 2 });

/**
 * @param {string} id
 */
export function fenceKindFromCatalogId(id) {
  if (id === FENCE_CATALOG_ID.GATE) return FENCE_KIND.GATE;
  if (id === FENCE_CATALOG_ID.SEGMENT) return FENCE_KIND.SEGMENT;
  return null;
}

/**
 * @param {string} id
 * @returns {Record<string, number>|null}
 */
export function receitaCercaPorId(id) {
  if (id === FENCE_CATALOG_ID.GATE) return { ...FENCE_GATE_COST };
  if (id === FENCE_CATALOG_ID.SEGMENT) return { ...FENCE_SEGMENT_COST };
  return null;
}

/**
 * @param {string} fenceKind
 */
export function receitaCercaPorKind(fenceKind) {
  return fenceKind === FENCE_KIND.GATE
    ? { ...FENCE_GATE_COST }
    : { ...FENCE_SEGMENT_COST };
}

/**
 * @param {string} catalogId
 * @param {number} cellCount
 */
export function agregarReceitaCerca(catalogId, cellCount) {
  const base = receitaCercaPorId(catalogId);
  if (!base) return null;
  const n = Math.max(0, cellCount | 0);
  /** @type {Record<string, number>} */
  const out = {};
  for (const [key, amount] of Object.entries(base)) {
    out[key] = (amount | 0) * n;
  }
  return out;
}

export function tileKey(tx, ty) {
  return `${tx | 0},${ty | 0}`;
}

export function parseTileKey(key) {
  const i = String(key).indexOf(",");
  if (i < 0) return null;
  const tx = Number(key.slice(0, i));
  const ty = Number(key.slice(i + 1));
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return null;
  return { tx: tx | 0, ty: ty | 0 };
}
