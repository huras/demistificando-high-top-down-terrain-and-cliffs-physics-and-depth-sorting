import * as THREE from "three";

/** Um tile do mapa cobre este tanto de mundo (blocos). Nuvem grande, sombra legível. */
export const ESCALA_NUVEM = 0.0044;
/** Altura mundial da camada que projeta sombra. Acima do relevo (máx. ~30). */
export const ALTURA_NUVEM = 48;
export const ALTURA_CIRRUS = 78;
/** Dia completo. Curto o bastante pra ver o ciclo sem virar estroboscópio. */
export const DURACAO_DIA = 240;

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
