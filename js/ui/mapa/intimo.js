/**
 * Zoom íntimo. Máscara veg em chunks 1024²; o tufo nasce num canvas
 * de 128 blocos e fica em cache.
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
  GRADE_VEG,
  LADO_INTIMO,
  LADO_VEG_CHUNK,
  PASTA_MAPA,
  TEXEL_INTIMO,
  ZOOM_INTIMO,
} from "./grade.js";

const FOLGA = 6;
const FOLGA_VEG = 4;

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

/** @type {Map<string, { dados: Uint8Array | null, pedindo: boolean, uso: number }>} */
const vegChunks = new Map();

/** @type {Map<string, object>} */
const tiles = new Map();
let uso = 0;
let usoVeg = 0;

function chaveVeg(vx, vy) {
  return `${vx},${vy}`;
}

function pedirVeg(vx, vy) {
  const chave = chaveVeg(vx, vy);
  let slot = vegChunks.get(chave);
  if (slot?.dados || slot?.pedindo) {
    if (slot) slot.uso = ++usoVeg;
    return;
  }
  slot = { dados: null, pedindo: true, uso: ++usoVeg };
  vegChunks.set(chave, slot);
  const url = `${PASTA_MAPA}/veg/${vx}_${vy}.bin.gz`;
  fetch(url)
    .then((res) => {
      if (!res.ok || !res.body) throw new Error(url);
      return new Response(res.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
    })
    .then((buf) => {
      const dados = new Uint8Array(buf);
      if (dados.length !== LADO_VEG_CHUNK * LADO_VEG_CHUNK) throw new Error("veg chunk");
      slot.dados = dados;
      slot.pedindo = false;
    })
    .catch((err) => {
      slot.pedindo = false;
      vegChunks.delete(chave);
      console.error("Mapa prebuild ausente:", url, err);
    });
}

function enxugarVeg(visiveis) {
  const sobra = [];
  for (const [chave, slot] of vegChunks) {
    if (visiveis.has(chave)) continue;
    if (slot.pedindo) continue;
    sobra.push({ chave, uso: slot.uso });
  }
  sobra.sort((a, b) => a.uso - b.uso);
  while (sobra.length > FOLGA_VEG) {
    vegChunks.delete(sobra.shift().chave);
  }
}

function byteEm(wx, wy) {
  const vx = (wx / LADO_VEG_CHUNK) | 0;
  const vy = (wy / LADO_VEG_CHUNK) | 0;
  const slot = vegChunks.get(chaveVeg(vx, vy));
  if (!slot?.dados) return 0;
  const lx = wx - vx * LADO_VEG_CHUNK;
  const ly = wy - vy * LADO_VEG_CHUNK;
  return slot.dados[ly * LADO_VEG_CHUNK + lx] | 0;
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
    for (let bx = 0; bx < BLOCOS_INTIMO; bx++) {
      const wx = ox + bx;
      const byte = byteEm(wx, wy);
      if (!byte) continue;
      const info = lerVeg(byte);
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

function vegProntoPara(ox, oy) {
  const x1 = ox + BLOCOS_INTIMO - 1;
  const y1 = oy + BLOCOS_INTIMO - 1;
  const vx0 = (ox / LADO_VEG_CHUNK) | 0;
  const vy0 = (oy / LADO_VEG_CHUNK) | 0;
  const vx1 = (x1 / LADO_VEG_CHUNK) | 0;
  const vy1 = (y1 / LADO_VEG_CHUNK) | 0;
  for (let vy = vy0; vy <= vy1; vy++) {
    for (let vx = vx0; vx <= vx1; vx++) {
      if (!vegChunks.get(chaveVeg(vx, vy))?.dados) return false;
    }
  }
  return true;
}

export function tickIntimo(cx, cy, zoom, x0, y0, x1, y1) {
  if (zoom < ZOOM_INTIMO) {
    for (const tile of tiles.values()) tile.visivel = false;
    enxugar();
    return;
  }

  const vx0 = Math.max(0, Math.floor(x0 / LADO_VEG_CHUNK));
  const vy0 = Math.max(0, Math.floor(y0 / LADO_VEG_CHUNK));
  const vx1 = Math.min(GRADE_VEG - 1, Math.floor((x1 - 0.001) / LADO_VEG_CHUNK));
  const vy1 = Math.min(GRADE_VEG - 1, Math.floor((y1 - 0.001) / LADO_VEG_CHUNK));
  const querVeg = new Set();
  for (let vy = vy0; vy <= vy1; vy++) {
    for (let vx = vx0; vx <= vx1; vx++) {
      const chave = chaveVeg(vx, vy);
      querVeg.add(chave);
      pedirVeg(vx, vy);
    }
  }
  enxugarVeg(querVeg);

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

  const tile = maisPerto(cx, cy);
  if (tile && vegProntoPara(tile.ox, tile.oy)) {
    tile.canvas = compor(tile.ox, tile.oy);
  }
}

export function listarIntimos() {
  const lista = [];
  for (const tile of tiles.values()) {
    if (tile.visivel && tile.canvas) lista.push(tile);
  }
  return lista;
}
