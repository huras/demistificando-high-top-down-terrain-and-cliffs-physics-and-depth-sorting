import {
  CHUNK_XZ,
  CHUNK_Y,
  RAIO_STREAM,
  RAIO_STREAM_MAX,
  RAIO_STREAM_MIN,
  SEED_MUNDO,
  USAR_PATCH_DEMO,
} from "../../config.js";
import { aplicarPatchDemo, ALTURAS } from "../regioes/mapaDemoPatch.js";
import {
  baseTopoLocal,
  chaveChunk,
  criarChunk,
  definirLocal,
  invalidarFluxo,
  mundoParaChunk,
  obterLocal,
  superficieBaixaLocal,
  superficieLocal,
} from "./chunk.js";
import { limparPropsChunk } from "../bioma/propsBioma.js";
import { gerarChunkProcedural } from "./gerarChunk.js";
import { BLOCO, ehSolido } from "./tiposBloco.js";

/** @type {Map<string, object>} */
const chunks = new Map();
/** edits jogador: "x,y,z" → id */
const edits = new Map();
/** @type {Set<(aabb: object) => void>} */
const ouvintesDirty = new Set();

let seed = SEED_MUNDO;
let aabbCarregado = { x0: 0, y0: 0, x1: -1, y1: -1 };

export function obterSeed() {
  return seed;
}

export function definirSeed(novo) {
  seed = novo | 0;
}

export function onDirty(fn) {
  ouvintesDirty.add(fn);
  return () => ouvintesDirty.delete(fn);
}

function emitirDirty(aabb) {
  for (const fn of ouvintesDirty) fn(aabb);
}

function chaveEdit(x, y, z) {
  return `${x|0},${y|0},${z|0}`;
}

function aplicarEditsNoChunk(chunk) {
  const baseX = chunk.cx * CHUNK_XZ;
  const baseY = chunk.cy * CHUNK_XZ;
  for (const [k, id] of edits) {
    const [sx, sy, sz] = k.split(",").map(Number);
    if (Math.floor(sx / CHUNK_XZ) !== chunk.cx) continue;
    if (Math.floor(sy / CHUNK_XZ) !== chunk.cy) continue;
    definirLocal(chunk, sx - baseX, sy - baseY, sz, id);
  }
}

export function carregarChunk(cx, cy) {
  const k = chaveChunk(cx, cy);
  let chunk = chunks.get(k);
  if (chunk) return chunk;

  chunk = criarChunk(cx, cy);
  gerarChunkProcedural(chunk, seed);
  if (USAR_PATCH_DEMO) aplicarPatchDemo(chunk, ALTURAS);
  aplicarEditsNoChunk(chunk);
  chunk.gerado = true;
  chunk.sujo = true;
  invalidarFluxo(chunk);
  chunks.set(k, chunk);
  // Vizinhos precisam remeshar: faces de cliff na borda mudam com o vizinho.
  marcarChunkVizinhosSujos(cx, cy);
  invalidarFluxoVizinhos(cx, cy);
  emitirDirty({
    x0: cx * CHUNK_XZ,
    y0: cy * CHUNK_XZ,
    x1: cx * CHUNK_XZ + CHUNK_XZ - 1,
    y1: cy * CHUNK_XZ + CHUNK_XZ - 1,
    z0: 0,
    z1: CHUNK_Y - 1,
  });
  return chunk;
}

export function descarregarChunk(cx, cy) {
  const k = chaveChunk(cx, cy);
  const chunk = chunks.get(k);
  if (!chunk) return;
  // Antes de sair: vizinhos regeneram faces expostas pro void.
  marcarChunkVizinhosSujos(cx, cy);
  invalidarFluxoVizinhos(cx, cy);
  chunks.delete(k);
  limparPropsChunk(cx, cy);
  emitirDirty({
    x0: cx * CHUNK_XZ,
    y0: cy * CHUNK_XZ,
    x1: cx * CHUNK_XZ + CHUNK_XZ - 1,
    y1: cy * CHUNK_XZ + CHUNK_XZ - 1,
    z0: 0,
    z1: CHUNK_Y - 1,
    unload: true,
  });
}

export function obterChunk(cx, cy) {
  return chunks.get(chaveChunk(cx, cy)) ?? null;
}

/** Troca o chunk no mapa sem gerar relevo. A página de faces usa isso. */
export function instalarChunk(chunk) {
  chunks.set(chaveChunk(chunk.cx, chunk.cy), chunk);
  return chunk;
}

export function paraCadaChunk(fn) {
  for (const chunk of chunks.values()) fn(chunk);
}

export function chunkCarregadoEm(wx, wy) {
  const { cx, cy } = mundoParaChunk(wx, wy);
  return chunks.has(chaveChunk(cx, cy));
}

export function obterBloco(wx, wy, wz) {
  const x = wx | 0;
  const y = wy | 0;
  const z = wz | 0;
  if (z < 0 || z >= CHUNK_Y) return BLOCO.AR;
  const { cx, cy } = mundoParaChunk(x, y);
  const chunk = chunks.get(chaveChunk(cx, cy));
  if (!chunk) return BLOCO.AR;
  return obterLocal(chunk, x - cx * CHUNK_XZ, y - cy * CHUNK_XZ, z);
}

export function definirBloco(wx, wy, wz, id) {
  const x = wx | 0;
  const y = wy | 0;
  const z = wz | 0;
  if (z < 0 || z >= CHUNK_Y) return false;
  const { cx, cy } = mundoParaChunk(x, y);
  const chunk = carregarChunk(cx, cy);
  const lx = x - cx * CHUNK_XZ;
  const ly = y - cy * CHUNK_XZ;
  const mudou = definirLocal(chunk, lx, ly, z, id);
  if (!mudou) return false;

  edits.set(chaveEdit(x, y, z), id | 0);

  // marca vizinhos se na borda
  marcarVizinhosSujos(cx, cy, lx, ly);
  invalidarFluxo(chunk);
  invalidarFluxoVizinhos(cx, cy);

  emitirDirty({
    x0: x - 1,
    y0: y - 1,
    x1: x + 1,
    y1: y + 1,
    z0: Math.max(0, z - 1),
    z1: Math.min(CHUNK_Y - 1, z + 1),
  });
  return true;
}

function invalidarFluxoVizinhos(cx, cy) {
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    invalidarFluxo(obterChunk(cx + dx, cy + dy));
  }
}

function marcarVizinhosSujos(cx, cy, lx, ly) {
  if (lx === 0) obterChunk(cx - 1, cy) && (obterChunk(cx - 1, cy).sujo = true);
  if (lx === CHUNK_XZ - 1) obterChunk(cx + 1, cy) && (obterChunk(cx + 1, cy).sujo = true);
  if (ly === 0) obterChunk(cx, cy - 1) && (obterChunk(cx, cy - 1).sujo = true);
  if (ly === CHUNK_XZ - 1) obterChunk(cx, cy + 1) && (obterChunk(cx, cy + 1).sujo = true);
}

/** Marca o chunk e os 4 vizinhos (borda de stream / faces de cliff). */
function marcarChunkVizinhosSujos(cx, cy) {
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const c = obterChunk(cx + dx, cy + dy);
    if (c) {
      c.sujo = true;
      c.rev = (c.rev | 0) + 1;
    }
  }
}

/** Superfície (maior z sólido) da coluna. */
export function superficieEm(wx, wy) {
  const x = wx | 0;
  const y = wy | 0;
  const { cx, cy } = mundoParaChunk(x, y);
  const chunk = chunks.get(chaveChunk(cx, cy));
  if (!chunk) return 0;
  return superficieLocal(chunk, x - cx * CHUNK_XZ, y - cy * CHUNK_XZ);
}

/** Base do run sólido do topo (−1 se vazio). */
export function baseTopoEm(wx, wy) {
  const x = wx | 0;
  const y = wy | 0;
  const { cx, cy } = mundoParaChunk(x, y);
  const chunk = chunks.get(chaveChunk(cx, cy));
  if (!chunk) return -1;
  return baseTopoLocal(chunk, x - cx * CHUNK_XZ, y - cy * CHUNK_XZ);
}

/** Superfície caminhável sob o deck (0 se não há overhang). */
export function superficieBaixaEm(wx, wy) {
  const x = wx | 0;
  const y = wy | 0;
  const { cx, cy } = mundoParaChunk(x, y);
  const chunk = chunks.get(chaveChunk(cx, cy));
  if (!chunk) return 0;
  return superficieBaixaLocal(chunk, x - cx * CHUNK_XZ, y - cy * CHUNK_XZ);
}

export function blocoSolidoEm(wx, wy, wz) {
  return ehSolido(obterBloco(wx, wy, wz));
}

let raioAtivo = RAIO_STREAM;

export function obterRaioStream() {
  return raioAtivo;
}

/** Troca o disco carregado. O próximo streaming aplica mesmo sem andar. */
export function definirRaioStream(raio) {
  const n = Math.max(RAIO_STREAM_MIN, Math.min(RAIO_STREAM_MAX, raio | 0));
  if (n !== raioAtivo) {
    raioAtivo = n;
    atualizarStreaming._raio = -1;
  }
  return raioAtivo;
}

/**
 * Mantém disco de chunks em torno do jogador.
 */
export function atualizarStreaming(px, py, raio = raioAtivo) {
  const { cx: pcx, cy: pcy } = mundoParaChunk(px, py);

  // Early-out: mesmo chunk âncora, mesmo raio e já carregado — evita Set/loop todo frame.
  if (
    atualizarStreaming._pcx === pcx &&
    atualizarStreaming._pcy === pcy &&
    atualizarStreaming._raio === raio &&
    chunks.size > 0
  ) {
    return aabbCarregado;
  }
  atualizarStreaming._pcx = pcx;
  atualizarStreaming._pcy = pcy;
  atualizarStreaming._raio = raio;

  const precisos = new Set();

  for (let dy = -raio; dy <= raio; dy++) {
    for (let dx = -raio; dx <= raio; dx++) {
      if (dx * dx + dy * dy > raio * raio + 1) continue;
      const cx = pcx + dx;
      const cy = pcy + dy;
      const k = chaveChunk(cx, cy);
      precisos.add(k);
      carregarChunk(cx, cy);
    }
  }

  for (const [k, chunk] of chunks) {
    if (!precisos.has(k)) {
      descarregarChunk(chunk.cx, chunk.cy);
    }
  }

  aabbCarregado = {
    x0: (pcx - raio) * CHUNK_XZ,
    y0: (pcy - raio) * CHUNK_XZ,
    x1: (pcx + raio + 1) * CHUNK_XZ - 1,
    y1: (pcy + raio + 1) * CHUNK_XZ - 1,
  };
  return aabbCarregado;
}

export function obterAabbCarregado() {
  return aabbCarregado;
}

/** Carrega região do patch demo + vizinhança inicial. */
export function iniciarMundoAoRedor(px, py) {
  atualizarStreaming(px, py, raioAtivo);
}

/** A malha rele o chunk sem desenhar a casca da casa. */
export function marcarChunkSujo(chunk) {
  if (!chunk) return;
  chunk.sujo = true;
  chunk.rev = (chunk.rev | 0) + 1;
  invalidarFluxo(chunk);
  emitirDirty({
    x0: chunk.cx * CHUNK_XZ,
    y0: chunk.cy * CHUNK_XZ,
    x1: chunk.cx * CHUNK_XZ + CHUNK_XZ - 1,
    y1: chunk.cy * CHUNK_XZ + CHUNK_XZ - 1,
    z0: 0,
    z1: CHUNK_Y - 1,
  });
}

export function listarChunksSujos() {
  const out = [];
  for (const chunk of chunks.values()) {
    if (chunk.sujo) out.push(chunk);
  }
  return out;
}

export function limparSujo(chunk) {
  chunk.sujo = false;
}
