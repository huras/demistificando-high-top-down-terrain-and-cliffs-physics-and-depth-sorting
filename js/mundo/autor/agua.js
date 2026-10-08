/**
 * Lago, rio raso e cachoeira — depois do preenchimento sólido do patch.
 * O chão da demo é altura 1, então a lâmina funda sobe a margem em vez de cavar.
 */
import { CHUNK_XZ, CHUNK_Y } from "../../config.js";
import { definirLocal, obterLocal } from "../voxel/chunk.js";
import { BLOCO } from "../voxel/tiposBloco.js";

/**
 * @returns {{ piso: number, a0?: number, a1?: number } | null}
 * piso = walk height. a0 inclusive, a1 exclusivo = células de água.
 */
export function celulaAguaDemo(wx, wy) {
  const x = wx | 0;
  const y = wy | 0;

  if (y >= 25 && y <= 29 && x >= 6 && x <= 16) {
    return { piso: 2 + (y - 25) };
  }
  if (y >= 30 && y <= 31 && x >= 6 && x <= 16) return { piso: 7 };
  if (y >= 32 && y <= 40 && x >= 6 && x <= 16) {
    if (x >= 8 && x <= 14) return { piso: 6, a0: 6, a1: 7 };
    return { piso: 7 };
  }
  if (y === 41 && x >= 8 && x <= 14) return { piso: 1, a0: 4, a1: 7 };

  if (x >= 6 && x <= 18 && y >= 42 && y <= 52) {
    const inlet = y === 42 && x >= 8 && x <= 14;
    const rim = x === 6 || x === 18 || y === 52 || (y === 42 && !inlet);
    if (rim) return { piso: 4 };
    const canal = x >= 8 && x <= 14 && y <= 43;
    const shore =
      !canal &&
      (x === 7 || x === 17 || y === 51 || (y === 43 && (x < 8 || x > 14)));
    if (shore) return { piso: 3, a0: 3, a1: 4 };
    return { piso: 1, a0: 1, a1: 4 };
  }

  if (y === 53 && x >= 6 && x <= 18) return { piso: 3 };
  if (y === 54 && x >= 6 && x <= 18) return { piso: 2 };
  if (y >= 42 && y <= 52 && x === 5) return { piso: 3 };
  if (y >= 42 && y <= 52 && x === 4) return { piso: 2 };
  if (y >= 42 && y <= 52 && x === 19) return { piso: 3 };
  if (y >= 42 && y <= 52 && x === 20) return { piso: 2 };
  return null;
}

function idPiso(lz, zTopo) {
  if (lz === zTopo - 1) return zTopo <= 1 ? BLOCO.GRAMA : BLOCO.TERRA;
  if (lz >= zTopo - 3 && zTopo > 1) return BLOCO.TERRA;
  return BLOCO.PEDRA;
}

export function aplicarAguaDemo(chunk) {
  const baseX = chunk.cx * CHUNK_XZ;
  const baseY = chunk.cy * CHUNK_XZ;
  let tocado = false;

  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const spec = celulaAguaDemo(baseX + lx, baseY + ly);
      if (!spec) continue;
      const piso = Math.max(1, Math.min(CHUNK_Y - 1, spec.piso | 0));
      for (let lz = 0; lz < piso; lz++) {
        const id = idPiso(lz, piso);
        if ((obterLocal(chunk, lx, ly, lz) | 0) !== id) {
          definirLocal(chunk, lx, ly, lz, id);
          tocado = true;
        }
      }
      const topoLimpo = Math.max(piso, (spec.a1 | 0) || piso);
      for (let lz = piso; lz <= topoLimpo && lz < CHUNK_Y; lz++) {
        if ((obterLocal(chunk, lx, ly, lz) | 0) !== BLOCO.AR) {
          definirLocal(chunk, lx, ly, lz, BLOCO.AR);
          tocado = true;
        }
      }
      if (spec.a0 == null || spec.a1 == null) continue;
      const a0 = spec.a0 | 0;
      const a1 = spec.a1 | 0;
      for (let lz = a0; lz < a1 && lz < CHUNK_Y; lz++) {
        if ((obterLocal(chunk, lx, ly, lz) | 0) !== BLOCO.AGUA) {
          definirLocal(chunk, lx, ly, lz, BLOCO.AGUA);
          tocado = true;
        }
      }
    }
  }

  if (tocado) chunk.sujo = true;
  return tocado;
}
