/**
 * Autoria de decks / pontes overhang — coloca sólidos sem preencher a coluna.
 */
import { CHUNK_XZ, CHUNK_Y } from "../../config.js";
import { definirLocal } from "../voxel/chunk.js";
import { BLOCO } from "../voxel/tiposBloco.js";

/**
 * Coloca um deck retangular no chunk (só células que caem neste chunk).
 * zBloco = lz do sólido; walk height = zBloco + 1.
 * Não toca blocos abaixo — o void fica sob o deck.
 */
export function aplicarDeckRetangular(chunk, opts) {
  const x0 = opts.x0 | 0;
  const x1 = opts.x1 | 0;
  const y0 = opts.y0 | 0;
  const y1 = opts.y1 | 0;
  const zBloco = opts.zBloco | 0;
  const id = opts.id ?? BLOCO.PEDRA;

  if (zBloco < 0 || zBloco >= CHUNK_Y) return false;

  const xa = Math.min(x0, x1);
  const xb = Math.max(x0, x1);
  const ya = Math.min(y0, y1);
  const yb = Math.max(y0, y1);

  const baseX = chunk.cx * CHUNK_XZ;
  const baseY = chunk.cy * CHUNK_XZ;
  let tocado = false;

  for (let wy = ya; wy <= yb; wy++) {
    for (let wx = xa; wx <= xb; wx++) {
      const lx = wx - baseX;
      const ly = wy - baseY;
      if (lx < 0 || ly < 0 || lx >= CHUNK_XZ || ly >= CHUNK_XZ) continue;
      definirLocal(chunk, lx, ly, zBloco, id);
      tocado = true;
    }
  }

  if (tocado) chunk.sujo = true;
  return tocado;
}

/** Deck CUME×1 (leste 51) → CUME×2 (oeste 72), walk z=17. */
export const DECK_CUMES = {
  x0: 52,
  x1: 71,
  y0: 35,
  y1: 36,
  zBloco: 16,
  id: BLOCO.PEDRA,
};
