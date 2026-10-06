import { CHUNK_XZ, CHUNK_Y } from "../../config.js";
import { preencherColunaSolida, recalcularSuperficies } from "./chunk.js";
import { fbm2, valueNoise3 } from "./ruido.js";
import { BLOCO, ehSolido } from "./tiposBloco.js";

/**
 * Gera terreno procedural no chunk (altura + cavernas esparsas).
 * Edits/patches aplicados depois pelo store.
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

      // cavernas: só no miolo da coluna
      for (let lz = 1; lz < h - 2; lz++) {
        const c = valueNoise3(wx * 0.08, wy * 0.08, lz * 0.12, seed + 77);
        if (c > 0.72) {
          chunk.blocos[((ly * CHUNK_XZ + lx) * CHUNK_Y + lz) | 0] = BLOCO.AR;
        }
      }
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
