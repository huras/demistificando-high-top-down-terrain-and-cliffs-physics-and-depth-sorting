/**
 * Índice O(1) de tiles ocupados por construções do jogador.
 */

/** @type {Set<string>} */
const tiles = new Set();

let versao = 0;

export function versaoOcupacao() {
  return versao;
}

function chave(tx, ty) {
  return `${tx | 0},${ty | 0}`;
}

export function limparOcupacao() {
  tiles.clear();
  versao++;
}

/**
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 */
export function marcarRetangulo(x0, y0, x1, y1) {
  const ax = Math.floor(x0);
  const ay = Math.floor(y0);
  const bx = Math.ceil(x1);
  const by = Math.ceil(y1);
  for (let y = ay; y < by; y++) {
    for (let x = ax; x < bx; x++) tiles.add(chave(x, y));
  }
  versao++;
}

/**
 * @param {number} tx
 * @param {number} ty
 */
export function tileOcupado(tx, ty) {
  return tiles.has(chave(tx, ty));
}

/**
 * @param {number} wx
 * @param {number} wy
 */
export function pontoOcupado(wx, wy) {
  return tiles.has(chave(Math.floor(wx), Math.floor(wy)));
}

/**
 * Reconstrói a partir das estruturas atuais.
 * @param {import("./estruturas.js").BundleLike[]} bundles
 */
export function reconstruirOcupacao(bundles) {
  tiles.clear();
  for (const bundle of bundles || []) {
    for (const h of bundle.houses || []) {
      const cols = h.cols | 0 || 6;
      const rows = h.rows | 0 || 5;
      const x0 = h.x - cols / 2;
      const y0 = h.y - rows / 2;
      marcarRetangulo(x0, y0, x0 + cols, y0 + rows);
    }
    for (const f of bundle.outdoorFurniture || []) {
      marcarRetangulo(f.x, f.y, (f.x | 0) + (f.cols || 1), (f.y | 0) + (f.rows || 1));
    }
    for (const c of bundle.fences || []) {
      tiles.add(chave(c.tx, c.ty));
    }
  }
  versao++;
}
