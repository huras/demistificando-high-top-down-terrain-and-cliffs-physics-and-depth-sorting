/**
 * Perfis de movimento pro pathfinder.
 * Cada entidade carrega um perfil; a grade de vizinhos é cacheada por id.
 */

/** Companheiro: anda, queda curta, pula +1, escala paredes altas, plana em drops. */
export const PERFIL_COMPANHEIRO = Object.freeze({
  id: "companheiro-8dir",
  podePular: true,
  podeEscalar: true,
  podePlanar: true,
  /** Queda máxima a pé (aresta walk); acima disso só via glide ou contorno. */
  quedaMaxAndar: 2,
  /** Alias legado — preferir quedaMaxAndar. */
  quedaMax: 2,
});

/** Exemplo futuro: NPC que planeja rotas de escalada. */
export const PERFIL_ESCALADOR = Object.freeze({
  id: "escalador",
  podePular: true,
  podeEscalar: true,
  podePlanar: false,
  quedaMaxAndar: Infinity,
  quedaMax: Infinity,
});

export function clonarPerfil(base, overrides = {}) {
  const quedaMaxAndar =
    overrides.quedaMaxAndar ??
    overrides.quedaMax ??
    base.quedaMaxAndar ??
    base.quedaMax;
  return {
    id: overrides.id ?? base.id,
    podePular: overrides.podePular ?? base.podePular,
    podeEscalar: overrides.podeEscalar ?? base.podeEscalar,
    podePlanar: overrides.podePlanar ?? base.podePlanar ?? false,
    quedaMaxAndar,
    quedaMax: overrides.quedaMax ?? quedaMaxAndar,
  };
}
