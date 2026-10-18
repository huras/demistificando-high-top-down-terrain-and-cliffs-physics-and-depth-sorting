/**
 * Atlas 512 do continente e tiles 256 do zoom perto.
 * O assado anda em fatias, pra abrir o mapa não travar o frame.
 */
import { EXTENSAO_KANTO } from "../../mundo/regiao/grafoKanto.js";
import { amostraMapa } from "./amostra.js";

export const LADO_ATLAS = 512;
export const PASSO_ATLAS = EXTENSAO_KANTO / LADO_ATLAS;
export const LADO_TILE = 256;
export const PASSO_TILE = 2;
export const LADO_TILE_MUNDO = LADO_TILE * PASSO_TILE;
export const GRADE_TILE = EXTENSAO_KANTO / LADO_TILE_MUNDO;

const FATIA_ATLAS = 8;
const FATIA_TILE = 20;
const LIMITE_TILES = 16;
const ZOOM_TILE = 0.42;

const pixel = { h: 0, u: 0, r: 0, g: 0, b: 0 };

let tela = null;
let ctx = null;
let img = null;
let alturas = null;
let costas = null;
let linha = 0;
let pronto = false;

/** @type {Map<string, object>} */
const tiles = new Map();
let assando = null;
let uso = 0;

function oceano(data) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 20;
    data[i + 1] = 62;
    data[i + 2] = 102;
    data[i + 3] = 255;
  }
}

function faixa(imgAlvo, altura, costa, y0, y1, lado, origemX, origemY, passo, comMote) {
  const data = imgAlvo.data;
  for (let y = y0; y < y1; y++) {
    const wy = origemY + (y + 0.5) * passo;
    const o = y * lado;
    for (let x = 0; x < lado; x++) {
      const wx = origemX + (x + 0.5) * passo;
      amostraMapa(wx, wy, comMote, pixel);
      const i = (o + x) * 4;
      data[i] = pixel.r;
      data[i + 1] = pixel.g;
      data[i + 2] = pixel.b;
      data[i + 3] = 255;
      altura[o + x] = pixel.h;
      costa[o + x] = pixel.u;
    }
  }
}

function sombrear(imgAlvo, altura, costa, y, lado, passo) {
  const data = imgAlvo.data;
  const yN = y > 0 ? y - 1 : y;
  const yS = y + 1 < lado ? y + 1 : y;
  const o = y * lado;
  const oN = yN * lado;
  const oS = yS * lado;
  const luzX = -0.55;
  const luzY = -0.55;
  const luzZ = 0.85;
  const luzLen = Math.hypot(luzX, luzY, luzZ);
  for (let x = 0; x < lado; x++) {
    const xW = x > 0 ? x - 1 : x;
    const xE = x + 1 < lado ? x + 1 : x;
    const u = costa[o + x];
    let dx = (altura[o + xE] - altura[o + xW]) / (2 * passo);
    let dy = (altura[oS + x] - altura[oN + x]) / (2 * passo);
    if (u < 0.34) {
      dx *= 0.15;
      dy *= 0.15;
    }
    const nx = -dx;
    const ny = -dy;
    const nz = 1;
    const len = Math.hypot(nx, ny, nz);
    const ndot = Math.max(0, (nx * luzX + ny * luzY + nz * luzZ) / (len * luzLen));
    let ganho = 0.58 + 0.55 * ndot;
    if (u < 0.34) ganho = 0.72 + 0.22 * (u / 0.34) + 0.12 * ndot;
    const i = (o + x) * 4;
    let r = data[i] * ganho;
    let g = data[i + 1] * ganho;
    let b = data[i + 2] * ganho;
    const uE = costa[o + xE];
    const uW = costa[o + xW];
    const uN = costa[oN + x];
    const uS = costa[oS + x];
    if (u < 0.5 && (uE > 0.72 || uW > 0.72 || uN > 0.72 || uS > 0.72)) {
      r += (232 - r) * 0.62;
      g += (238 - g) * 0.62;
      b += (228 - b) * 0.62;
    }
    data[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
}

export function iniciarAtlas() {
  if (tela) return;
  tela = document.createElement("canvas");
  tela.width = LADO_ATLAS;
  tela.height = LADO_ATLAS;
  ctx = tela.getContext("2d", { willReadFrequently: true });
  img = ctx.createImageData(LADO_ATLAS, LADO_ATLAS);
  oceano(img.data);
  alturas = new Float32Array(LADO_ATLAS * LADO_ATLAS);
  costas = new Float32Array(LADO_ATLAS * LADO_ATLAS);
  alturas.fill(8);
  ctx.putImageData(img, 0, 0);
}

export function tickAtlas() {
  if (!tela || pronto) return;
  const fim = Math.min(LADO_ATLAS, linha + FATIA_ATLAS);
  faixa(img, alturas, costas, linha, fim, LADO_ATLAS, 0, 0, PASSO_ATLAS, false);
  if (linha > 0) sombrear(img, alturas, costas, linha - 1, LADO_ATLAS, PASSO_ATLAS);
  for (let y = linha; y < fim - 1; y++) sombrear(img, alturas, costas, y, LADO_ATLAS, PASSO_ATLAS);
  linha = fim;
  if (linha >= LADO_ATLAS) {
    sombrear(img, alturas, costas, LADO_ATLAS - 1, LADO_ATLAS, PASSO_ATLAS);
    pronto = true;
  }
  ctx.putImageData(img, 0, 0);
}

export function atlasPronto() {
  return pronto;
}

export function canvasAtlas() {
  return tela;
}

function chave(tx, ty) {
  return `${tx},${ty}`;
}

function criarTile(tx, ty) {
  const canvas = document.createElement("canvas");
  canvas.width = LADO_TILE;
  canvas.height = LADO_TILE;
  const contexto = canvas.getContext("2d", { willReadFrequently: true });
  const imagem = contexto.createImageData(LADO_TILE, LADO_TILE);
  oceano(imagem.data);
  contexto.putImageData(imagem, 0, 0);
  return {
    tx,
    ty,
    chave: chave(tx, ty),
    canvas,
    ctx: contexto,
    img: imagem,
    alturas: new Float32Array(LADO_TILE * LADO_TILE),
    costas: new Float32Array(LADO_TILE * LADO_TILE),
    linhas: 0,
    pronto: false,
    visivel: false,
    uso: 0,
  };
}

function evict() {
  while (tiles.size > LIMITE_TILES) {
    let pior = null;
    for (const tile of tiles.values()) {
      if (tile === assando) continue;
      if (!pior || tile.uso < pior.uso) pior = tile;
    }
    if (!pior) return;
    tiles.delete(pior.chave);
    if (assando === pior) assando = null;
  }
}

function assarTile(tile) {
  const fim = Math.min(LADO_TILE, tile.linhas + FATIA_TILE);
  const ox = tile.tx * LADO_TILE_MUNDO;
  const oy = tile.ty * LADO_TILE_MUNDO;
  faixa(tile.img, tile.alturas, tile.costas, tile.linhas, fim, LADO_TILE, ox, oy, PASSO_TILE, true);
  if (tile.linhas > 0) sombrear(tile.img, tile.alturas, tile.costas, tile.linhas - 1, LADO_TILE, PASSO_TILE);
  for (let y = tile.linhas; y < fim - 1; y++) {
    sombrear(tile.img, tile.alturas, tile.costas, y, LADO_TILE, PASSO_TILE);
  }
  tile.linhas = fim;
  if (tile.linhas >= LADO_TILE) {
    sombrear(tile.img, tile.alturas, tile.costas, LADO_TILE - 1, LADO_TILE, PASSO_TILE);
    tile.pronto = true;
    assando = null;
  }
  tile.ctx.putImageData(tile.img, 0, 0);
}

function escolher(cx, cy) {
  let melhor = null;
  let nota = Infinity;
  for (const tile of tiles.values()) {
    if (!tile.visivel || tile.pronto) continue;
    const mx = (tile.tx + 0.5) * LADO_TILE_MUNDO;
    const my = (tile.ty + 0.5) * LADO_TILE_MUNDO;
    const d = (mx - cx) * (mx - cx) + (my - cy) * (my - cy);
    if (d < nota) {
      nota = d;
      melhor = tile;
    }
  }
  return melhor;
}

export function tickTiles(cx, cy, zoom, x0, y0, x1, y1) {
  if (!pronto || zoom < ZOOM_TILE) {
    for (const tile of tiles.values()) tile.visivel = false;
    return;
  }
  const tx0 = Math.max(0, Math.floor(x0 / LADO_TILE_MUNDO));
  const ty0 = Math.max(0, Math.floor(y0 / LADO_TILE_MUNDO));
  const tx1 = Math.min(GRADE_TILE - 1, Math.floor(x1 / LADO_TILE_MUNDO));
  const ty1 = Math.min(GRADE_TILE - 1, Math.floor(y1 / LADO_TILE_MUNDO));
  const quer = new Set();
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const k = chave(tx, ty);
      quer.add(k);
      let tile = tiles.get(k);
      if (!tile) {
        tile = criarTile(tx, ty);
        tiles.set(k, tile);
        evict();
      }
      tile.visivel = true;
      tile.uso = ++uso;
    }
  }
  for (const tile of tiles.values()) {
    if (!quer.has(tile.chave)) tile.visivel = false;
  }
  if (!assando || assando.pronto || !assando.visivel) assando = escolher(cx, cy);
  if (assando) assarTile(assando);
}

export function listarTiles() {
  const lista = [];
  for (const tile of tiles.values()) {
    if (tile.linhas > 0) lista.push(tile);
  }
  return lista;
}
