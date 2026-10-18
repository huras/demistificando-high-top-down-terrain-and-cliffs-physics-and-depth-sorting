/**
 * Centro Pokémon. Sala 28×9, o dobro da largura do mapa.
 * A borda é parede, com a porta no sul. O balcão fica na frente da enfermeira.
 */
import { criarPlantaHub, aplicarPlantaNoChunk, naSaidaPlanta, alvoDaPlanta } from "./plantaHub.js";

export const ORIGEM_CENTRO_X = 8192;
export const ORIGEM_CENTRO_Y = 8704;

const CAMADA = Object.freeze([
  Object.freeze([7, 8, 66, 67, 9, 9, 9, 56, 57, 9, 10, 11, 12, 13]),
  Object.freeze([14, 15, 72, 73, 54, 26, 27, 60, 61, 55, 0, 16, 17, 18]),
  Object.freeze([19, 20, 74, 75, 58, 33, 34, 6, 64, 59, 28, 21, 22, 23]),
  Object.freeze([24, 30, 39, 1, 62, 25, 25, 4, 25, 63, 45, 1, 1, 31]),
  Object.freeze([24, 1, 1, 1, 65, 68, 69, 70, 71, 5, 29, 1, 1, 31]),
  Object.freeze([76, 77, 1, 1, 1, 35, 36, 37, 38, 1, 1, 1, 1, 31]),
  Object.freeze([78, 79, 1, 1, 1, 41, 42, 43, 44, 1, 39, 46, 47, 31]),
  Object.freeze([80, 81, 1, 1, 1, 48, 49, 50, 51, 1, 30, 52, 53, 31]),
  Object.freeze([32, 1, 1, 1, 1, 1, 2, 3, 1, 1, 1, 30, 39, 40]),
]);

const enfermeira = { x: 14.5, y: 2.55, coluna: 64 };
const pc = { x: 17.5, y: 3 };
const maquina = { x: 13, y: 2.55 };
const base = 1.55;
const vaso = { x: 1.75, y: base };
const vasoDireito = { x: 26.25, y: base };
const mapa = { x: 23.6, y: 1.12 };
const estantes = [
  { x: 3.4, y: base },
  { x: 5.45, y: base },
  { x: 7.5, y: base },
];
const mesa = { x: 24, y: 5.6 };
const cadeiras = [
  { id: "cadeira39", x: 22.5, y: 4.6 },
  { id: "cadeira30", x: 22.5, y: 5.6 },
  { id: "cadeira30", x: 23.5, y: 6.6 },
  { id: "cadeira39", x: 24.5, y: 6.6 },
];
const balcoes = [
  { x: 11, y: 3, w: 6, h: 1, sprite: 25 },
  { x: 11, y: 1, w: 1, h: 2, sprite: 25 },
  { x: 16, y: 1, w: 1, h: 2, sprite: 25 },
];

const PLANTA = criarPlantaHub({
  papel: "centro",
  origemX: ORIGEM_CENTRO_X,
  origemY: ORIGEM_CENTRO_Y,
  tilesX: 28,
  tilesY: 9,
  anel: true,
  camada: CAMADA,
  corParede: "#f3c1cf",
  corBalcao: "#fff6f8",
  saidas: [
    { tx: 13, ty: 8 },
    { tx: 14, ty: 8 },
  ],
  props: [
    { id: "cura", x: maquina.x, y: maquina.y, disco: true, raio: 0.62 },
    { id: "pc", x: pc.x, y: pc.y, disco: true, raio: 0.42 },
    { id: "npc", coluna: enfermeira.coluna, x: enfermeira.x, y: enfermeira.y, disco: true, raio: 0.36 },
    { id: "vaso", x: vaso.x, y: vaso.y, disco: true, raio: 0.36 },
    { id: "vaso", x: vasoDireito.x, y: vasoDireito.y, disco: true, raio: 0.36 },
    { id: "estante", x: estantes[0].x, y: estantes[0].y, disco: true, raio: 0.72 },
    { id: "estante", x: estantes[1].x, y: estantes[1].y, disco: true, raio: 0.72 },
    { id: "estante", x: estantes[2].x, y: estantes[2].y, disco: true, raio: 0.72 },
    { id: "mesa", x: mesa.x, y: mesa.y, disco: true, raio: 0.85 },
    { id: cadeiras[0].id, x: cadeiras[0].x, y: cadeiras[0].y, disco: true, raio: 0.28 },
    { id: cadeiras[1].id, x: cadeiras[1].x, y: cadeiras[1].y, disco: true, raio: 0.28 },
    { id: cadeiras[2].id, x: cadeiras[2].x, y: cadeiras[2].y, disco: true, raio: 0.28 },
    { id: cadeiras[3].id, x: cadeiras[3].x, y: cadeiras[3].y, disco: true, raio: 0.28 },
  ],
  alvos: [
    { tipo: "cura", nome: "Enfermeira", x: 14.5, y: 4.5, alcance: 1.25 },
    { tipo: "cura", nome: "Máquina", x: 13, y: 4.5, alcance: 1.25 },
    { tipo: "pc", nome: "PC", x: pc.x, y: pc.y + 0.7, alcance: 1.25 },
  ],
});

PLANTA.balcoes = balcoes;
PLANTA.mapa = mapa;
for (let p = 0; p < balcoes.length; p++) {
  const peca = balcoes[p];
  for (let iz = 0; iz < peca.h; iz++) {
    for (let ix = 0; ix < peca.w; ix++) {
      PLANTA.discos.push({
        x: ORIGEM_CENTRO_X + peca.x + ix + 0.5,
        y: ORIGEM_CENTRO_Y + peca.y + iz + 0.5,
        z: PLANTA.spawn.z,
        r: 0.48,
      });
    }
  }
}

export function plantaCentro() {
  return PLANTA;
}

export function spawnCentro() {
  return PLANTA.spawn;
}

export function aplicarCentroNoChunk(chunk) {
  return aplicarPlantaNoChunk(chunk, PLANTA);
}

export function naSaidaCentro(x, y) {
  return naSaidaPlanta(PLANTA, x, y);
}

export function alvoDoCentro(x, y) {
  return alvoDaPlanta(PLANTA, x, y);
}

export function promptDoCentro(alvo) {
  if (!alvo) return "";
  if (alvo.tipo === "cura") return "Recuperar";
  if (alvo.tipo === "pc") return "";
  return "";
}
