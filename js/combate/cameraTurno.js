/**
 * Enquadramento do modo turnos. Um lugar só pra afastar/aproximar a câmera.
 * Valores em metros de mundo (X/Z no chão, Y altura).
 */

export const CAM_TURNO = Object.freeze({
  ombroPerto: Object.freeze({ dist: 6.2, altura: 3.5, lado: 1.45 }),
  ombro: Object.freeze({ dist: 8.4, altura: 4.4, lado: 2 }),
  volta: Object.freeze({ raio: 6.8, altura: 3.7, giro: 0.5 }),
  teatro: Object.freeze({ raio: 14.5, altura: 7.4, giro: Math.PI * 0.5 }),
  /** Perfil lateral do projétil — nunca atrás (billboard tapa o tiro). */
  tiro: Object.freeze({
    lado: 5.4,
    atras: 0.55,
    altura: 2.55,
    olhar: 3.4,
    misturaAlvo: 0,
  }),
  impactoAcerto: Object.freeze({
    raio0: 5.5,
    raioExtra: 3.8,
    altura0: 2.7,
    alturaExtra: 1.5,
    giro: 0.42,
  }),
  impactoErro: Object.freeze({ raio: 5.7, altura: 3.3, giro: 0.85 }),
});

/**
 * Chrono OW: framing lateral estável (sem órbita).
 * Party na esquerda da tela, foe na direita.
 */
export const CAM_CHRONO = Object.freeze({
  lado: 11.8,
  altura: 5.35,
  olharY: 1.15,
  ladoPorSep: 0.42,
  sepMin: 4.2,
  zoomImpacto: 0.78,
  zoomTiro: 0.86,
  zoomFoco: 0.9,
  /** Suavização do zoom (1/s). */
  zoomLerp: 7.5,
  /** Lerp de posição/olhar na entrada da luta (1/s) — mais lento = giro mais suave. */
  entradaLerp: 4.2,
  /** Janela em que a entrada usa entradaLerp (s). */
  entradaDur: 0.55,
  /** Lerp de volta à órbita OW após a luta. */
  saidaLerp: 5.0,
  /** Duração máxima do blend de saída (s). */
  saidaDur: 0.7,
  /** Lerp padrão durante beats de impacto (após a entrada). */
  posLerp: 9,
});
