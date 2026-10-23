/** party e treinador são o mesmo time no overworld. */

export function faccoesAliadas(fa, fb) {
  if (!fa || !fb) return false;
  if (fa === fb) return true;
  return (fa === "party" && fb === "treinador") || (fa === "treinador" && fb === "party");
}

export function saoInimigos(a, b) {
  if (!a || !b || a === b) return false;
  return !faccoesAliadas(a.faccao, b.faccao);
}
