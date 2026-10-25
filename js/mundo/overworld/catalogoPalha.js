/**
 * Straw bed PMD — casa visual dos lares selvagens (sem colisão).
 */
export const BASE_PALHA = "assets/models/overworld/palha/";

/** Altura alvo em metros; footprint ~1.8–2.2 m após escala (modelo ~1.3×0.15). */
export const PALHA_ALTURA_ALVO = 0.28;

/** Disco macio (sem obstáculo): −50% velocidade. */
export const PALHA_RAIO = 0.85;

export const PALHA_VEL_MUL = 0.5;

/** Raio de sync 3D / soft zone (lares próximos). */
export const PALHA_RAIO_SYNC = 64;
