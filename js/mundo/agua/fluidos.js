/**
 * Família do líquido. A forma (lago, rio, vulcão) mora em corpos.js.
 * Um tipo novo entra aqui: cor, se nada, se queima, se é raso.
 */
import { BLOCO } from "../voxel/tiposBloco.js";

export const FLUIDO = Object.freeze({
  NENHUM: 0,
  AGUA: 1,
  PANTANO: 2,
  LAVA: 3,
});

const LISTA = [
  null,
  Object.freeze({
    id: FLUIDO.AGUA,
    nome: "agua",
    nada: true,
    raso: false,
    queima: false,
    queda: true,
    lento: 1,
    bloco: BLOCO.AGUA,
    lamina: [126, 200, 227],
    fundo: [26, 79, 138],
    clara: [186, 226, 240],
  }),
  Object.freeze({
    id: FLUIDO.PANTANO,
    nome: "pantano",
    nada: false,
    raso: true,
    queima: false,
    queda: false,
    lento: 0.55,
    bloco: BLOCO.AGUA,
    lamina: [58, 104, 62],
    fundo: [24, 58, 36],
    clara: [96, 148, 88],
  }),
  Object.freeze({
    id: FLUIDO.LAVA,
    nome: "lava",
    nada: false,
    raso: false,
    queima: true,
    queda: true,
    lento: 1,
    bloco: BLOCO.LAVA,
    lamina: [236, 98, 28],
    fundo: [150, 36, 8],
    clara: [255, 186, 72],
  }),
];

export function fluidoDe(id) {
  return LISTA[id | 0] || null;
}

/** Com água na coluna e byte zerado, a família é a do mar. */
export function familiaDaColuna(id) {
  return LISTA[id | 0] || LISTA[FLUIDO.AGUA];
}
