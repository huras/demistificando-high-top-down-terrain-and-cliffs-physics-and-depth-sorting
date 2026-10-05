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
 * Pulo Mario: segurar Space = gravidade leve; soltar = corta vz.
 * Pico segurando ≈ v²/(2·gLeve) ≈ 1.7 → alcança plataforma +1.
 */
export const PULO_VELOCIDADE = 6.4;
export const GRAVIDADE = 24;
export const GRAVIDADE_PULO_SEGURANDO = 12;
export const PULO_CORTE_SOLTAR = 0.42;
export const PULO_COYOTE = 0.09;
export const PULO_BUFFER = 0.12;
export const PULO_EPS_POUSO = 0.04;
export const PULO_EMPURRAO_POUSO = 0.2;

/**
 * Asa-delta — só com 2º toque de Space no ar (nunca hold).
 * 3º toque fecha.
 */
export const ASA_DELTA_DESCIDA = 0.55;
export const ASA_DELTA_ABRIR_APOS = 0.08;
export const ASA_DELTA_LIFT_MIN = 0.12;
export const ASA_DELTA_VEL_MUL = 1.2;
export const ASA_DELTA_ACEL_AR = 22;
export const ASA_DELTA_ATRITO_AR = 0.5;

export const ESCALADA_DURACAO = 0.34;

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3.5;
export const ZOOM_PASSO = 1.12;
export const CAMERA_SUAVIDADE = 7;

export const CAMINHOS = {
  jogador: "assets/people/gold.png",
  asaDelta: "assets/items/asa_delta.png",
};

export const JOGADOR_FRAME = 64;
export const JOGADOR_ESCALA = 0.5;
