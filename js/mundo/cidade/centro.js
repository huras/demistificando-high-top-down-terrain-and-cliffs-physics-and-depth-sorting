/**
 * Centro Pokémon. Sala 14×9, um tile por célula.
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

const enfermeira = { x: 7.5, y: 2.55, coluna: 64 };
const pc = { x: 10.5, y: 3 };
const maquina = { x: 6, y: 2.55 };
const balcao = { x: 4, y: 3, w: 6, h: 1, sprite: 25 };

const PLANTA = criarPlantaHub({
  papel: "centro",
  origemX: ORIGEM_CENTRO_X,
  origemY: ORIGEM_CENTRO_Y,
  tilesX: 14,
  tilesY: 9,
  anel: true,
  camada: CAMADA,
  corParede: "#f3c1cf",
  corBalcao: "#fff6f8",
  saidas: [
    { tx: 6, ty: 8 },
    { tx: 7, ty: 8 },
  ],
  props: [
    { id: "cura", x: maquina.x, y: maquina.y, disco: true, raio: 0.62 },
    { id: "pc", x: pc.x, y: pc.y, disco: true, raio: 0.42 },
    { id: "npc", coluna: enfermeira.coluna, x: enfermeira.x, y: enfermeira.y, disco: true, raio: 0.36 },
  ],
  alvos: [
    { tipo: "cura", nome: "Enfermeira", x: 7.5, y: 4.5, alcance: 1.25 },
    { tipo: "cura", nome: "Máquina", x: 6, y: 4.5, alcance: 1.25 },
    { tipo: "pc", nome: "PC", x: pc.x, y: pc.y + 0.7, alcance: 1.25 },
  ],
});

PLANTA.balcao = balcao;
for (let i = 0; i < balcao.w; i++) {
  PLANTA.discos.push({
    x: ORIGEM_CENTRO_X + balcao.x + i + 0.5,
    y: ORIGEM_CENTRO_Y + balcao.y + balcao.h * 0.5,
    z: PLANTA.spawn.z,
    r: 0.48,
  });
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
  if (alvo.tipo === "pc") return "PC — R";
  return "";
}
