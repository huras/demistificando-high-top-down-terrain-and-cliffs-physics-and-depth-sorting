/**
 * Corrente estática: cada coluna de água aponta para o vizinho mais baixo
 * (ou para a cachoeira). Recalcula o chunk inteiro quando fica sujo.
 */
import { CHUNK_XZ, CHUNK_Y } from "../../config.js";
import { mundoParaChunk } from "../voxel/chunk.js";
import { obterBloco, obterChunk } from "../voxel/storeMundo.js";
import { BLOCO, ehLiquido, ehSolido } from "../voxel/tiposBloco.js";

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const VAZIA = Object.freeze({
  superficie: 0,
  fundo: 0,
  profundidade: 0,
  caindo: false,
  pisoQueda: 0,
});

/**
 * Lê a coluna sem usar o cache de fluxo.
 * Água apoiada em sólido = repouso. Água com ar embaixo = cachoeira.
 */
export function inspecionarColunaAgua(wx, wy) {
  const x = wx | 0;
  const y = wy | 0;
  let zTopo = -1;
  for (let z = CHUNK_Y - 1; z >= 0; z--) {
    if (ehLiquido(obterBloco(x, y, z))) {
      zTopo = z;
      break;
    }
  }
  if (zTopo < 0) return VAZIA;

  let zBase = zTopo;
  while (zBase > 0 && ehLiquido(obterBloco(x, y, zBase - 1))) zBase--;

  const abaixo = zBase > 0 ? obterBloco(x, y, zBase - 1) : BLOCO.PEDRA;
  const caindo = !ehSolido(abaixo);
  const superficie = zTopo + 1;

  let fundo = 0;
  if (!caindo) {
    fundo = zBase;
  } else {
    for (let z = zBase - 1; z >= 0; z--) {
      if (ehSolido(obterBloco(x, y, z))) {
        fundo = z + 1;
        break;
      }
    }
  }

  return {
    superficie,
    fundo,
    profundidade: caindo ? 0 : superficie - fundo,
    caindo,
    pisoQueda: caindo ? zBase : superficie,
  };
}

function nivel(info) {
  return info.caindo ? info.pisoQueda : info.superficie;
}

function escrever(chunk, wx, wy, fx, fy, info) {
  const lx = wx - chunk.cx * CHUNK_XZ;
  const ly = wy - chunk.cy * CHUNK_XZ;
  if (lx < 0 || ly < 0 || lx >= CHUNK_XZ || ly >= CHUNK_XZ) return;
  const i = ly * CHUNK_XZ + lx;
  chunk.fluxoX[i] = fx | 0;
  chunk.fluxoY[i] = fy | 0;
  chunk.aguaCaindo[i] = info.caindo ? 1 : 0;
  chunk.aguaSuperficie[i] = info.superficie | 0;
  chunk.aguaFundo[i] = info.fundo | 0;
  chunk.aguaProf[i] = info.profundidade | 0;
  chunk.aguaPiso[i] = info.pisoQueda | 0;
}

function fluxoDaQueda(info, sx, sy, cols) {
  let best = null;
  let bestN = Infinity;
  for (let d = 0; d < DIRS.length; d++) {
    const dx = DIRS[d][0];
    const dy = DIRS[d][1];
    const n = cols.get(`${sx + dx},${sy + dy}`);
    if (!n || n.caindo) continue;
    if (n.superficie > info.pisoQueda + 0.25) continue;
    if (n.superficie < bestN) {
      bestN = n.superficie;
      best = [dx, dy];
    }
  }
  return best || [0, 0];
}

export function garantirFluxoChunk(chunk) {
  if (!chunk || chunk.fluxoPronto) return;
  const baseX = chunk.cx * CHUNK_XZ;
  const baseY = chunk.cy * CHUNK_XZ;
  const halo = 1;
  /** @type {Map<string, object>} */
  const cols = new Map();

  for (let ly = -halo; ly < CHUNK_XZ + halo; ly++) {
    for (let lx = -halo; lx < CHUNK_XZ + halo; lx++) {
      const wx = baseX + lx;
      const wy = baseY + ly;
      const info = inspecionarColunaAgua(wx, wy);
      if (info.superficie <= 0) continue;
      cols.set(`${wx},${wy}`, info);
    }
  }

  chunk.fluxoX.fill(0);
  chunk.fluxoY.fill(0);
  chunk.aguaCaindo.fill(0);
  chunk.aguaSuperficie.fill(0);
  chunk.aguaFundo.fill(0);
  chunk.aguaProf.fill(0);
  chunk.aguaPiso.fill(0);

  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const wx = baseX + lx;
      const wy = baseY + ly;
      const info = cols.get(`${wx},${wy}`);
      if (!info) continue;
      escrever(chunk, wx, wy, 0, 0, info);
    }
  }

  /** @type {Map<string, number>} */
  const dist = new Map();
  /** @type {string[]} */
  const fila = [];

  for (const [k, info] of cols) {
    if (!info.caindo) continue;
    dist.set(k, 0);
    fila.push(k);
    const [sx, sy] = k.split(",").map(Number);
    const [fx, fy] = fluxoDaQueda(info, sx, sy, cols);
    escrever(chunk, sx, sy, fx, fy, info);
  }

  for (const [k, info] of cols) {
    if (info.caindo || dist.has(k)) continue;
    const [sx, sy] = k.split(",").map(Number);
    let best = null;
    let bestN = info.superficie;
    for (let d = 0; d < DIRS.length; d++) {
      const dx = DIRS[d][0];
      const dy = DIRS[d][1];
      const n = cols.get(`${sx + dx},${sy + dy}`);
      if (!n) continue;
      const nv = nivel(n);
      if (nv < bestN) {
        bestN = nv;
        best = [dx, dy];
      }
    }
    if (!best) continue;
    dist.set(k, 0);
    fila.push(k);
    escrever(chunk, sx, sy, best[0], best[1], info);
  }

  let qi = 0;
  while (qi < fila.length) {
    const k = fila[qi++];
    const info = cols.get(k);
    const d0 = dist.get(k) || 0;
    const [sx, sy] = k.split(",").map(Number);
    for (let d = 0; d < DIRS.length; d++) {
      const dx = DIRS[d][0];
      const dy = DIRS[d][1];
      const nk = `${sx + dx},${sy + dy}`;
      if (dist.has(nk)) continue;
      const n = cols.get(nk);
      if (!n || n.caindo) continue;
      if (info.caindo && n.superficie <= info.pisoQueda + 0.01) continue;
      if (!info.caindo && n.superficie + 1e-3 < nivel(info)) continue;
      dist.set(nk, d0 + 1);
      fila.push(nk);
      escrever(chunk, sx + dx, sy + dy, -dx, -dy, n);
    }
  }

  chunk.fluxoPronto = true;
}

const CACHE_VAZIA = Object.freeze({
  superficie: 0,
  fundo: 0,
  profundidade: 0,
  caindo: false,
  pisoQueda: 0,
  fluxoX: 0,
  fluxoY: 0,
});

/** Coluna com fluxo já resolvido. O(1) depois do primeiro acesso ao chunk. */
export function colunaAgua(wx, wy) {
  const x = wx | 0;
  const y = wy | 0;
  const { cx, cy } = mundoParaChunk(x, y);
  const chunk = obterChunk(cx, cy);
  if (!chunk) return CACHE_VAZIA;
  garantirFluxoChunk(chunk);
  const lx = x - cx * CHUNK_XZ;
  const ly = y - cy * CHUNK_XZ;
  if (lx < 0 || ly < 0 || lx >= CHUNK_XZ || ly >= CHUNK_XZ) return CACHE_VAZIA;
  const i = ly * CHUNK_XZ + lx;
  const superficie = chunk.aguaSuperficie[i] | 0;
  if (superficie <= 0) return CACHE_VAZIA;
  return {
    superficie,
    fundo: chunk.aguaFundo[i] | 0,
    profundidade: chunk.aguaProf[i] | 0,
    caindo: chunk.aguaCaindo[i] === 1,
    pisoQueda: chunk.aguaPiso[i] | 0,
    fluxoX: chunk.fluxoX[i] | 0,
    fluxoY: chunk.fluxoY[i] | 0,
  };
}
