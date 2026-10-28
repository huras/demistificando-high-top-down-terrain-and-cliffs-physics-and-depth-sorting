/**
 * Carimba o dungeon do santuário ativo nos chunks do bolso.
 */
import { CHUNK_XZ, CHUNK_Y } from "../config.js";
import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";
import { definirLocal, preencherColunaSolida } from "../mundo/voxel/chunk.js";
import { BLOCO } from "../mundo/voxel/tiposBloco.js";
import {
  ALTURA_PAREDE_SANTUARIO,
  ORIGEM_SANTUARIO_X,
  ORIGEM_SANTUARIO_Y,
  SHRINE_INTERIOR_COLS,
  SHRINE_INTERIOR_ROWS,
  dentroDoTerrenoSantuario,
  santuarioAtivo,
} from "./interior.js";

function ehChao(mask, cols, rows, lx, ly) {
  if (lx < 0 || ly < 0 || lx >= cols || ly >= rows) return false;
  return mask[ly * cols + lx] === 1;
}

export function aplicarSantuarioNoChunk(chunk) {
  const hub = santuarioAtivo();
  if (!hub) return false;
  const baseX = chunk.cx * CHUNK_XZ;
  const baseY = chunk.cy * CHUNK_XZ;
  const zParede = Math.min(CHUNK_Y, ALTURA_PRACA + ALTURA_PAREDE_SANTUARIO);
  const mask = hub.walkMask || hub.floorMask;
  const cols = hub.cols | 0;
  const rows = hub.rows | 0;
  let mudou = false;

  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const wx = baseX + lx;
      const wy = baseY + ly;
      if (!dentroDoTerrenoSantuario(wx, wy)) continue;

      const tx = wx - ORIGEM_SANTUARIO_X;
      const ty = wy - ORIGEM_SANTUARIO_Y;
      const dentro =
        tx >= 0 && ty >= 0 && tx < SHRINE_INTERIOR_COLS && ty < SHRINE_INTERIOR_ROWS;
      const walk = dentro && ehChao(mask, cols, rows, tx, ty);

      // Pad +/-8: sem chão (void). Interior !walk: muro sólido.
      if (!walk) {
        if (dentro) {
          preencherColunaSolida(chunk, lx, ly, ALTURA_PRACA, BLOCO.PEDRA);
          for (let z = ALTURA_PRACA; z < zParede; z++) {
            definirLocal(chunk, lx, ly, z, BLOCO.PEDRA);
          }
        }
        mudou = true;
        continue;
      }

      preencherColunaSolida(chunk, lx, ly, ALTURA_PRACA, BLOCO.PEDRA);

      if (
        !ehChao(mask, cols, rows, tx - 1, ty) ||
        !ehChao(mask, cols, rows, tx + 1, ty) ||
        !ehChao(mask, cols, rows, tx, ty - 1) ||
        !ehChao(mask, cols, rows, tx, ty + 1)
      ) {
        // Borda do corredor: pilastra baixa
        definirLocal(chunk, lx, ly, ALTURA_PRACA, BLOCO.PEDRA);
      }

      // Totem: bloco um pouco mais alto
      if (hub.totem) {
        const dx = wx + 0.5 - hub.totem.x;
        const dy = wy + 0.5 - hub.totem.y;
        if (dx * dx + dy * dy < 0.55 * 0.55) {
          for (let z = ALTURA_PRACA; z < ALTURA_PRACA + 2 && z < CHUNK_Y; z++) {
            definirLocal(chunk, lx, ly, z, BLOCO.PEDRA);
          }
        }
      }
      mudou = true;
    }
  }
  return mudou;
}
