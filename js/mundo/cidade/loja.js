/**
 * Poké Mart. Planta Emerald 11×8, um tile por célula.
 */
import { gradeDe, criarPlantaHub, aplicarPlantaNoChunk, naSaidaPlanta, alvoDaPlanta, ESCALA_HUB } from "./plantaHub.js";

export const ORIGEM_LOJA_X = 100256;
export const ORIGEM_LOJA_Y = 100512;

const S = ESCALA_HUB;

function meio(tx, ty) {
  return { x: (tx + 0.5) * S, y: (ty + 0.5) * S };
}

const COLISAO = gradeDe(`
###########
###########
..#........
..#.......#
###...##..#
......##..#
......##..#
...........
`);

const CAMADA = Object.freeze([
  Object.freeze([8, 21, 9, 10, 10, 10, 22, 23, 22, 23, 12]),
  Object.freeze([15, 42, 27, 16, 16, 16, 25, 26, 25, 26, 18]),
  Object.freeze([19, 4, 33, 6, 4, 4, 31, 32, 20, 32, 24]),
  Object.freeze([43, 36, 37, 3, 0, 0, 0, 0, 0, 0, 30]),
  Object.freeze([44, 40, 41, 3, 0, 0, 28, 29, 2, 0, 28]),
  Object.freeze([5, 4, 4, 1, 0, 0, 34, 35, 3, 0, 34]),
  Object.freeze([5, 0, 0, 0, 0, 0, 38, 39, 3, 0, 38]),
  Object.freeze([11, 0, 0, 13, 14, 0, 7, 4, 1, 0, 17]),
]);

const clerk = meio(1, 3);
const balcaoA = meio(3, 3);
const balcaoB = meio(3, 4);

const PLANTA = criarPlantaHub({
  papel: "loja",
  origemX: ORIGEM_LOJA_X,
  origemY: ORIGEM_LOJA_Y,
  tilesX: 11,
  tilesY: 8,
  colisao: COLISAO,
  camada: CAMADA,
  corParede: "#b7d7c0",
  corBalcao: "#e7f0ff",
  saidas: [
    { tx: 4, ty: 7 },
    { tx: 5, ty: 7 },
  ],
  props: [
    { id: "npc", coluna: 2, x: clerk.x, y: clerk.y - 0.1, nome: "Balconista" },
    {
      id: "prateleira",
      x: 7 * S,
      y: 5 * S,
      area: { tx: 6, ty: 4, tw: 2, th: 2 },
    },
  ],
  alvos: [
    { tipo: "loja", nome: "Balcão", x: balcaoA.x, y: balcaoA.y, alcance: 1.2 },
    { tipo: "loja", nome: "Balcão", x: balcaoB.x, y: balcaoB.y, alcance: 1.2 },
    { tipo: "loja", nome: "Balconista", x: clerk.x, y: clerk.y, alcance: 1.15 },
  ],
});

export function plantaLoja() {
  return PLANTA;
}

export function spawnLoja() {
  return PLANTA.spawn;
}

export function aplicarLojaNoChunk(chunk) {
  return aplicarPlantaNoChunk(chunk, PLANTA);
}

export function naSaidaLoja(x, y) {
  return naSaidaPlanta(PLANTA, x, y);
}

export function alvoDaLoja(x, y) {
  return alvoDaPlanta(PLANTA, x, y);
}

export function promptDaLoja(alvo) {
  if (!alvo) return "";
  if (alvo.tipo === "loja") return "Balcão — R";
  return "";
}
