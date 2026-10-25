/**
 * Peso de carregamento (tier 1–3) de pedras/cristais e corpos.
 */

export const PESO_MIN = 1;
export const PESO_MAX = 3;

/**
 * @param {unknown} raw
 * @param {number} [fallback]
 */
export function normalizarPeso(raw, fallback = PESO_MIN) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(PESO_MIN, Math.min(PESO_MAX, n));
}

/**
 * Pedra/cristal: small→1, default→2, large/tall→3.
 * @param {{ sprite?: string, tipo?: string, porte?: number } | null | undefined} prop
 */
export function pesoDoProp(prop) {
  if (!prop) return PESO_MIN;
  if (prop.carryWeight != null) return normalizarPeso(prop.carryWeight);
  const id = String(prop.sprite || prop.id || "").toLowerCase();
  if (id.includes("small") || id.includes("tiny") || id.includes("pebble")) return 1;
  if (id.includes("large") || id.includes("tall") || id.includes("huge") || id.includes("boulder")) {
    return 3;
  }
  // porte do bioma: 0=minúscula, 1=média, 2=grande (ver porteDe).
  const porte = Number(prop.porte);
  if (Number.isFinite(porte)) {
    if (porte <= 0) return 1;
    if (porte >= 2) return 3;
    return 2;
  }
  if (prop.tipo === "cristal") return 2;
  return 2;
}

/**
 * Corpo no chão / Pokémon carregável.
 * @param {{ altura?: number, peso?: number, heightM?: number, weightKg?: number } | null | undefined} corpo
 */
export function pesoDoCorpo(corpo) {
  const altura = Number(corpo?.altura ?? corpo?.heightM) || 0.8;
  const peso = Number(corpo?.peso ?? corpo?.weightKg) || 20;
  if (altura >= 2.0 || peso >= 100) return 3;
  if (altura >= 1.1 || peso >= 35) return 2;
  return 1;
}
