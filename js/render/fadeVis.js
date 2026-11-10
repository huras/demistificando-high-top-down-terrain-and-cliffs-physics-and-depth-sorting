/**
 * Fade de visibilidade por distância (cull suave).
 * `_fadeVis` ∈ [0,1] multiplica opacity; despawn só abaixo do limiar.
 */

export const FADE_VIS_LIMIAR = 0.04;

export function clampFadeVis(v) {
  if (v == null || !Number.isFinite(v)) return 1;
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return v;
}

/** Só o fator de LOD (`_fadeVis`). */
export function alfaFadeVis(ent) {
  return clampFadeVis(ent?._fadeVis);
}

/**
 * Opacity final: captura/teleporte (`_sumindo`) × LOD (`_fadeVis`).
 * @param {{ _sumindo?: number|null, _fadeVis?: number|null }} ent
 */
export function alfaSpriteEntidade(ent) {
  const sumindo =
    ent?._sumindo == null ? 1 : Math.max(0, Math.min(1, ent._sumindo));
  return sumindo * alfaFadeVis(ent);
}

/**
 * 1 dentro de (raio − banda), 0 além do raio, linear na faixa.
 * @param {number} dist
 * @param {number} raio
 * @param {number} banda
 */
export function alvoFadePorDist(dist, raio, banda) {
  if (!(raio > 0)) return 0;
  if (!(banda > 0)) return dist <= raio ? 1 : 0;
  const inicio = Math.max(0, raio - banda);
  if (dist <= inicio) return 1;
  if (dist >= raio) return 0;
  return 1 - (dist - inicio) / (raio - inicio);
}

/**
 * Empurra `_fadeVis` em direção a `alvo` (1 / duração por segundo).
 * @param {{ _fadeVis?: number|null }} ent
 * @param {number} alvo
 * @param {number} dt
 * @param {number} duracao
 * @returns {number}
 */
export function rampaFadeVis(ent, alvo, dt, duracao) {
  if (!ent) return 0;
  const dest = Math.max(0, Math.min(1, alvo));
  let atual = ent._fadeVis;
  if (atual == null || !Number.isFinite(atual)) atual = dest > 0 ? 0 : 0;
  const passo =
    (duracao > 1e-4 ? 1 / duracao : 1e6) * Math.max(0, dt || 0);
  if (atual < dest) atual = Math.min(dest, atual + passo);
  else if (atual > dest) atual = Math.max(dest, atual - passo);
  ent._fadeVis = atual;
  return atual;
}

/** True se ainda precisa ficar na lista de render (fade não terminou). */
export function fadeVisAtivo(ent) {
  return alfaFadeVis(ent) > FADE_VIS_LIMIAR;
}
