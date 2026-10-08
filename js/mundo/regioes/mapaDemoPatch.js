/**
 * Heightmap autoral da demo — patch sobre o gen procedural.
 */
import { CHUNK_XZ } from "../../config.js";
import { aplicarAguaDemo } from "../autor/agua.js";
import { aplicarDeckRetangular, DECK_CUMES } from "../autor/ponte.js";
import { preencherColunaSolida } from "../voxel/chunk.js";

export const COLUNAS = 84;
export const LINHAS = 60;
export const PATCH_ORIGEM_X = 0;
export const PATCH_ORIGEM_Y = 0;

function criarGrade(cols, rows, base = 1) {
  const g = new Array(rows);
  for (let y = 0; y < rows; y++) {
    const row = new Array(cols);
    for (let x = 0; x < cols; x++) row[x] = base;
    g[y] = row;
  }
  return g;
}

function preencher(g, x0, y0, x1, y1, z) {
  const rows = g.length;
  const cols = g[0].length;
  const xa = Math.max(0, Math.min(x0, x1));
  const xb = Math.min(cols - 1, Math.max(x0, x1));
  const ya = Math.max(0, Math.min(y0, y1));
  const yb = Math.min(rows - 1, Math.max(y0, y1));
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) g[y][x] = z;
  }
}

function pilar(g, x, y, z) {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = z;
}

function montanhaMinecraft(g, cx0, cy0, cx1, cy1, topZ, passoNorte = 1) {
  const degraus = topZ - 1;
  const passo = Math.max(1, passoNorte | 0);
  const yMin = cy0 - (degraus - 1) * passo;
  const yMax = cy1 + (degraus - 1);
  const xMin = cx0 - (degraus - 1);

  for (let y = yMin; y <= yMax; y++) {
    for (let x = xMin; x <= cx1; x++) {
      if (y < 0 || y >= g.length || x < 0 || x >= g[0].length) continue;
      const dx = x < cx0 ? cx0 - x : 0;
      const dyN = y < cy0 ? Math.ceil((cy0 - y) / passo) : 0;
      const dyS = y > cy1 ? y - cy1 : 0;
      const dist = Math.max(dx, dyN, dyS);
      const z = topZ - dist;
      if (z > 1) g[y][x] = Math.max(g[y][x], z);
    }
  }
  preencher(g, cx0, cy0, cx1, cy1, topZ);
}

export function gerarAlturaDemo() {
  const g = criarGrade(COLUNAS, LINHAS, 1);

  preencher(g, 3, 2, 12, 6, 2);
  preencher(g, 7, 5, 10, 8, 3);

  preencher(g, 16, 2, 24, 4, 2);
  preencher(g, 16, 2, 18, 8, 2);

  preencher(g, 28, 2, 38, 8, 2);
  preencher(g, 30, 4, 36, 8, 1);

  preencher(g, 2, 11, 8, 18, 2);
  preencher(g, 3, 12, 7, 17, 3);
  preencher(g, 4, 13, 6, 16, 4);

  preencher(g, 14, 12, 20, 15, 2);

  preencher(g, 24, 12, 30, 14, 2);
  preencher(g, 31, 12, 37, 14, 3);

  preencher(g, 4, 22, 10, 24, 2);
  preencher(g, 6, 20, 8, 26, 2);

  preencher(g, 14, 20, 22, 27, 2);
  preencher(g, 16, 22, 20, 25, 1);

  preencher(g, 26, 20, 38, 28, 2);
  preencher(g, 28, 22, 36, 26, 1);
  pilar(g, 30, 23, 3);
  pilar(g, 33, 24, 3);
  pilar(g, 32, 22, 2);

  preencher(g, 34, 10, 40, 11, 2);
  preencher(g, 35, 12, 40, 13, 2);
  preencher(g, 36, 14, 40, 15, 3);
  preencher(g, 37, 16, 40, 17, 3);

  pilar(g, 1, 1, 3);
  pilar(g, 40, 1, 2);
  pilar(g, 1, 30, 2);
  pilar(g, 40, 30, 3);

  preencher(g, 12, 10, 12, 28, 2);

  montanhaMinecraft(g, 48, 34, 51, 37, 17, 1);
  montanhaMinecraft(g, 72, 34, 75, 37, 17, 2);

  return g;
}

let _alturasCache = null;
export function obterAlturasDemo() {
  if (!_alturasCache) _alturasCache = gerarAlturaDemo();
  return _alturasCache;
}

/** Compat: array estático (mesma referência). */
export const ALTURAS = obterAlturasDemo();

export const SPAWN = { x: 17.5, y: 11.2, z: 1 };

export const PROPS = [
  { id: "arv-atras", x: 17.5, y: 11.4, tipo: "arvore" },
  { id: "mata-atras", x: 16.3, y: 11.5, tipo: "mata" },
  { id: "placa-sort", x: 17.5, y: 11.9, tipo: "placa", texto: "ATRÁS" },
  { id: "pedra-frente", x: 17.5, y: 16.3, tipo: "pedra" },
  { id: "placa-frente", x: 19.2, y: 16.3, tipo: "placa", texto: "FRENTE" },

  { id: "placa-torre", x: 8.5, y: 9.2, tipo: "placa", texto: "TORRE" },
  { id: "placa-L", x: 17.5, y: 9.2, tipo: "placa", texto: "L-CÔNC" },
  { id: "placa-U", x: 33.5, y: 9.2, tipo: "placa", texto: "ALCOVA" },
  { id: "placa-pir", x: 5.5, y: 19.2, tipo: "placa", texto: "PIRÂM" },
  { id: "placa-1-2", x: 28.5, y: 15.3, tipo: "placa", texto: "1→2 SUL" },
  { id: "placa-cruz", x: 7.5, y: 27.3, tipo: "placa", texto: "CRUZ" },
  { id: "placa-anel", x: 18.5, y: 28.3, tipo: "placa", texto: "ANEL" },
  { id: "placa-canion", x: 32.5, y: 29.3, tipo: "placa", texto: "CÂNION" },
  { id: "placa-escada", x: 38.5, y: 18.3, tipo: "placa", texto: "ESCADA" },
  { id: "placa-muro", x: 12.5, y: 14.5, tipo: "placa", texto: "MURO" },

  { id: "placa-mc-leste", x: 51.6, y: 34.2, tipo: "placa", texto: "MURO×16" },
  { id: "placa-mc-cume", x: 49.5, y: 35.5, tipo: "placa", texto: "CUME×1" },
  { id: "placa-mc-n", x: 49.5, y: 20.4, tipo: "placa", texto: "ESC N×1" },
  { id: "placa-mc-s", x: 49.5, y: 50.4, tipo: "placa", texto: "ESC S" },

  { id: "placa-ponte", x: 61.5, y: 35.5, tipo: "placa", texto: "PONTE" },
  { id: "placa-void", x: 61.5, y: 37.4, tipo: "placa", texto: "VOID↓" },

  { id: "placa-mc2-leste", x: 76.4, y: 35.5, tipo: "placa", texto: "MURO×16" },
  { id: "placa-mc2-cume", x: 73.5, y: 35.5, tipo: "placa", texto: "CUME×2" },
  { id: "placa-mc2-n", x: 73.5, y: 5.4, tipo: "placa", texto: "ESC N×2" },
  { id: "placa-mc2-s", x: 73.5, y: 50.4, tipo: "placa", texto: "ESC S" },

  { id: "arv-a", x: 35.2, y: 3.5, tipo: "arvore" },
  { id: "mata-a", x: 34.2, y: 3.8, tipo: "mata" },
  { id: "pedra-a", x: 4.5, y: 4.6, tipo: "pedra" },

  { id: "placa-lago", x: 10.5, y: 23.4, tipo: "placa", texto: "LAGO" },
];

/** Sobrescreve colunas do chunk que caem no retângulo autoral. */
export function aplicarPatchDemo(chunk, alturas = ALTURAS) {
  const baseX = chunk.cx * CHUNK_XZ;
  const baseY = chunk.cy * CHUNK_XZ;
  let tocado = false;
  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const wx = baseX + lx - PATCH_ORIGEM_X;
      const wy = baseY + ly - PATCH_ORIGEM_Y;
      if (wx < 0 || wy < 0 || wx >= COLUNAS || wy >= LINHAS) continue;
      preencherColunaSolida(chunk, lx, ly, alturas[wy][wx] | 0);
      tocado = true;
    }
  }
  // 2ª passagem: deck overhang entre cumes (ar embaixo; não altera heightmap).
  if (aplicarDeckRetangular(chunk, DECK_CUMES)) tocado = true;
  if (aplicarAguaDemo(chunk)) tocado = true;
  return tocado;
}
