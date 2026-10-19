/** Números da arena e da rede. A luta, o projétil e o treino leem daqui. */

export const RAIO_ARENA = 13;
export const FOLGA_PARADA = 0.18;
/** Rolamento: preparação, janela que desvia tiro, recuperação. Corpo a corpo não desvia. */
export const ESQUIVA_PREP = 0.09;
export const ESQUIVA_ATIVA = 0.16;
export const ESQUIVA_REC = 0.18;
export const ESQUIVA_DUR = ESQUIVA_PREP + ESQUIVA_ATIVA + ESQUIVA_REC;
export const ESQUIVA_DIST = 3.45;
export const PASSO_DECISAO = 0.1;
export const JANELA_TIRO = 0.22;
export const JANELA_REDE = 0.45;
export const CORREDOR_TIRO = 0.7;
export const CORREDOR_REDE = 1.6;
export const FOLGA_PROJETIL = 0.38;
export const RAIO_PROJETIL = 0.45;
export const VIDA_FUGA = 0.28;
export const LEAD_MAX = 6;
export const ENTRADAS = 21;
export const OCULTOS = 16;
export const ALVO_REDE = 0.9;
