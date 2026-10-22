import { AI_MODE, resolveAiMode } from "../aiModes.js";

let defaultFollowerMode = AI_MODE.DEFEND;

export function obterDefaultFollowerMode() {
  return defaultFollowerMode;
}

export function definirDefaultFollowerMode(mode) {
  if (mode === AI_MODE.DEFAULT) return defaultFollowerMode;
  defaultFollowerMode = resolveAiMode(mode, AI_MODE.DEFEND);
  return defaultFollowerMode;
}

export function modoEfetivo(ator) {
  const pref = ator?.modePreference ?? AI_MODE.DEFAULT;
  return resolveAiMode(pref, defaultFollowerMode);
}

export function aplicarModoParty(ator, preference) {
  if (!ator) return null;
  ator.modePreference = preference ?? AI_MODE.DEFAULT;
  ator.modeIa = modoEfetivo(ator);
  return ator.modeIa;
}

export function sincronizarModosParty(lista) {
  if (!lista) return;
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    if (!a) continue;
    if (a.modePreference == null) a.modePreference = AI_MODE.DEFAULT;
    a.modeIa = modoEfetivo(a);
  }
}
