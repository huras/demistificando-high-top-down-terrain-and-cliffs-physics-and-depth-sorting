/** Constantes da cinemática de abertura (ainda isolada do boot do jogo). */

export const DEX_ARCEUS = 493;

export const CAM = {
  fov: 38,
  dist: 4.2,
  elev: 0.18,
  /** Centro visual do PMD (sprite ocupa a base do canvas 256). */
  alvoY: 1.05,
  orbitaPeriodo: 11,
  orbitaAmp: 0.14,
  bobAmp: 0.025,
  bobHz: 0.35,
};

export const ARCEUS = {
  x: 0,
  y: 0,
  z: 0,
  /** Mundo ≈ LADO/TILE * escala. */
  escala: 0.32,
  /** Escala do blit no canvas — enche o cartão pro close-up. */
  zoomBlit: 2.4,
  offsetY: -0.01,
};

export const LUZ = {
  cap: 640,
  emitPorSeg: 36,
  vidaMin: 2.4,
  vidaMax: 4.8,
  raioEmit: 0.95,
  alturaEmit: 2.4,
  centroY: 1.05,
  velSubidaMin: 0.32,
  velSubidaMax: 0.9,
  espiral: 0.55,
  tamanhoMin: 0.028,
  tamanhoMax: 0.07,
  brilho: 0.72,
};

export const HALO = {
  escala: 2.8,
  opacidade: 0.28,
  pulsoAmp: 0.06,
  pulsoHz: 0.45,
};

export const RAIOS = {
  qtd: 3,
  largura: 0.7,
  altura: 4.8,
  opacidade: 0.11,
  swayAmp: 0.1,
  swayHz: 0.28,
};

export const ESPACO = {
  raio: 80,
  rotacao: 0.012,
};
