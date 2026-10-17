/** Rede de seguir. O jogo e o treino leem daqui. */

export const ENTRADAS = 16;
export const OCULTOS = 16;
export const HORIZONTE = 14;
export const ALCANCE_RAIO = 6;
export const PASSO_DECISAO = 0.1;
export const PRESO_SEG = 1.3;
export const PRESO_FOLGA = 0.45;
export const PRESO_CASTIGO = 2.5;
export const FOLGA_PISO = 1.05;
export const SONDA_FRENTE = 1.6;

/** 0 à frente do posto, depois esquerda/direita alternadas. */
export const ANGULOS = new Float32Array([
  0,
  0.785398,
  -0.785398,
  1.570796,
  -1.570796,
  2.356194,
  -2.356194,
  3.141593,
]);
