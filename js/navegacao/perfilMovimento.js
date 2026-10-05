/**
 * Perfis de movimento pro pathfinder.
 * Cada entidade carrega um perfil; a grade de vizinhos é cacheada por id.
 */

/** Companheiro padrão: anda, cai, pula +1. Sem escalada / asa-delta. */
export const PERFIL_COMPANHEIRO = Object.freeze({
  id: "companheiro",
  podePular: true,
  podeEscalar: false,
  /** Queda máxima em células (Infinity = qualquer queda no chão). */
  quedaMax: Infinity,
});

/** Exemplo futuro: NPC que planeja rotas de escalada. */
export const PERFIL_ESCALADOR = Object.freeze({
  id: "escalador",
  podePular: true,
  podeEscalar: true,
  quedaMax: Infinity,
});

export function clonarPerfil(base, overrides = {}) {
  return {
    id: overrides.id ?? base.id,
    podePular: overrides.podePular ?? base.podePular,
    podeEscalar: overrides.podeEscalar ?? base.podeEscalar,
    quedaMax: overrides.quedaMax ?? base.quedaMax,
  };
}
