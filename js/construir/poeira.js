/**
 * Fumaça / poeira no perímetro do footprint durante o ritual.
 */
import { emitirLascas } from "../campo/fx.js";
import { alturaDoRelevo } from "../mundo/bioma/catalogo.js";

/**
 * @param {{ x0:number,y0:number,x1:number,y1:number }|null} rect
 * @param {{ intensidade?: number }} [opts]
 */
export function explodirPoeiraPerimetro(rect, opts = {}) {
  if (!rect) return;
  const n = Math.max(1, opts.intensidade | 0 || 2);
  const pts = [
    [rect.x0, rect.y0],
    [(rect.x0 + rect.x1) * 0.5, rect.y0],
    [rect.x1, rect.y0],
    [rect.x1, (rect.y0 + rect.y1) * 0.5],
    [rect.x1, rect.y1],
    [(rect.x0 + rect.x1) * 0.5, rect.y1],
    [rect.x0, rect.y1],
    [rect.x0, (rect.y0 + rect.y1) * 0.5],
  ];
  for (const [x, y] of pts) {
    emitirLascas(x, y, n);
  }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} [cols]
 * @param {number} [rows]
 */
export function poeiraNoFootprint(x, y, cols = 4, rows = 4) {
  const halfW = cols / 2;
  const halfH = rows / 2;
  explodirPoeiraPerimetro({
    x0: x - halfW,
    y0: y - halfH,
    x1: x + halfW,
    y1: y + halfH,
  }, { intensidade: 3 });
}

/**
 * @param {object} preview
 */
export function poeiraDoPreview(preview) {
  if (!preview) return;
  if (Number.isFinite(preview.tx) && Number.isFinite(preview.ty)) {
    emitirLascas(preview.tx + 0.5, preview.ty + 0.5, 4);
    return;
  }
  const cols = preview.cols || 4;
  const rows = preview.rows || 4;
  const x = preview.x ?? 0;
  const y = preview.y ?? 0;
  poeiraNoFootprint(x, y, cols, rows);
  void alturaDoRelevo;
}
