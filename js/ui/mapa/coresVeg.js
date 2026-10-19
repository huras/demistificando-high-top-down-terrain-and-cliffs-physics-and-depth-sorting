/**
 * Cores da vegetação no mapa. A copa continua escura;
 * a grama é amarelo-lima para separar do chão.
 */

export const COPA = [18, 62, 32];
export const MOTE_ARVORE = [10, 42, 20];
export const GRAMA_CAMPO = [232, 210, 64];
export const MOTE_GRAMA = [248, 230, 90];

export const FORCA_COPA = 0.78;
export const FORCA_MOTE_ARVORE = 0.7;
export const FORCA_GRAMA = 0.7;
export const FORCA_MOTE_GRAMA = 0.9;

/** Nibble baixo: grama (3 bits + mote). Nibble alto: árvore (3 bits + mote). */
export function empacotarVeg(grama, arvore, mote) {
  const g = Math.min(7, Math.round(Math.max(0, grama) * 7));
  const a = Math.min(7, Math.round(Math.max(0, arvore) * 7));
  const baixo = g | (mote === 1 && g > 0 ? 8 : 0);
  const alto = a | (mote === 2 && a > 0 ? 8 : 0);
  return baixo | (alto << 4);
}

export function lerVeg(byte) {
  return {
    grama: (byte & 7) / 7,
    arvore: ((byte >> 4) & 7) / 7,
    moteGrama: (byte & 8) !== 0,
    moteArvore: (byte & 128) !== 0,
  };
}
