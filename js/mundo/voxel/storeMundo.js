import { CHUNK_XZ, CHUNK_Y, RAIO_STREAM, SEED_MUNDO } from "../../config.js";
import { aplicarPatchDemo, ALTURAS } from "../regioes/mapaDemoPatch.js";
import {
  chaveChunk,
  criarChunk,
  definirLocal,
  mundoParaChunk,
  obterLocal,
  superficieLocal,
} from "./chunk.js";
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
  aplicarPatchDemo(chunk, ALTURAS);
  aplicarEditsNoChunk(chunk);
  chunk.gerado = true;
  chunk.sujo = true;
  chunks.set(k, chunk);
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
  chunks.delete(k);
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

function marcarVizinhosSujos(cx, cy, lx, ly) {
  if (lx === 0) obterChunk(cx - 1, cy) && (obterChunk(cx - 1, cy).sujo = true);
  if (lx === CHUNK_XZ - 1) obterChunk(cx + 1, cy) && (obterChunk(cx + 1, cy).sujo = true);
  if (ly === 0) obterChunk(cx, cy - 1) && (obterChunk(cx, cy - 1).sujo = true);
  if (ly === CHUNK_XZ - 1) obterChunk(cx, cy + 1) && (obterChunk(cx, cy + 1).sujo = true);
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

export function blocoSolidoEm(wx, wy, wz) {
  return ehSolido(obterBloco(wx, wy, wz));
}

/**
 * Mantém disco de chunks em torno do jogador.
 */
export function atualizarStreaming(px, py, raio = RAIO_STREAM) {
  // #region agent log
  const __t0 = performance.now();
  let __novos = 0;
  let __removidos = 0;
  // #endregion
  const { cx: pcx, cy: pcy } = mundoParaChunk(px, py);

  // Early-out: mesmo chunk âncora e já carregado — evita Set/loop todo frame.
  if (
    atualizarStreaming._pcx === pcx &&
    atualizarStreaming._pcy === pcy &&
    chunks.size > 0
  ) {
    // #region agent log
    if (!atualizarStreaming.__lastLog || performance.now() - atualizarStreaming.__lastLog > 1000) {
      fetch('http://127.0.0.1:7578/ingest/2d17c26e-34d3-4e31-ad4f-513a36a051d1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ac17a'},body:JSON.stringify({sessionId:'8ac17a',runId:'post-fix',hypothesisId:'A',location:'storeMundo.js:atualizarStreaming',message:'stream_tick',data:{ms:+(performance.now()-__t0).toFixed(2),novos:0,removidos:0,nChunks:chunks.size,pcx,pcy,skipped:true,aabbW:aabbCarregado.x1-aabbCarregado.x0+1,aabbH:aabbCarregado.y1-aabbCarregado.y0+1},timestamp:Date.now()})}).catch(()=>{});
      atualizarStreaming.__lastLog = performance.now();
    }
    // #endregion
    return aabbCarregado;
  }
  atualizarStreaming._pcx = pcx;
  atualizarStreaming._pcy = pcy;

  const precisos = new Set();

  for (let dy = -raio; dy <= raio; dy++) {
    for (let dx = -raio; dx <= raio; dx++) {
      if (dx * dx + dy * dy > raio * raio + 1) continue;
      const cx = pcx + dx;
      const cy = pcy + dy;
      precisos.add(chaveChunk(cx, cy));
      // #region agent log
      const __existia = chunks.has(chaveChunk(cx, cy));
      // #endregion
      carregarChunk(cx, cy);
      // #region agent log
      if (!__existia) __novos++;
      // #endregion
    }
  }

  for (const [k, chunk] of chunks) {
    if (!precisos.has(k)) {
      // #region agent log
      __removidos++;
      // #endregion
      descarregarChunk(chunk.cx, chunk.cy);
    }
  }

  aabbCarregado = {
    x0: (pcx - raio) * CHUNK_XZ,
    y0: (pcy - raio) * CHUNK_XZ,
    x1: (pcx + raio + 1) * CHUNK_XZ - 1,
    y1: (pcy + raio + 1) * CHUNK_XZ - 1,
  };
  // #region agent log
  const __ms = performance.now() - __t0;
  if (!atualizarStreaming.__lastLog || performance.now() - atualizarStreaming.__lastLog > 1000) {
    fetch('http://127.0.0.1:7578/ingest/2d17c26e-34d3-4e31-ad4f-513a36a051d1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ac17a'},body:JSON.stringify({sessionId:'8ac17a',runId:'post-fix',hypothesisId:'A',location:'storeMundo.js:atualizarStreaming',message:'stream_tick',data:{ms:+__ms.toFixed(2),novos:__novos,removidos:__removidos,nChunks:chunks.size,pcx,pcy,skipped:false,aabbW:aabbCarregado.x1-aabbCarregado.x0+1,aabbH:aabbCarregado.y1-aabbCarregado.y0+1},timestamp:Date.now()})}).catch(()=>{});
    atualizarStreaming.__lastLog = performance.now();
  }
  // #endregion
  return aabbCarregado;
}

export function obterAabbCarregado() {
  return aabbCarregado;
}

/** Carrega região do patch demo + vizinhança inicial. */
export function iniciarMundoAoRedor(px, py) {
  atualizarStreaming(px, py, RAIO_STREAM);
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
