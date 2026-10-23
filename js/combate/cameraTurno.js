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
