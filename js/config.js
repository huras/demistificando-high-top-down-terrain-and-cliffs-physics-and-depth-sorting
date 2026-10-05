/** Constantes da demo — 1 degrau = 1 face de cubo (leitura Minecraft). */
export const TILE = 16;
export const FACE_H = 16;
export const ESCALA = 2;
export const EPS_SORT = 0.001;

export const VELOCIDADE = 4.2;
export const RAIO_CORPO = 0.28;

export const PULO_ARCO_CELULAS = 0.85;
export const PULO_DURACAO_BASE = 0.28;
export const PULO_DURACAO_POR_DEGRAU = 0.12;
export const PULO_ALCANCE = 1.15;

export const ESCALADA_DURACAO = 0.34;

/** Só o jogador precisa de sprite; terreno = fallback de cubos. */
export const CAMINHOS = {
  jogador: "assets/people/gold.png",
};

export const JOGADOR_FRAME = 64;
export const JOGADOR_ESCALA = 0.5;
