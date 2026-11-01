/**
 * Ginásio indoor (plantaHub). Arena central, líder ao fundo, treinadores nas laterais.
 */
import { ALTURA_PRACA } from "../regiao/amostraKanto.js";
import { criarPlantaHub, aplicarPlantaNoChunk, naSaidaPlanta, alvoDaPlanta } from "./plantaHub.js";

export const ORIGEM_GINASIO_X = 100768;
export const ORIGEM_GINASIO_Y = 100512;

const COLS = 20;
const ROWS = 16;

function camadaChao() {
  const g = [];
  for (let y = 0; y < ROWS; y++) {
    const linha = [];
    for (let x = 0; x < COLS; x++) {
      if (y === ROWS - 1 && (x === 9 || x === 10)) linha.push(2);
      else if (y >= 5 && y <= 10 && x >= 6 && x <= 13) linha.push(4);
      else linha.push(1);
    }
    g.push(Object.freeze(linha));
  }
  return Object.freeze(g);
}

const erika = {
  id: "erika",
  peopleId: "pt-aroma-lady",
  nome: "Erika",
  sexo: "female",
  origem: "platinum",
  coluna: 16,
  x: 10,
  y: 2.6,
  fala: Object.freeze([
    "Bem-vindo ao Ginásio de Celadon.",
    "Aqui cultivamos Pokémon do tipo Planta com paciência e perfume.",
    "Quando estiver pronto para o desafio, fale comigo de novo. Por ora, admire o jardim.",
  ]),
};

const treinadores = [
  {
    id: "lass-mia",
    peopleId: "pt-lass",
    nome: "Mia",
    sexo: "female",
    origem: "platinum",
    coluna: 18,
    x: 4.5,
    y: 7.5,
    fala: Object.freeze([
      "Minhas flores favoritas crescem no jardim da Erika!",
      "Treine bem — o tipo Planta surpreende quem só leva fogo.",
    ]),
  },
  {
    id: "beauty-hana",
    peopleId: "pt-beauty",
    nome: "Hana",
    sexo: "female",
    origem: "platinum",
    coluna: 11,
    x: 15.5,
    y: 7.5,
    fala: Object.freeze([
      "O perfume daqui acalma até o time mais agitado.",
      "A Erika é gentil… mas a batalha dela é séria.",
    ]),
  },
];

const doorTx0 = 9;
const doorTx1 = 10;

const PLANTA = criarPlantaHub({
  papel: "ginasio",
  origemX: ORIGEM_GINASIO_X,
  origemY: ORIGEM_GINASIO_Y,
  tilesX: COLS,
  tilesY: ROWS,
  anel: true,
  camada: camadaChao(),
  corParede: "#7a9e6a",
  corBalcao: "#c5e0a8",
  saidas: [
    { tx: doorTx0, ty: ROWS - 1 },
    { tx: doorTx1, ty: ROWS - 1 },
  ],
  props: [
    {
      id: "npc",
      peopleId: erika.peopleId,
      nome: erika.nome,
      sexo: erika.sexo,
      origem: erika.origem,
      coluna: erika.coluna,
      x: erika.x,
      y: erika.y,
      disco: true,
      raio: 0.4,
    },
    ...treinadores.map((t) => ({
      id: "npc",
      peopleId: t.peopleId,
      nome: t.nome,
      sexo: t.sexo,
      origem: t.origem,
      coluna: t.coluna,
      x: t.x,
      y: t.y,
      disco: true,
      raio: 0.36,
    })),
    { id: "vaso", x: 2.5, y: 2.4, disco: true, raio: 0.36 },
    { id: "vaso", x: 17.5, y: 2.4, disco: true, raio: 0.36 },
    { id: "vaso", x: 2.5, y: 12.5, disco: true, raio: 0.36 },
    { id: "vaso", x: 17.5, y: 12.5, disco: true, raio: 0.36 },
  ],
  alvos: [
    {
      tipo: "npc",
      nome: erika.nome,
      x: erika.x,
      y: erika.y,
      alcance: 1.45,
      ref: {
        ...erika,
        x: ORIGEM_GINASIO_X + erika.x,
        y: ORIGEM_GINASIO_Y + erika.y,
        z: ALTURA_PRACA,
        fala: erika.fala,
      },
    },
    ...treinadores.map((t) => ({
      tipo: "npc",
      nome: t.nome,
      x: t.x,
      y: t.y,
      alcance: 1.3,
      ref: {
        ...t,
        x: ORIGEM_GINASIO_X + t.x,
        y: ORIGEM_GINASIO_Y + t.y,
        z: ALTURA_PRACA,
        fala: t.fala,
      },
    })),
  ],
});

PLANTA.balcoes = [
  { x: 7, y: 6, w: 6, h: 4 },
];

export function plantaGinasio() {
  return PLANTA;
}

export function spawnGinasio() {
  return PLANTA.spawn;
}

export function aplicarGinasioNoChunk(chunk) {
  return aplicarPlantaNoChunk(chunk, PLANTA);
}

export function naSaidaGinasio(x, y) {
  return naSaidaPlanta(PLANTA, x, y);
}

export function alvoDoGinasio(x, y) {
  return alvoDaPlanta(PLANTA, x, y);
}

export function promptDoGinasio(alvo) {
  if (!alvo) return "";
  if (alvo.tipo === "npc") return alvo.nome || "Falar";
  return "";
}
