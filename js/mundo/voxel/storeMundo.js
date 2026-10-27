import {
  CHUNK_XZ,
  CHUNK_Y,
  RAIO_STREAM,
  RAIO_STREAM_MAX,
  RAIO_STREAM_MIN,
  SEED_MUNDO,
} from "../../config.js";
import { chunkDentroDoMundo } from "../bounds.js";
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
import { gerarChunkProcedural, passosChunk } from "./gerarChunk.js";
import { BLOCO, ehSolido } from "./tiposBloco.js";
import {
  devePreemptar,
  indiceProximoUrgente,
  obterContextoPrioridade,
  ordenarPorPrioridade,
  scoreChunk,
} from "./prioridadeChunk.js";
import { medir } from "../../diagnostico/perfChunk.js";

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

/** Avisa a vegetação para remontar (prop cortada, por exemplo). */
export function avisarDirty() {
  emitirDirty(aabbCarregado);
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

function publicarChunkCarregado(chunk) {
  medir("publicar", () => {
    aplicarPatchDemo(chunk, ALTURAS);
    aplicarEditsNoChunk(chunk);
    chunk.gerado = true;
    chunk.sujo = true;
    invalidarFluxo(chunk);
    chunks.set(chaveChunk(chunk.cx, chunk.cy), chunk);
    marcarChunkVizinhosSujos(chunk.cx, chunk.cy);
    invalidarFluxoVizinhos(chunk.cx, chunk.cy);
    emitirDirty({
      x0: chunk.cx * CHUNK_XZ,
      y0: chunk.cy * CHUNK_XZ,
      x1: chunk.cx * CHUNK_XZ + CHUNK_XZ - 1,
      y1: chunk.cy * CHUNK_XZ + CHUNK_XZ - 1,
      z0: 0,
      z1: CHUNK_Y - 1,
    });
  });
}

export function carregarChunk(cx, cy) {
  if (!chunkDentroDoMundo(cx, cy, CHUNK_XZ)) return null;
  const k = chaveChunk(cx, cy);
  let chunk = chunks.get(k);
  if (chunk) return chunk;

  chunk = criarChunk(cx, cy);
  gerarChunkProcedural(chunk, seed);
  publicarChunkCarregado(chunk);
  return chunk;
}

/** Publica chunk já gerado (página de profiling / stream simulado). */
export function publicarChunkGerado(chunk) {
  publicarChunkCarregado(chunk);
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

/** Marca o chunk, os 4 lados e as 4 diagonais. A quina da espuma depende da diagonal. */
function marcarChunkVizinhosSujos(cx, cy) {
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
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
 * No frame, só gasta ~0,8 ms: o anel novo entra fatiado. Teleporte e o
 * primeiro preenchimento passam sincrono=true e drenam o disco inteiro.
 * Durante a viagem, atualizarStreamingDuplo segura origem+destino.
 */
let filaStream = null;
let fatiaStream = null;
const ORCAMENTO_STREAM_MS = 0.8;

function discoStream(pcx, pcy, raio, grupo = 0) {
  const lista = [];
  for (let dy = -raio; dy <= raio; dy++) {
    for (let dx = -raio; dx <= raio; dx++) {
      if (dx * dx + dy * dy > raio * raio + 1) continue;
      const cx = pcx + dx;
      const cy = pcy + dy;
      if (!chunkDentroDoMundo(cx, cy, CHUNK_XZ)) continue;
      lista.push({ cx, cy, d: dx * dx + dy * dy, grupo });
    }
  }
  return lista;
}

/** União de dois discos; chunks do centro B entram primeiro (destino / bolso). */
function discoDuplo(pcxA, pcyA, pcxB, pcyB, raioA, raioB = raioA) {
  const a = discoStream(pcxA, pcyA, raioA, 1);
  const b = discoStream(pcxB, pcyB, raioB, 0);
  const visto = new Set();
  const lista = [];
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    const k = chaveChunk(c.cx, c.cy);
    visto.add(k);
    lista.push(c);
  }
  for (let i = 0; i < a.length; i++) {
    const c = a[i];
    const k = chaveChunk(c.cx, c.cy);
    if (visto.has(k)) continue;
    visto.add(k);
    lista.push(c);
  }
  return lista;
}

function ordenarFilaEntrar(entrar) {
  if (!entrar || !entrar.length) return;
  ordenarPorPrioridade(entrar, obterContextoPrioridade());
}

function atualizarAabbStream(pcx, pcy, raio) {
  aabbCarregado = {
    x0: (pcx - raio) * CHUNK_XZ,
    y0: (pcy - raio) * CHUNK_XZ,
    x1: (pcx + raio + 1) * CHUNK_XZ - 1,
    y1: (pcy + raio + 1) * CHUNK_XZ - 1,
  };
}

function atualizarAabbDuplo(pcxA, pcyA, pcxB, pcyB, raioA, raioB = raioA) {
  const a0x = (pcxA - raioA) * CHUNK_XZ;
  const a0y = (pcyA - raioA) * CHUNK_XZ;
  const a1x = (pcxA + raioA + 1) * CHUNK_XZ - 1;
  const a1y = (pcyA + raioA + 1) * CHUNK_XZ - 1;
  const b0x = (pcxB - raioB) * CHUNK_XZ;
  const b0y = (pcyB - raioB) * CHUNK_XZ;
  const b1x = (pcxB + raioB + 1) * CHUNK_XZ - 1;
  const b1y = (pcyB + raioB + 1) * CHUNK_XZ - 1;
  aabbCarregado = {
    x0: Math.min(a0x, b0x),
    y0: Math.min(a0y, b0y),
    x1: Math.max(a1x, b1x),
    y1: Math.max(a1y, b1y),
  };
}

function remontarFila(disco, meta) {
  const querer = new Set(disco.map((c) => chaveChunk(c.cx, c.cy)));
  if (fatiaStream && !querer.has(chaveChunk(fatiaStream.cx, fatiaStream.cy))) {
    fatiaStream = null;
  }
  const entrar = [];
  for (let i = 0; i < disco.length; i++) {
    const c = disco[i];
    if (chunks.has(chaveChunk(c.cx, c.cy))) continue;
    if (fatiaStream && fatiaStream.cx === c.cx && fatiaStream.cy === c.cy) continue;
    entrar.push(c);
  }
  ordenarFilaEntrar(entrar);
  const sair = [];
  for (const chunk of chunks.values()) {
    if (!querer.has(chaveChunk(chunk.cx, chunk.cy))) sair.push(chunk);
  }
  filaStream = { ...meta, entrar, sair, i: 0, j: 0 };
}

function tentarPreemptarFatia() {
  if (!fatiaStream || !filaStream) return;
  const c = obterContextoPrioridade();
  if (!c) return;
  const resto = filaStream.entrar;
  const idx = indiceProximoUrgente(resto, filaStream.i, c);
  if (idx < 0) return;
  const melhor = resto[idx];
  const scoreFatia = scoreChunk(fatiaStream.cx, fatiaStream.cy, c);
  const scoreMelhor = melhor.score ?? scoreChunk(melhor.cx, melhor.cy, c);
  if (!devePreemptar(scoreFatia, scoreMelhor)) return;
  // Abandona a fatia atual e recoloca no fim da fila.
  resto.push({
    cx: fatiaStream.cx,
    cy: fatiaStream.cy,
    d: 0,
    grupo: fatiaStream.grupo | 0,
  });
  fatiaStream = null;
  const pendentes = resto.slice(filaStream.i);
  ordenarFilaEntrar(pendentes);
  filaStream.entrar = pendentes;
  filaStream.i = 0;
}

function drenarFilaStream(sincrono) {
  if (!filaStream) return false;
  if (!sincrono) {
    const pendentes = filaStream.entrar.slice(filaStream.i);
    ordenarFilaEntrar(pendentes);
    filaStream.entrar = pendentes;
    filaStream.i = 0;
    tentarPreemptarFatia();
  }
  const limite = performance.now() + (sincrono ? 1e9 : ORCAMENTO_STREAM_MS);
  while (performance.now() < limite) {
    if (fatiaStream) {
      const passo = fatiaStream.gen.next();
      if (passo.done) {
        if (!chunks.has(chaveChunk(fatiaStream.cx, fatiaStream.cy))) {
          publicarChunkCarregado(fatiaStream.chunk);
        }
        fatiaStream = null;
      }
      continue;
    }
    if (filaStream.i < filaStream.entrar.length) {
      const c = obterContextoPrioridade();
      const idx = sincrono
        ? filaStream.i
        : indiceProximoUrgente(filaStream.entrar, filaStream.i, c);
      if (idx < 0) break;
      if (idx !== filaStream.i) {
        const item = filaStream.entrar[idx];
        filaStream.entrar.splice(idx, 1);
        filaStream.entrar.splice(filaStream.i, 0, item);
      }
      const item = filaStream.entrar[filaStream.i++];
      if (chunks.has(chaveChunk(item.cx, item.cy))) continue;
      const chunk = criarChunk(item.cx, item.cy);
      fatiaStream = {
        cx: item.cx,
        cy: item.cy,
        grupo: item.grupo | 0,
        chunk,
        gen: passosChunk(chunk, seed),
      };
      continue;
    }
    if (filaStream.j < filaStream.sair.length) {
      const chunk = filaStream.sair[filaStream.j++];
      if (chunks.get(chaveChunk(chunk.cx, chunk.cy)) === chunk) {
        descarregarChunk(chunk.cx, chunk.cy);
      }
      continue;
    }
    break;
  }
  return (
    !fatiaStream &&
    filaStream.i >= filaStream.entrar.length &&
    filaStream.j >= filaStream.sair.length
  );
}

export function atualizarStreaming(px, py, raio = raioAtivo, sincrono = false) {
  const { cx: pcx, cy: pcy } = mundoParaChunk(px, py);

  if (
    !sincrono &&
    !filaStream &&
    !fatiaStream &&
    atualizarStreaming._pcx === pcx &&
    atualizarStreaming._pcy === pcy &&
    atualizarStreaming._raio === raio &&
    !atualizarStreaming._duplo &&
    chunks.size > 0
  ) {
    return aabbCarregado;
  }

  const mesmo =
    filaStream &&
    filaStream.modo !== "duplo" &&
    filaStream.pcx === pcx &&
    filaStream.pcy === pcy &&
    filaStream.raio === raio;
  if (!mesmo) {
    remontarFila(discoStream(pcx, pcy, raio), {
      modo: "simples",
      pcx,
      pcy,
      raio,
    });
  }

  if (drenarFilaStream(sincrono)) {
    atualizarStreaming._pcx = pcx;
    atualizarStreaming._pcy = pcy;
    atualizarStreaming._raio = raio;
    atualizarStreaming._duplo = null;
    atualizarAabbStream(pcx, pcy, raio);
    filaStream = null;
  }
  return aabbCarregado;
}

/**
 * Mantém origem e destino (ou outdoor + bolso) carregados.
 * Prioriza entrar os chunks do ponto B. `raioB` menor no bolso evita
 * gerar um disco inteiro de void em torno da sala.
 */
export function atualizarStreamingDuplo(
  pxA,
  pyA,
  pxB,
  pyB,
  raio = raioAtivo,
  sincrono = false,
  raioB = raio,
) {
  const { cx: pcxA, cy: pcyA } = mundoParaChunk(pxA, pyA);
  const { cx: pcxB, cy: pcyB } = mundoParaChunk(pxB, pyB);
  const rB = raioB == null ? raio : raioB;
  const duplo = atualizarStreaming._duplo;
  if (
    !sincrono &&
    !filaStream &&
    !fatiaStream &&
    duplo &&
    duplo.pcxA === pcxA &&
    duplo.pcyA === pcyA &&
    duplo.pcxB === pcxB &&
    duplo.pcyB === pcyB &&
    duplo.raio === raio &&
    duplo.raioB === rB &&
    chunks.size > 0
  ) {
    return aabbCarregado;
  }

  const mesmo =
    filaStream &&
    filaStream.modo === "duplo" &&
    filaStream.pcxA === pcxA &&
    filaStream.pcyA === pcyA &&
    filaStream.pcxB === pcxB &&
    filaStream.pcyB === pcyB &&
    filaStream.raio === raio &&
    filaStream.raioB === rB;
  if (!mesmo) {
    remontarFila(discoDuplo(pcxA, pcyA, pcxB, pcyB, raio, rB), {
      modo: "duplo",
      pcxA,
      pcyA,
      pcxB,
      pcyB,
      raio,
      raioB: rB,
    });
  }

  if (drenarFilaStream(sincrono)) {
    atualizarStreaming._pcx = undefined;
    atualizarStreaming._pcy = undefined;
    atualizarStreaming._raio = raio;
    atualizarStreaming._duplo = { pcxA, pcyA, pcxB, pcyB, raio, raioB: rB };
    atualizarAabbDuplo(pcxA, pcyA, pcxB, pcyB, raio, rB);
    filaStream = null;
  }
  return aabbCarregado;
}

/** True se o miolo ao redor de (px,py) já está todo no mapa de chunks. */
export function streamDiscoPronto(px, py, raioMiolo = 2) {
  const { cx: pcx, cy: pcy } = mundoParaChunk(px, py);
  const disco = discoStream(pcx, pcy, raioMiolo);
  for (let i = 0; i < disco.length; i++) {
    const c = disco[i];
    if (!chunks.has(chaveChunk(c.cx, c.cy))) return false;
    if (fatiaStream && fatiaStream.cx === c.cx && fatiaStream.cy === c.cy) return false;
  }
  if (filaStream) {
    for (let i = filaStream.i; i < filaStream.entrar.length; i++) {
      const item = filaStream.entrar[i];
      const dx = item.cx - pcx;
      const dy = item.cy - pcy;
      if (dx * dx + dy * dy <= raioMiolo * raioMiolo + 1) return false;
    }
  }
  return disco.length > 0;
}

export function obterAabbCarregado() {
  return aabbCarregado;
}

/** Carrega região do patch demo + vizinhança inicial. */
export function iniciarMundoAoRedor(px, py) {
  atualizarStreaming(px, py, raioAtivo, true);
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
