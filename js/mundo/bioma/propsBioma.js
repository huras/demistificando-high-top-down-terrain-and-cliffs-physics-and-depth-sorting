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

/** Lista viva do chunk (mutável) — ou null se ainda não gerou props. */
export function propsDoChunk(cx, cy) {
  return porChunk.get(chave(cx, cy)) || null;
}

export function limparPropsChunk(cx, cy) {
  porChunk.delete(chave(cx, cy));
  limparBases(cx, cy);
}

export function propPorId(id) {
  if (!id) return null;
  const m = /^[vb](-?\d+)_(-?\d+)$/.exec(id);
  if (m) {
    const wx = Number(m[1]);
    const wy = Number(m[2]);
    const lista = porChunk.get(chave(Math.floor(wx / CHUNK_XZ), Math.floor(wy / CHUNK_XZ)));
    if (!lista) return null;
    for (let i = 0; i < lista.length; i++) {
      if (lista[i].id === id) return lista[i];
    }
    return null;
  }
  // Letras / santuário / ids estáveis: varre chunks carregados.
  for (const lista of porChunk.values()) {
    for (let i = 0; i < lista.length; i++) {
      if (lista[i].id === id) return lista[i];
    }
  }
  return null;
}

export function reindexarEm(x, y) {
  const cx = Math.floor(x / CHUNK_XZ);
  const cy = Math.floor(y / CHUNK_XZ);
  const lista = porChunk.get(chave(cx, cy));
  if (lista) indexarBases(cx, cy, lista);
}

/**
 * Após carregar/arremessar, x/y mudam mas a prop continua na lista do chunk
 * de spawn. Sem isso, consultas por chunk (trampolim, hover, raio) não acham.
 */
export function sincronizarPropChunk(prop) {
  if (!prop || !Number.isFinite(prop.x) || !Number.isFinite(prop.y)) return;
  const ncx = Math.floor(prop.x / CHUNK_XZ) | 0;
  const ncy = Math.floor(prop.y / CHUNK_XZ) | 0;
  let listaAtual = null;
  let cxAtual = 0;
  let cyAtual = 0;
  for (const [k, lista] of porChunk) {
    const i = lista.indexOf(prop);
    if (i < 0) continue;
    listaAtual = lista;
    const virg = k.indexOf(",");
    cxAtual = Number(k.slice(0, virg));
    cyAtual = Number(k.slice(virg + 1));
    break;
  }
  if (listaAtual && cxAtual === ncx && cyAtual === ncy) {
    indexarBases(ncx, ncy, listaAtual);
    return;
  }
  if (listaAtual) {
    const i = listaAtual.indexOf(prop);
    if (i >= 0) listaAtual.splice(i, 1);
    indexarBases(cxAtual, cyAtual, listaAtual);
  }
  const dest = porChunk.get(chave(ncx, ncy));
  if (!dest) return;
  if (dest.indexOf(prop) < 0) dest.push(prop);
  indexarBases(ncx, ncy, dest);
}

export function vegetacaoNaArea(x0, y0, x1, y1) {
  const saida = [];
  visitarVegetacaoNaArea(x0, y0, x1, y1, (p) => {
    saida.push(p);
  });
  return saida;
}

/** Visita props na caixa sem alocar lista. */
export function visitarVegetacaoNaArea(x0, y0, x1, y1, fn) {
  for (const lista of porChunk.values()) {
    for (let i = 0; i < lista.length; i++) {
      const p = lista[i];
      if (p.x >= x0 && p.x <= x1 + 1 && p.y >= y0 - 2 && p.y <= y1 + 2) fn(p);
    }
  }
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
