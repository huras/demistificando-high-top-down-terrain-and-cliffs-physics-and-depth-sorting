/**
 * Cotas de deck / ponte — sem importar amostra ou catálogo (evita ciclo).
 */
export const COTA_PONTE = 16;
export const COTA_ESTRADA_MONTANHA = 72;
/** Pad de abutment (blocos) na junção terra↔ponte. */
export const PAD_ABUTMENT_PONTE = 3;
/** Fallback se o catálogo ainda não carregou. */
export const NIVEL_MAR_PADRAO = 12;

/**
 * Deck walkable da faixa.
 * @param {{ agua?: boolean, montanha?: boolean } | null} zona
 * @param {number} [nivelMar]
 */
export function cotaDeckEstrada(zona, nivelMar = NIVEL_MAR_PADRAO) {
  if (!zona) return COTA_PONTE;
  if (zona.agua) return Math.max(COTA_PONTE, (nivelMar | 0) + 1);
  if (zona.montanha) return COTA_ESTRADA_MONTANHA;
  return COTA_PONTE;
}
