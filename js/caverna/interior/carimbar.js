/**
 * Carimba o interior ativo no chunk do bolso.
 * Chão na cota da praça, vão de 3 blocos, laje de teto, muro até o teto.
 */
import { CHUNK_XZ, CHUNK_Y } from "../../config.js";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { ORIGEM_CAVERNA_X, ORIGEM_CAVERNA_Y } from "../../mundo/bounds.js";
import { definirLocal, preencherColunaSolida } from "../../mundo/voxel/chunk.js";
import { BLOCO } from "../../mundo/voxel/tiposBloco.js";
import { CHAO, MURO, PORTA, classeDaCelula } from "./gerar.js";
import { layoutAtivo } from "./sessao.js";

const FOLGA = 3;

export function dentroDoTerrenoCaverna(wx, wy) {
  const lay = layoutAtivo();
  if (!lay) return false;
  return (
    wx >= ORIGEM_CAVERNA_X - 2 &&
    wy >= ORIGEM_CAVERNA_Y - 2 &&
    wx < ORIGEM_CAVERNA_X + lay.cols + 2 &&
    wy < ORIGEM_CAVERNA_Y + lay.rows + 2
  );
}

export function aplicarCavernaNoChunk(chunk) {
  const lay = layoutAtivo();
  if (!lay) return false;
  const baseX = chunk.cx * CHUNK_XZ;
  const baseY = chunk.cy * CHUNK_XZ;
  const x1 = baseX + CHUNK_XZ;
  const y1 = baseY + CHUNK_XZ;
  const mundoX1 = ORIGEM_CAVERNA_X + lay.cols;
  const mundoY1 = ORIGEM_CAVERNA_Y + lay.rows;
  if (x1 <= ORIGEM_CAVERNA_X || y1 <= ORIGEM_CAVERNA_Y || baseX >= mundoX1 || baseY >= mundoY1) {
    return false;
  }
  let mudou = false;
  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const wx = baseX + lx;
      const wy = baseY + ly;
      const tx = wx - ORIGEM_CAVERNA_X;
      const ty = wy - ORIGEM_CAVERNA_Y;
      if (tx < 0 || ty < 0 || tx >= lay.cols || ty >= lay.rows) continue;
      const classe = classeDaCelula(lay, tx, ty);
      if (classe === CHAO) escreverChaoCaverna(chunk, lx, ly);
      else if (classe === MURO || classe === PORTA) escreverMuro(chunk, lx, ly);
      mudou = true;
    }
  }
  return mudou;
}

export function escreverChaoCaverna(chunk, lx, ly) {
  const topo = Math.min(CHUNK_Y - FOLGA - 1, ALTURA_PRACA);
  preencherColunaSolida(chunk, lx, ly, topo, BLOCO.PEDRA);
  const teto = topo + FOLGA;
  if (teto < CHUNK_Y) definirLocal(chunk, lx, ly, teto, BLOCO.PEDRA);
}

function escreverMuro(chunk, lx, ly) {
  const topo = Math.min(CHUNK_Y, ALTURA_PRACA + FOLGA + 1);
  preencherColunaSolida(chunk, lx, ly, topo, BLOCO.PEDRA);
}
