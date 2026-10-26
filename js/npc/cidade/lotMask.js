/**
 * Células andáveis do lote residencial + avental sul da porta.
 */

const APRON_SUL = 1;

/**
 * @param {{
 *   lote: { x0: number, y0: number, x1: number, y1: number },
 *   x0: number, y0: number, x1: number, y1: number,
 *   portaLocal?: { x0: number, y0: number, x1: number, y1: number } | null
 * }} casa
 */
export function construirMascaraLote(casa) {
  const L = casa.lote || {
    x0: casa.x0 - 1,
    y0: casa.y0,
    x1: casa.x1 + 1,
    y1: casa.y1 + APRON_SUL,
  };
  const x0 = Math.floor(L.x0);
  const y0 = Math.floor(L.y0);
  const x1 = Math.ceil(L.x1) - 1;
  const y1 = Math.ceil(L.y1) - 1 + APRON_SUL;
  const cols = Math.max(1, x1 - x0 + 1);
  const rows = Math.max(1, y1 - y0 + 1);
  const cells = new Uint8Array(cols * rows);

  const fp = { x0: casa.x0, y0: casa.y0, x1: casa.x1, y1: casa.y1 };
  const porta = casa.portaLocal;
  const doorTx = porta
    ? Math.floor((porta.x0 + porta.x1) * 0.5)
    : Math.floor((fp.x0 + fp.x1) * 0.5);
  const southTy = Math.floor(fp.y1);

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const inDoor = ty === southTy && Math.abs(tx - doorTx) <= 1;
      const pad = 0.12;
      const inBody =
        tx + 1 - pad > fp.x0 &&
        tx + pad < fp.x1 &&
        ty + 1 - pad > fp.y0 &&
        ty + pad < fp.y1;
      if (inBody && !inDoor) continue;
      cells[(ty - y0) * cols + (tx - x0)] = 1;
    }
  }

  return {
    x0,
    y0,
    cols,
    rows,
    cells,
    has(tx, ty) {
      const lx = tx - this.x0;
      const ly = ty - this.y0;
      if (lx < 0 || ly < 0 || lx >= this.cols || ly >= this.rows) return false;
      return this.cells[ly * this.cols + lx] === 1;
    },
    nearest(wx, wy) {
      const tx0 = Math.floor(wx);
      const ty0 = Math.floor(wy);
      let best = null;
      let bestD = 1e9;
      for (let ty = this.y0; ty < this.y0 + this.rows; ty++) {
        for (let tx = this.x0; tx < this.x0 + this.cols; tx++) {
          if (!this.has(tx, ty)) continue;
          const d = (tx + 0.5 - wx) ** 2 + (ty + 0.5 - wy) ** 2;
          if (d < bestD) {
            bestD = d;
            best = { tx, ty };
          }
        }
      }
      if (!best && this.has(tx0, ty0)) return { tx: tx0, ty: ty0 };
      return best;
    },
  };
}
