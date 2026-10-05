/** Constantes da demo — 1 degrau = 1 face de cubo (leitura Minecraft). */
export const TILE = 16;
export const FACE_H = 16;
export const ESCALA = 2;
export const EPS_SORT = 0.001;

export const RAIO_CORPO = 0.28;

/** Corrida (células/s e células/s²). */
export const VELOCIDADE_MAX = 5.4;
export const ACELERACAO_CHAO = 32;
export const ATRITO_CHAO = 26;
export const ACELERACAO_AR = 16;
export const ATRITO_AR = 1.8;

/**
 * Pulo estilo Mario — unidades de z (1 = 1 degrau).
 * Pico segurando ≈ v²/(2·gLeve) ≈ 1.6 → alcança plataforma +1.
 */
export const PULO_VELOCIDADE = 6.4;
export const GRAVIDADE = 24;
export const GRAVIDADE_PULO_SEGURANDO = 12;
export const PULO_CORTE_SOLTAR = 0.42;
export const PULO_COYOTE = 0.09;
export const PULO_BUFFER = 0.12;
/** Folga ao pousar / achar parede no ar. */
export const PULO_EPS_POUSO = 0.04;
export const PULO_EMPURRAO_POUSO = 0.2;

export const ESCALADA_DURACAO = 0.34;

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3.5;
export const ZOOM_PASSO = 1.12;
/** Seguir câmera (1/s) — maior = mais grudada; menor = mais suave na troca de altura. */
export const CAMERA_SUAVIDADE = 7;

/** Só o jogador precisa de sprite; terreno = fallback de cubos. */
export const CAMINHOS = {
  jogador: "assets/people/gold.png",
};

export const JOGADOR_FRAME = 64;
export const JOGADOR_ESCALA = 0.5;
