/**
 * Mansão indoor (plantaHub). Salão sóbrio com pesquisadores e um ponto de lore.
 */
import { ALTURA_PRACA } from "../regiao/amostraKanto.js";
import { criarPlantaHub, aplicarPlantaNoChunk, naSaidaPlanta, alvoDaPlanta } from "./plantaHub.js";

export const ORIGEM_MANSAO_X = 100000;
export const ORIGEM_MANSAO_Y = 100768;

const COLS = 22;
const ROWS = 14;

function camadaChao() {
  const g = [];
  for (let y = 0; y < ROWS; y++) {
    const linha = [];
    for (let x = 0; x < COLS; x++) {
      if (y === ROWS - 1 && (x === 10 || x === 11)) linha.push(2);
      else if (y <= 2) linha.push(9);
      else linha.push(1);
    }
    g.push(Object.freeze(linha));
  }
  return Object.freeze(g);
}

const npcs = [
  {
    id: "cientista-a",
    peopleId: "pt-scientist",
    nome: "Kenji",
    sexo: "male",
    origem: "platinum",
    coluna: 43,
    x: 5.5,
    y: 4.2,
    fala: Object.freeze([
      "Esta mansão guarda anotações antigas sobre genética Pokémon.",
      "Cuidado nos corredores — o chão ainda range de experimentos antigos.",
    ]),
  },
  {
    id: "cientista-b",
    peopleId: "pt-scientist",
    nome: "Rita",
    sexo: "female",
    origem: "platinum",
    coluna: 43,
    x: 16.5,
    y: 4.2,
    fala: Object.freeze([
      "Celadon cresceu em volta deste lugar.",
      "Dizem que o jardim do ginásio esconde sementes que nasceram aqui.",
    ]),
  },
  {
    id: "zelador",
    peopleId: "pt-gentleman",
    nome: "Horácio",
    sexo: "male",
    origem: "platinum",
    coluna: 22,
    x: 11,
    y: 8.5,
    fala: Object.freeze([
      "Eu cuido da entrada. O restante… prefiro não subir sozinho.",
      "Se ouvir passos no andar de cima, foi só o vento. Provavelmente.",
    ]),
  },
];

const livro = {
  tipo: "lore",
  nome: "Diário",
  x: 11,
  y: 2.8,
  alcance: 1.35,
  fala: Object.freeze([
    "Páginas amareladas: “As plantas respondem ao canto dos Pokémon…”",
    "A última linha está rasurada. Só dá pra ler: “Celadon não deve esquecer.”",
  ]),
};

const doorTx0 = 10;
const doorTx1 = 11;

const PLANTA = criarPlantaHub({
  papel: "mansao",
  origemX: ORIGEM_MANSAO_X,
  origemY: ORIGEM_MANSAO_Y,
  tilesX: COLS,
  tilesY: ROWS,
  anel: true,
  camada: camadaChao(),
  corParede: "#6b5a4e",
  corBalcao: "#c4b49a",
  saidas: [
    { tx: doorTx0, ty: ROWS - 1 },
    { tx: doorTx1, ty: ROWS - 1 },
  ],
  props: [
    ...npcs.map((n) => ({
      id: "npc",
      peopleId: n.peopleId,
      nome: n.nome,
      sexo: n.sexo,
      origem: n.origem,
      coluna: n.coluna,
      x: n.x,
      y: n.y,
      disco: true,
      raio: 0.38,
    })),
    { id: "estante", x: 3.2, y: 2.2, disco: true, raio: 0.7 },
    { id: "estante", x: 18.8, y: 2.2, disco: true, raio: 0.7 },
    { id: "mesa", x: livro.x, y: livro.y, disco: true, raio: 0.7 },
  ],
  alvos: [
    ...npcs.map((n) => ({
      tipo: "npc",
      nome: n.nome,
      x: n.x,
      y: n.y,
      alcance: 1.35,
      ref: {
        ...n,
        x: ORIGEM_MANSAO_X + n.x,
        y: ORIGEM_MANSAO_Y + n.y,
        z: ALTURA_PRACA,
        fala: n.fala,
      },
    })),
    {
      tipo: "lore",
      nome: livro.nome,
      x: livro.x,
      y: livro.y,
      alcance: livro.alcance,
      ref: {
        nome: livro.nome,
        x: ORIGEM_MANSAO_X + livro.x,
        y: ORIGEM_MANSAO_Y + livro.y,
        z: ALTURA_PRACA,
        fala: livro.fala,
      },
    },
  ],
});

PLANTA.balcoes = [
  { x: 9, y: 2, w: 4, h: 1 },
];

export function plantaMansao() {
  return PLANTA;
}

export function spawnMansao() {
  return PLANTA.spawn;
}

export function aplicarMansaoNoChunk(chunk) {
  return aplicarPlantaNoChunk(chunk, PLANTA);
}

export function naSaidaMansao(x, y) {
  return naSaidaPlanta(PLANTA, x, y);
}

export function alvoDaMansao(x, y) {
  return alvoDaPlanta(PLANTA, x, y);
}

export function promptDaMansao(alvo) {
  if (!alvo) return "";
  if (alvo.tipo === "npc") return alvo.nome || "Falar";
  if (alvo.tipo === "lore") return "Ler";
  return "";
}
