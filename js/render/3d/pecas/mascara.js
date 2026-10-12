import { CHUNK_XZ } from "../../../config.js";
import { alturaEm } from "../../../mundo/altura.js";
import { LESTE, NORTE, OESTE, SUL } from "./catalogo.js";

const N = CHUNK_XZ + 2;

/** Id da peça. A máscara já é o índice: cada combinação de borda é uma peça. */
const ID_PECA = new Uint8Array(16);
for (let i = 0; i < 16; i++) ID_PECA[i] = i;

export function idDaPeca(mascara) {
  return ID_PECA[mascara & 15];
}

/** Alturas do chunk e da moldura de 1 célula. Uma leitura por coluna. */
export function gradeDoChunk(cx, cy) {
  const h = new Int16Array(N * N);
  const x0 = cx * CHUNK_XZ - 1;
  const y0 = cy * CHUNK_XZ - 1;
  for (let y = 0; y < N; y++) {
    const linha = y * N;
    const wy = y0 + y;
    for (let x = 0; x < N; x++) h[linha + x] = alturaEm(x0 + x, wy) | 0;
  }
  return h;
}

export function alturaLocal(grade, lx, ly) {
  return grade[(ly + 1) * N + (lx + 1)];
}

export function mascaraLocal(grade, lx, ly) {
  const i = (ly + 1) * N + (lx + 1);
  const z = grade[i];
  let m = 0;
  if (grade[i + N] < z) m |= SUL;
  if (grade[i - N] < z) m |= NORTE;
  if (grade[i + 1] < z) m |= LESTE;
  if (grade[i - 1] < z) m |= OESTE;
  return m;
}

export function alturaVizinha(grade, lx, ly, bit) {
  const i = (ly + 1) * N + (lx + 1);
  if (bit === SUL) return grade[i + N];
  if (bit === NORTE) return grade[i - N];
  if (bit === LESTE) return grade[i + 1];
  return grade[i - 1];
}
