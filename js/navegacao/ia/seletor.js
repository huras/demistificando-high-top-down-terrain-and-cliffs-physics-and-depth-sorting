/** Escolhe a habilidade legal. Não lê o mundo: a sonda já está na observação. */

function bloqueio(obs) {
  return obs[4] < 0.45 && obs[5] < 0.7 && obs[6] < 0.7;
}

/**
 * 1 voo se o líder está alto, o chão está fechado, ou já está no ar.
 * 2 planar na queda. 3 nado na água. 4 chão.
 */
export function escolherHabilidade(perfil, obs, voando) {
  const podeVoar = !!perfil?.podeVoar;
  const podePlanar = !!perfil?.podePlanar;
  const podeNadar = !!perfil?.podeNadar;
  if (podeVoar && (voando || obs[3] > 0.28 || bloqueio(obs))) return "voar";
  if (podePlanar && obs[13] > 0.5) return "planar";
  if (podeNadar && obs[12] > 0.5) return "nadar";
  return "chao";
}
