/** Modos de IA do companion — espelho do Pokemon AI. */

export const AI_MODE = Object.freeze({
  DEFAULT: "default",
  STAY: "stay",
  FOLLOW: "follow",
  DEFEND: "defend",
  AUTO_HUNT: "auto-hunt",
  AGRO: "agro",
});

export const AI_MODES = Object.freeze([
  AI_MODE.STAY,
  AI_MODE.FOLLOW,
  AI_MODE.DEFEND,
  AI_MODE.AUTO_HUNT,
  AI_MODE.AGRO,
]);

export const AI_MODE_OPTIONS = Object.freeze([AI_MODE.DEFAULT, ...AI_MODES]);

export const ROTULO_MODO = Object.freeze({
  [AI_MODE.DEFAULT]: "Padrão",
  [AI_MODE.STAY]: "Ficar",
  [AI_MODE.FOLLOW]: "Seguir",
  [AI_MODE.DEFEND]: "Defender",
  [AI_MODE.AUTO_HUNT]: "Caçar",
  [AI_MODE.AGRO]: "Atacar",
});

export function isConcreteAiMode(mode) {
  return AI_MODES.includes(mode);
}

export function resolveAiMode(preference, inheritedMode = AI_MODE.DEFEND) {
  if (preference !== AI_MODE.DEFAULT && isConcreteAiMode(preference)) {
    return preference;
  }
  return isConcreteAiMode(inheritedMode) ? inheritedMode : AI_MODE.DEFEND;
}

export function rotuloModo(mode) {
  return ROTULO_MODO[mode] || mode || "?";
}
