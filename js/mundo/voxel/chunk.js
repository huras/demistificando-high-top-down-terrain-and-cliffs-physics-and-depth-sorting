import { CHUNK_XZ, CHUNK_Y } from "../../config.js";
import { BLOCO, ehSolido } from "./tiposBloco.js";

const VOLUME = CHUNK_XZ * CHUNK_XZ * CHUNK_Y;

/**
 * Chunk 16×16×H com cache de superfície por coluna.
 */
export function criarChunk(cx, cy) {
  return {
    cx,
    cy,
    blocos: new Uint16Array(VOLUME),
    /** Walk height = face acima do sólido mais alto. */
    superficie: new Int16Array(CHUNK_XZ * CHUNK_XZ),
    /** Menor lz do run sólido contíguo que inclui o topo (−1 se vazio). */
    baseTopo: new Int16Array(CHUNK_XZ * CHUNK_XZ),
    /** Walk height sob o deck (0 se coluna sólida / sem camada inferior). */
    superficieBaixa: new Int16Array(CHUNK_XZ * CHUNK_XZ),
    sujo: true,
    gerado: false,
  };
}

export function chaveChunk(cx, cy) {
  return `${cx},${cy}`;
}

export function mundoParaChunk(wx, wy) {
  return {
    cx: Math.floor(wx / CHUNK_XZ),
    cy: Math.floor(wy / CHUNK_XZ),
  };
}

export function indiceLocal(lx, ly, lz) {
  return ((ly * CHUNK_XZ + lx) * CHUNK_Y + lz) | 0;
}

export function obterLocal(chunk, lx, ly, lz) {
  if (lx < 0 || ly < 0 || lz < 0 || lx >= CHUNK_XZ || ly >= CHUNK_XZ || lz >= CHUNK_Y) {
    return BLOCO.AR;
  }
  return chunk.blocos[indiceLocal(lx, ly, lz)] | 0;
}

export function definirLocal(chunk, lx, ly, lz, id) {
  if (lx < 0 || ly < 0 || lz < 0 || lx >= CHUNK_XZ || ly >= CHUNK_XZ || lz >= CHUNK_Y) {
    return false;
  }
  const i = indiceLocal(lx, ly, lz);
  const ant = chunk.blocos[i];
  const novo = id | 0;
  if (ant === novo) return false;
  chunk.blocos[i] = novo;
  atualizarSuperficieColuna(chunk, lx, ly);
  chunk.sujo = true;
  return true;
}

export function superficieLocal(chunk, lx, ly) {
  if (lx < 0 || ly < 0 || lx >= CHUNK_XZ || ly >= CHUNK_XZ) return 0;
  return chunk.superficie[ly * CHUNK_XZ + lx] | 0;
}

export function baseTopoLocal(chunk, lx, ly) {
  if (lx < 0 || ly < 0 || lx >= CHUNK_XZ || ly >= CHUNK_XZ) return -1;
  return chunk.baseTopo[ly * CHUNK_XZ + lx] | 0;
}

export function superficieBaixaLocal(chunk, lx, ly) {
  if (lx < 0 || ly < 0 || lx >= CHUNK_XZ || ly >= CHUNK_XZ) return 0;
  return chunk.superficieBaixa[ly * CHUNK_XZ + lx] | 0;
}

export function recalcularSuperficies(chunk) {
  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      atualizarSuperficieColuna(chunk, lx, ly);
    }
  }
}

function atualizarSuperficieColuna(chunk, lx, ly) {
  let topo = -1;
  for (let lz = CHUNK_Y - 1; lz >= 0; lz--) {
    if (ehSolido(chunk.blocos[indiceLocal(lx, ly, lz)])) {
      topo = lz;
      break;
    }
  }
  const i = ly * CHUNK_XZ + lx;
  if (topo < 0) {
    chunk.superficie[i] = 0;
    chunk.baseTopo[i] = -1;
    chunk.superficieBaixa[i] = 0;
    return;
  }
  let base = topo;
  while (base > 0 && ehSolido(chunk.blocos[indiceLocal(lx, ly, base - 1)])) {
    base--;
  }
  // walk height = face superior do bloco mais alto (lz ocupa [lz, lz+1])
  chunk.superficie[i] = topo + 1;
  chunk.baseTopo[i] = base;

  // Camada inferior: maior sólido estritamente abaixo do run do topo.
  if (base <= 0) {
    chunk.superficieBaixa[i] = 0;
    return;
  }
  let infTopo = -1;
  for (let lz = base - 1; lz >= 0; lz--) {
    if (ehSolido(chunk.blocos[indiceLocal(lx, ly, lz)])) {
      infTopo = lz;
      break;
    }
  }
  chunk.superficieBaixa[i] = infTopo < 0 ? 0 : infTopo + 1;
}

/**
 * Preenche coluna com `zTopo` unidades sólidas (blocos 0..zTopo-1).
 * Superfície caminhável = zTopo (igual ao heightmap antigo).
 */
export function preencherColunaSolida(chunk, lx, ly, zTopo) {
  const z = Math.max(0, Math.min(CHUNK_Y, zTopo | 0));
  for (let lz = 0; lz < CHUNK_Y; lz++) {
    chunk.blocos[indiceLocal(lx, ly, lz)] = BLOCO.AR;
  }
  for (let lz = 0; lz < z; lz++) {
    let id = BLOCO.PEDRA;
    if (lz === z - 1) id = z <= 1 ? BLOCO.GRAMA : BLOCO.TERRA;
    else if (lz >= z - 3 && z > 1) id = BLOCO.TERRA;
    chunk.blocos[indiceLocal(lx, ly, lz)] = id;
  }
  atualizarSuperficieColuna(chunk, lx, ly);
  chunk.sujo = true;
}
