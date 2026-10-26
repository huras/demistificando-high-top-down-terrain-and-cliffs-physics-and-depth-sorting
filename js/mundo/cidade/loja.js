/**
 * Poké Mart. Planta Emerald na mesma escala de tile (1 célula = 1 tile);
 * sala ampliada (~4× área) com fileiras de prateleira-billboard.
 * Prateleira NÃO marca colisão de balcão — senão o chão some (buraco).
 * Colisão das prateleiras = disco, igual estante do lab/centro.
 */
import { gradeDe, criarPlantaHub, aplicarPlantaNoChunk, naSaidaPlanta, alvoDaPlanta } from "./plantaHub.js";

export const ORIGEM_LOJA_X = 100256;
export const ORIGEM_LOJA_Y = 100512;

const S = 1;
const COLS = 22;
const ROWS = 16;

function meio(tx, ty) {
  return { x: (tx + 0.5) * S, y: (ty + 0.5) * S };
}

/** Parede + L do balcão. Prateleiras ficam `.` (chão) — disco no prop. */
const COLISAO = gradeDe(`
######################
######################
..#...................
..#...................
###...................
......................
......................
......................
......................
......................
......................
......................
......................
......................
......................
......................
`);

/** Chão base (0) + arte do mart original no canto NO + tapete de saída. */
function montarCamada() {
  const g = [];
  for (let y = 0; y < ROWS; y++) {
    const linha = [];
    for (let x = 0; x < COLS; x++) linha.push(0);
    g.push(linha);
  }
  // Bloco Emerald original 11×8 (canto noroeste) — sem os ## de prateleira no chão.
  const orig = [
    [8, 21, 9, 10, 10, 10, 22, 23, 22, 23, 12],
    [15, 42, 27, 16, 16, 16, 25, 26, 25, 26, 18],
    [19, 4, 33, 6, 4, 4, 31, 32, 20, 32, 24],
    [43, 36, 37, 3, 0, 0, 0, 0, 0, 0, 30],
    [44, 40, 41, 3, 0, 0, 0, 0, 0, 0, 28],
    [5, 4, 4, 1, 0, 0, 0, 0, 0, 0, 34],
    [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 38],
    [11, 0, 0, 0, 0, 0, 7, 4, 1, 0, 17],
  ];
  for (let y = 0; y < orig.length; y++) {
    for (let x = 0; x < orig[y].length; x++) g[y][x] = orig[y][x];
  }
  // Extensão: borda + chão contínuo.
  for (let y = 0; y < ROWS; y++) {
    g[y][0] = y < 2 ? 8 : y === ROWS - 1 ? 11 : 5;
    g[y][COLS - 1] = y < 2 ? 12 : y === ROWS - 1 ? 17 : 30;
  }
  for (let x = 1; x < COLS - 1; x++) {
    if (x >= orig[0].length) {
      g[0][x] = 10;
      g[1][x] = 16;
    }
    g[ROWS - 1][x] = 1;
  }
  // Tapete de saída no sul (centro).
  const doorX = (COLS >> 1) - 1;
  g[ROWS - 1][doorX] = 13;
  g[ROWS - 1][doorX + 1] = 14;
  return Object.freeze(g.map((l) => Object.freeze(l)));
}

const CAMADA = montarCamada();

const clerk = meio(1, 3);
/** Lado do cliente — leste/sul do L do balcão. */
const balcaoA = meio(3, 3);
const balcaoB = meio(3, 4);
const balcaoC = meio(2, 5);

/** Só o L do balcão vira caixa 3D. */
const BALCOES_VISUAIS = [
  { x: 2, y: 2, w: 1, h: 2 },
  { x: 1, y: 4, w: 2, h: 1 },
];

/**
 * Tiles FG da prateleira de produtos (ids originais do mart nas células 6–7,4–5).
 * Não ler da camada do chão — lá viraram 0 e o billboard saía transparente.
 */
const TILES_PRATELEIRA = Object.freeze([
  Object.freeze([28, 29]),
  Object.freeze([34, 35]),
]);

/** Fileiras de prateleiras (billboard + disco), como estantes do lab/centro. */
function prateleiras() {
  const lista = [];
  const colsPrat = [14, 17, 20];
  const rowsPrat = [4, 7, 10, 13];
  for (let r = 0; r < rowsPrat.length; r++) {
    for (let c = 0; c < colsPrat.length; c++) {
      const tx = colsPrat[c];
      const ty = rowsPrat[r];
      lista.push({
        id: "prateleira",
        x: tx * S,
        y: ty * S,
        tiles: TILES_PRATELEIRA,
        disco: true,
        raio: 0.72,
      });
    }
  }
  return lista;
}

const doorTx0 = (COLS >> 1) - 1;
const doorTx1 = doorTx0 + 1;

const PLANTA = criarPlantaHub({
  papel: "loja",
  origemX: ORIGEM_LOJA_X,
  origemY: ORIGEM_LOJA_Y,
  tilesX: COLS,
  tilesY: ROWS,
  colisao: COLISAO,
  camada: CAMADA,
  corParede: "#b7d7c0",
  corBalcao: "#e7f0ff",
  saidas: [
    { tx: doorTx0, ty: ROWS - 1 },
    { tx: doorTx1, ty: ROWS - 1 },
  ],
  props: [
    {
      id: "npc",
      peopleId: "pt-shopkeeper-m",
      coluna: 2,
      x: clerk.x,
      y: clerk.y - 0.1,
      nome: "Balconista",
      sexo: "male",
      origem: "platinum",
      disco: true,
      raio: 0.36,
    },
    ...prateleiras(),
  ],
  alvos: [
    { tipo: "loja", nome: "Balcão", x: balcaoA.x, y: balcaoA.y, alcance: 1.65 },
    { tipo: "loja", nome: "Balcão", x: balcaoB.x, y: balcaoB.y, alcance: 1.65 },
    { tipo: "loja", nome: "Balcão", x: balcaoC.x, y: balcaoC.y, alcance: 1.55 },
  ],
});

PLANTA.balcoes = BALCOES_VISUAIS;

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
  if (alvo.tipo === "loja") return "Balcão — E";
  return "";
}
