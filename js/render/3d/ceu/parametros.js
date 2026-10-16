import * as THREE from "three";

/** Um tile do mapa cobre este tanto de mundo (blocos). Nuvem grande, sombra legível. */
export const ESCALA_NUVEM = 0.0044;
/** Altura mundial da camada que projeta sombra. Acima do relevo (máx. ~30). */
export const ALTURA_NUVEM = 48;
export const ALTURA_CIRRUS = 78;
/** Dia completo. 3 s reais = 1 min de jogo (24 h = 4320 s). */
export const DURACAO_DIA = 4320;
/** Auge do sol ao meio-dia, em graus. Abaixo de 90° a sombra não some no zênite. */
export const INCLINACAO_SOL_PADRAO = 52;
export const INCLINACAO_SOL_MIN = 0;
export const INCLINACAO_SOL_MAX = 90;
/** Giro do arco em volta da vertical, em graus. */
export const ROTACAO_SOL_PADRAO = 0;
export const ROTACAO_SOL_MIN = 0;
export const ROTACAO_SOL_MAX = 360;

/**
 * Uniforms compartilhados entre o domo, a sombra no terreno e o clima.
 * O mesmo objeto { value } entra em vários materiais — atualizar aqui basta.
 */
export const uniformsNuvem = {
  uMapaNuvem: { value: null },
  uVentoNuvem: { value: new THREE.Vector2() },
  uCisalha: { value: new THREE.Vector2() },
  uEscalaNuvem: { value: ESCALA_NUVEM },
  uAlturaNuvem: { value: ALTURA_NUVEM },
  uLimiarNuvem: { value: 0.5 },
  uForcaSombra: { value: 0.55 },
  uUmidade: { value: 0 },
};
