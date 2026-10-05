/** Constantes da demo — 1 degrau = 1 face de cubo (leitura Minecraft). */
export const TILE = 16;
export const FACE_H = 16;
export const ESCALA = 2;
export const EPS_SORT = 0.001;

export const RAIO_CORPO = 0.28;

/** Subir andando (estilo Minecraft) — 1 degrau sem pulo/escalada. */
export const DEGRAU_ANDAR = 1;

/** Corrida (células/s e células/s²). */
export const VELOCIDADE_MAX = 5.4;
export const ACELERACAO_CHAO = 32;
export const ATRITO_CHAO = 26;
export const ACELERACAO_AR = 16;
export const ATRITO_AR = 1.8;

/**
 * Pulo Mario: segurar Space = gravidade leve; soltar = corta vz.
 * Tap ≈ v²/(2·g) ≈ 1.15 → sobe +1 sem segurar; hold ≈ 2.3 → +2.
 */
export const PULO_VELOCIDADE = 7.4;
export const GRAVIDADE = 24;
export const GRAVIDADE_PULO_SEGURANDO = 12;
export const PULO_CORTE_SOLTAR = 0.42;
export const PULO_COYOTE = 0.09;
export const PULO_BUFFER = 0.12;
export const PULO_EPS_POUSO = 0.08;
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

/** Escalada grudada (BOTW) — células/s na face. */
export const ESCALADA_VEL = 1.85;
export const ESCALADA_MANTLE_EPS = 0.12;
export const ESCALADA_IMPULSO_SOLTAR = 2.8;

/** Stamina (unidades arbitrárias). */
export const STAMINA_MAX = 100;
export const STAMINA_DRAIN_ESCALADA = 18;
export const STAMINA_REGEN = 28;

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3.5;
export const ZOOM_PASSO = 1.12;
export const CAMERA_SUAVIDADE = 7;

/** Câmera terceira pessoa (modo 3D). */
export const CAMERA3D_DIST_MIN = 4;
export const CAMERA3D_DIST_MAX = 28;
export const CAMERA3D_DIST_PADRAO = 10;
export const CAMERA3D_ALTURA = 3.2;
export const CAMERA3D_OLHAR_Y = 1.15;
export const CAMERA3D_SUAVIDADE = 8;
export const CAMERA3D_LOOKAHEAD = 0.35;
/** rad/s — Q/E orbitam a câmera no modo 3D. */
export const CAMERA3D_ROT_VEL = 2.4;

export const CAMINHOS = {
  jogador: "assets/people/gold.png",
  asaDelta: "assets/items/asa_delta.png",
  grama: "assets/terrain/grass.png",
  terra: "assets/terrain/dirt.png",
  cliffDuplo: "assets/terrain/double-cliff-autotile.png",
  cliffSimples: "assets/terrain/cliff-autotile.png",
  mata: "assets/vegetation/green-grass.png",
  arvore: "assets/trees/broadleaf.png",
};

/** Preferir tiles reais quando o atlas de terreno carregar; tecla T alterna. */
export const VISUAL_REAL_PADRAO = true;

export const JOGADOR_FRAME = 64;
export const JOGADOR_ESCALA = 0.5;

/** Sheets processados / cliff autotile (mesmo layout do Pokemon AI). */
export const TILE_ART = 16;
export const SHEET_COLS = 5;
export const FLOOR_ROW_OFFSET = 3;
export const ROLE_CENTER = 6;
export const ROLE_EDGE_S = 11;
export const ROLE_EDGE_S_UNDER = 16;
export const ROLE_EDGE_W = 5;
export const ROLE_EDGE_E = 7;
export const ROLE_CLIFF_CENTER = 6;
