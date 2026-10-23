/**
 * Carrega o terreno assado. A visão cobre o overworld inteiro;
 * os tiles de perto entram no mapa grande e no minimapa quando o zoom ≥ ZOOM_TILE.
 * O manifesto valida semente/lado no boot.
 */
import {
  GRADE_TILE,
  LADO_MUNDO,
  LADO_TILE,
  LADO_TILE_MUNDO,
  PASTA_MAPA,
  SEMENTE_MAPA,
  ZOOM_TILE,
} from "./grade.js";

const FOLGA_INVISIVEL = 6;
const VOOS = 2;

let visao = null;
let visaoPedida = false;
let manifestoOk = false;

/** @type {Map<string, object>} */
const tiles = new Map();
const avisados = new Set();
let uso = 0;
let emVoo = 0;

function avisar(url, err) {
  if (avisados.has(url)) return;
  avisados.add(url);
  console.error("Mapa prebuild ausente:", url, err || "");
}

function carregar(url) {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(url);
    return res.blob();
  }).then((blob) => createImageBitmap(blob));
}

function validarManifesto(meta) {
  if (!meta || typeof meta !== "object") throw new Error("manifesto inválido");
  if ((meta.ladoMundo | 0) !== LADO_MUNDO) {
    throw new Error(`manifesto ladoMundo=${meta.ladoMundo} ≠ ${LADO_MUNDO}`);
  }
  if ((meta.semente | 0) !== SEMENTE_MAPA) {
    console.warn(`Mapa semente ${meta.semente} ≠ runtime ${SEMENTE_MAPA}`);
  }
  if ((meta.grade | 0) !== GRADE_TILE) {
    throw new Error(`manifesto grade=${meta.grade} ≠ ${GRADE_TILE}`);
  }
  manifestoOk = true;
}

export function iniciarAtlas() {
  if (visaoPedida) return;
  visaoPedida = true;
  const metaUrl = `${PASTA_MAPA}/manifesto.json`;
  fetch(metaUrl, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error(metaUrl);
      return res.json();
    })
    .then((meta) => {
      validarManifesto(meta);
      const url = `${PASTA_MAPA}/visao.png`;
      return carregar(url).then((bmp) => {
        visao = bmp;
      });
    })
    .catch((err) => avisar(metaUrl, err));
}

export function manifestoPronto() {
  return manifestoOk;
}

export function tickAtlas() {}

export function atlasPronto() {
  return !!visao;
}

export function canvasAtlas() {
  return visao;
}

function chave(tx, ty) {
  return `${tx},${ty}`;
}

function soltar(tile) {
  if (tile.bitmap) tile.bitmap.close();
  tile.bitmap = null;
  tile.canvas = null;
  tile.linhas = 0;
  tiles.delete(tile.chave);
}

function enxugar() {
  const sobra = [];
  for (const tile of tiles.values()) {
    if (!tile.visivel && !tile.carregando) sobra.push(tile);
  }
  sobra.sort((a, b) => a.uso - b.uso);
  while (sobra.length > FOLGA_INVISIVEL) soltar(sobra.shift());
}

function pedir(tile) {
  tile.carregando = true;
  emVoo += 1;
  const url = `${PASTA_MAPA}/perto/${tile.tx}_${tile.ty}.png`;
  carregar(url)
    .then((bmp) => {
      emVoo -= 1;
      tile.carregando = false;
      if (!tiles.has(tile.chave)) {
        bmp.close();
        return;
      }
      tile.bitmap = bmp;
      tile.canvas = bmp;
      tile.linhas = LADO_TILE;
    })
    .catch((err) => {
      emVoo -= 1;
      tile.carregando = false;
      tile.falhou = true;
      avisar(url, err);
    });
}

function bombear(cx, cy) {
  while (emVoo < VOOS) {
    let melhor = null;
    let nota = Infinity;
    for (const tile of tiles.values()) {
      if (!tile.visivel || tile.bitmap || tile.carregando || tile.falhou) continue;
      const mx = (tile.tx + 0.5) * LADO_TILE_MUNDO;
      const my = (tile.ty + 0.5) * LADO_TILE_MUNDO;
      const d = (mx - cx) * (mx - cx) + (my - cy) * (my - cy);
      if (d < nota) {
        nota = d;
        melhor = tile;
      }
    }
    if (!melhor) return;
    pedir(melhor);
  }
}

export function tickTiles(cx, cy, zoom, x0, y0, x1, y1) {
  if (!visao || zoom < ZOOM_TILE) {
    for (const tile of tiles.values()) tile.visivel = false;
    enxugar();
    return;
  }
  const tx0 = Math.max(0, Math.floor(x0 / LADO_TILE_MUNDO));
  const ty0 = Math.max(0, Math.floor(y0 / LADO_TILE_MUNDO));
  const tx1 = Math.min(GRADE_TILE - 1, Math.floor((x1 - 0.001) / LADO_TILE_MUNDO));
  const ty1 = Math.min(GRADE_TILE - 1, Math.floor((y1 - 0.001) / LADO_TILE_MUNDO));
  const quer = new Set();
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const k = chave(tx, ty);
      quer.add(k);
      let tile = tiles.get(k);
      if (!tile) {
        tile = {
          tx,
          ty,
          chave: k,
          canvas: null,
          bitmap: null,
          linhas: 0,
          visivel: false,
          carregando: false,
          falhou: false,
          uso: 0,
        };
        tiles.set(k, tile);
      }
      tile.visivel = true;
      tile.uso = ++uso;
    }
  }
  for (const tile of tiles.values()) {
    if (!quer.has(tile.chave)) tile.visivel = false;
  }
  enxugar();
  bombear(cx, cy);
}

export function listarTiles() {
  const lista = [];
  for (const tile of tiles.values()) {
    if (tile.visivel && tile.linhas > 0) lista.push(tile);
  }
  return lista;
}
