import { CHUNK_XZ, CHUNK_Y } from "../../config.js";
import { preencherColunaSolida, recalcularSuperficies } from "./chunk.js";
import { fbm2 } from "./ruido.js";
import { BLOCO, ehSolido } from "./tiposBloco.js";

/**
 * Gera terreno procedural no chunk (coluna sólida por altura).
 * Sem cavernas: a física/nav é surface-walking — buracos internos
 * só abriam “cuevas” visuais no cliff sem dá pra entrar.
 */
export function gerarChunkProcedural(chunk, seed) {
  const baseX = chunk.cx * CHUNK_XZ;
  const baseY = chunk.cy * CHUNK_XZ;

  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const wx = baseX + lx;
      const wy = baseY + ly;
      const n = fbm2(wx * 0.035, wy * 0.035, seed);
      const h = Math.max(1, Math.min(28, Math.floor(3 + n * 14)));
      preencherColunaSolida(chunk, lx, ly, h);
    }
  }

  // garante piso em z=0
  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const i = ((ly * CHUNK_XZ + lx) * CHUNK_Y) | 0;
      if (!ehSolido(chunk.blocos[i])) chunk.blocos[i] = BLOCO.PEDRA;
    }
  }

  recalcularSuperficies(chunk);
  chunk.gerado = true;
  chunk.sujo = true;
}
