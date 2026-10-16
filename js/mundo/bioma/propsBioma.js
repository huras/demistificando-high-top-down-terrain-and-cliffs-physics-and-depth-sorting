import { CHUNK_XZ } from "../../config.js";
import { indexarBases, limparBases } from "../../fisica/obstaculos.js";

/** Vegetação procedural por chunk carregado. */

/** @type {Map<string, object[]>} */
const porChunk = new Map();

function chave(cx, cy) {
  return `${cx | 0},${cy | 0}`;
}

export function definirPropsChunk(cx, cy, lista) {
  porChunk.set(chave(cx, cy), lista || []);
  indexarBases(cx, cy, lista);
}

export function limparPropsChunk(cx, cy) {
  porChunk.delete(chave(cx, cy));
  limparBases(cx, cy);
}

export function propPorId(id) {
  const m = /^v(-?\d+)_(-?\d+)$/.exec(id || "");
  if (!m) return null;
  const wx = Number(m[1]);
  const wy = Number(m[2]);
  const lista = porChunk.get(chave(Math.floor(wx / CHUNK_XZ), Math.floor(wy / CHUNK_XZ)));
  if (!lista) return null;
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].id === id) return lista[i];
  }
  return null;
}

export function reindexarEm(x, y) {
  const cx = Math.floor(x / CHUNK_XZ);
  const cy = Math.floor(y / CHUNK_XZ);
  const lista = porChunk.get(chave(cx, cy));
  if (lista) indexarBases(cx, cy, lista);
}

export function vegetacaoNaArea(x0, y0, x1, y1) {
  const saida = [];
  for (const lista of porChunk.values()) {
    for (let i = 0; i < lista.length; i++) {
      const p = lista[i];
      if (p.x >= x0 && p.x <= x1 + 1 && p.y >= y0 - 2 && p.y <= y1 + 2) {
        saida.push(p);
      }
    }
  }
  return saida;
}

export function todaVegetacao() {
  const saida = [];
  for (const lista of porChunk.values()) {
    for (let i = 0; i < lista.length; i++) saida.push(lista[i]);
  }
  return saida;
}

/** Chunks que já têm a lista de props do perto. O impostor distante sai desses. */
export function chunksComProps() {
  return new Set(porChunk.keys());
}
