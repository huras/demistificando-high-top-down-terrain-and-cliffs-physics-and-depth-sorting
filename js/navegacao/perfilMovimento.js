/**
 * Perfis de movimento pro pathfinder.
 * Cada entidade carrega um perfil; a grade de vizinhos é cacheada por id.
 */

/** Companheiro: anda, queda curta, pula +1, escala, plana, voa, corre, água. */
export const PERFIL_COMPANHEIRO = Object.freeze({
  id: "companheiro-8dir",
  podePular: true,
  podeEscalar: true,
  podePlanar: true,
  podeCorrer: true,
  podeVoar: true,
  podeVadear: true,
  podeNadar: true,
  podeCachoeira: true,
  /** Queda máxima a pé (aresta walk); acima disso só via glide/voo ou contorno. */
  quedaMaxAndar: 2,
  /** Alias legado — preferir quedaMaxAndar. */
  quedaMax: 2,
});

/** Pokémon no chão: caminha, contorna base e pula um bloco. */
export const PERFIL_A_PE = Object.freeze({
  id: "a-pe",
  podePular: true,
  podeEscalar: false,
  podePlanar: false,
  podeCorrer: true,
  podeVoar: false,
  podeVadear: true,
  podeNadar: false,
  podeCachoeira: false,
  quedaMaxAndar: 1,
  quedaMax: 1,
});

/** Exemplo futuro: NPC que planeja rotas de escalada. */
export const PERFIL_ESCALADOR = Object.freeze({
  id: "escalador",
  podePular: true,
  podeEscalar: true,
  podePlanar: false,
  podeCorrer: true,
  podeVoar: false,
  podeVadear: true,
  podeNadar: true,
  podeCachoeira: true,
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
    podeCorrer: overrides.podeCorrer ?? base.podeCorrer ?? true,
    podeVoar: overrides.podeVoar ?? base.podeVoar ?? false,
    podeVadear: overrides.podeVadear ?? base.podeVadear ?? true,
    podeNadar: overrides.podeNadar ?? base.podeNadar ?? true,
    podeCachoeira: overrides.podeCachoeira ?? base.podeCachoeira ?? true,
    quedaMaxAndar,
    quedaMax: overrides.quedaMax ?? quedaMaxAndar,
  };
}
