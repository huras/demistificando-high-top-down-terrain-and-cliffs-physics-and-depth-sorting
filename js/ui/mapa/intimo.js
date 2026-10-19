/**
 * Zoom íntimo. A máscara é um byte por bloco; o tufo
 * nasce num canvas de 128 blocos e fica em cache.
 */
import {
  COPA,
  GRAMA_CAMPO,
  MOTE_ARVORE,
  MOTE_GRAMA,
  lerVeg,
} from "./coresVeg.js";
import {
  BLOCOS_INTIMO,
  GRADE_INTIMO,
  LADO_INTIMO,
  LADO_MUNDO,
  PASTA_MAPA,
  TEXEL_INTIMO,
  ZOOM_INTIMO,
} from "./grade.js";

const FOLGA = 6;

const TUFO_GRAMA = [
  [0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0],
  [0, 0, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0],
  [1, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0],
  [0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 0],
];

const TUFO_ARVORE = [
  [0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0],
  [1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0],
  [0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0],
];

/** @type {Uint8Array | null} */
let veg = null;
let pedido = null;

/** @type {Map<string, object>} */
const tiles = new Map();
let uso = 0;

function carregarVeg() {
  if (veg || pedido) return;
  const url = `${PASTA_MAPA}/veg.bin`;
  pedido = fetch(url)
    .then((res) => {
      if (!res.ok || !res.body) throw new Error(url);
      return new Response(res.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
    })
    .then((buf) => {
      const dados = new Uint8Array(buf);
      if (dados.length !== LADO_MUNDO * LADO_MUNDO) throw new Error("veg.bin");
      veg = dados;
    })
    .catch((err) => {
      pedido = null;
      console.error("Mapa prebuild ausente:", url, err);
    });
}

function pintarKernel(data, bx, by, kernel, cor, alfa) {
  const x0 = bx * TEXEL_INTIMO;
  const y0 = by * TEXEL_INTIMO;
  for (let i = 0; i < 16; i++) {
    if (!kernel[i]) continue;
    const x = x0 + (i & 3);
    const y = y0 + (i >> 2);
    const o = (y * LADO_INTIMO + x) * 4;
    data[o] = cor[0];
    data[o + 1] = cor[1];
    data[o + 2] = cor[2];
    data[o + 3] = alfa;
  }
}

function compor(ox, oy) {
  const tela = document.createElement("canvas");
  tela.width = LADO_INTIMO;
  tela.height = LADO_INTIMO;
  const ctx = tela.getContext("2d");
  const img = ctx.createImageData(LADO_INTIMO, LADO_INTIMO);
  const data = img.data;
  for (let by = 0; by < BLOCOS_INTIMO; by++) {
    const wy = oy + by;
    const linha = wy * LADO_MUNDO;
    for (let bx = 0; bx < BLOCOS_INTIMO; bx++) {
      const byte = veg[linha + ox + bx];
      if (!byte) continue;
      const info = lerVeg(byte);
      const wx = ox + bx;
      if (info.grama > 0) {
        const kernel = TUFO_GRAMA[(wx * 13 + wy * 7) & 3];
        const cor = info.moteGrama ? MOTE_GRAMA : GRAMA_CAMPO;
        const alfa = info.moteGrama ? 235 : 120 + Math.round(info.grama * 100);
        pintarKernel(data, bx, by, kernel, cor, alfa);
      }
      if (info.arvore > 0) {
        const kernel = TUFO_ARVORE[(wx * 3 + wy) & 3];
        const cor = info.moteArvore ? MOTE_ARVORE : COPA;
        const alfa = info.moteArvore ? 245 : 150 + Math.round(info.arvore * 100);
        pintarKernel(data, bx, by, kernel, cor, alfa);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return tela;
}

function enxugar() {
  const sobra = [];
  for (const tile of tiles.values()) {
    if (!tile.visivel) sobra.push(tile);
  }
  sobra.sort((a, b) => a.uso - b.uso);
  while (sobra.length > FOLGA) tiles.delete(sobra.shift().chave);
}

function maisPerto(cx, cy) {
  let melhor = null;
  let nota = Infinity;
  for (const tile of tiles.values()) {
    if (!tile.visivel || tile.canvas) continue;
    const mx = tile.ox + BLOCOS_INTIMO * 0.5;
    const my = tile.oy + BLOCOS_INTIMO * 0.5;
    const d = (mx - cx) * (mx - cx) + (my - cy) * (my - cy);
    if (d < nota) {
      nota = d;
      melhor = tile;
    }
  }
  return melhor;
}

export function tickIntimo(cx, cy, zoom, x0, y0, x1, y1) {
  if (zoom < ZOOM_INTIMO) {
    for (const tile of tiles.values()) tile.visivel = false;
    enxugar();
    return;
  }
  carregarVeg();
  const tx0 = Math.max(0, Math.floor(x0 / BLOCOS_INTIMO));
  const ty0 = Math.max(0, Math.floor(y0 / BLOCOS_INTIMO));
  const tx1 = Math.min(GRADE_INTIMO - 1, Math.floor((x1 - 0.001) / BLOCOS_INTIMO));
  const ty1 = Math.min(GRADE_INTIMO - 1, Math.floor((y1 - 0.001) / BLOCOS_INTIMO));
  const quer = new Set();
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const chave = `${tx},${ty}`;
      quer.add(chave);
      let tile = tiles.get(chave);
      if (!tile) {
        tile = { chave, ox: tx * BLOCOS_INTIMO, oy: ty * BLOCOS_INTIMO, canvas: null, visivel: false, uso: 0 };
        tiles.set(chave, tile);
      }
      tile.visivel = true;
      tile.uso = ++uso;
    }
  }
  for (const tile of tiles.values()) {
    if (!quer.has(tile.chave)) tile.visivel = false;
  }
  enxugar();
  if (!veg) return;
  const tile = maisPerto(cx, cy);
  if (tile) tile.canvas = compor(tile.ox, tile.oy);
}

export function listarIntimos() {
  const lista = [];
  for (const tile of tiles.values()) {
    if (tile.visivel && tile.canvas) lista.push(tile);
  }
  return lista;
}
