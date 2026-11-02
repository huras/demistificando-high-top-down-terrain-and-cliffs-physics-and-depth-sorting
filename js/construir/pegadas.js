/**
 * Pegadas AABB / discos para validação e colisão.
 */
import { pegadaCasa } from "./catalogo.js";

/**
 * @param {number} cx
 * @param {number} cy
 * @param {number} cols
 * @param {number} rows
 */
export function footprintEm(cx, cy, cols, rows) {
  const halfW = cols / 2;
  const halfH = rows / 2;
  return {
    x0: cx - halfW,
    y0: cy - halfH,
    x1: cx + halfW,
    y1: cy + halfH,
    cols: cols | 0,
    rows: rows | 0,
  };
}

/**
 * @param {number} aimX
 * @param {number} aimY
 * @param {number} cols
 * @param {number} rows
 */
export function snapOrigemCasa(aimX, aimY, cols, rows) {
  const x0 = Math.floor(aimX - cols / 2);
  const y0 = Math.floor(aimY - rows / 2);
  return {
    x: x0 + cols / 2,
    y: y0 + rows / 2,
    x0,
    y0,
    cols: cols | 0,
    rows: rows | 0,
  };
}

/**
 * Retângulos sólidos da casa (base inteira = footprint).
 * @param {string} buildingId
 * @param {{ x0: number, y0: number, x1: number, y1: number, cols?: number, rows?: number }} fp
 */
export function blockersCasa(buildingId, fp) {
  if (!fp) return [];
  return [
    {
      x0: fp.x0,
      y0: fp.y0,
      x1: fp.x1,
      y1: fp.y1,
      buildingId,
    },
  ];
}

/**
 * @param {object} house
 */
export function blockersCasaRegistro(house) {
  if (!house) return [];
  const cols = house.cols || pegadaCasa(house.buildingId).cols;
  const rows = house.rows || pegadaCasa(house.buildingId).rows;
  const fp = footprintEm(house.x, house.y, cols, rows);
  return blockersCasa(house.buildingId, fp);
}

/**
 * @param {{ x0:number,y0:number,x1:number,y1:number }} a
 * @param {{ x0:number,y0:number,x1:number,y1:number }|{ x0:number,y0:number,x1:number,y1:number }[]} b
 */
export function overlapRects(a, b) {
  if (!a) return false;
  const lista = Array.isArray(b) ? b : b ? [b] : [];
  for (const r of lista) {
    if (!r) continue;
    if (a.x0 < r.x1 && a.x1 > r.x0 && a.y0 < r.y1 && a.y1 > r.y0) return true;
  }
  return false;
}

/**
 * @param {object[]} blockers
 * @param {object|object[]} other
 */
export function anyBlockerOverlaps(blockers, other) {
  if (!blockers?.length) return false;
  for (const b of blockers) {
    if (overlapRects(b, other)) return true;
  }
  return false;
}

/**
 * @param {object[]} blockers
 * @param {{ x0:number,y0:number,x1:number,y1:number }} rect
 */
export function blockersInsideRect(blockers, rect) {
  if (!blockers?.length || !rect) return false;
  for (const b of blockers) {
    if (
      b.x0 < rect.x0 ||
      b.y0 < rect.y0 ||
      b.x1 > rect.x1 ||
      b.y1 > rect.y1
    ) {
      return false;
    }
  }
  return true;
}

/**
 * @param {object[]} boxes
 */
export function unionBoxes(boxes) {
  if (!boxes?.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const b of boxes) {
    if (!b) continue;
    if (b.x0 < x0) x0 = b.x0;
    if (b.y0 < y0) y0 = b.y0;
    if (b.x1 > x1) x1 = b.x1;
    if (b.y1 > y1) y1 = b.y1;
  }
  if (!Number.isFinite(x0)) return null;
  return { x0, y0, x1, y1 };
}

/**
 * Discos de colisão cobrindo o footprint (grade ~1m).
 * @param {{ x0:number,y0:number,x1:number,y1:number }} fp
 * @param {number} [z]
 */
export function discosDoFootprint(fp, z = 0) {
  if (!fp) return [];
  const discos = [];
  const x0 = Math.floor(fp.x0);
  const y0 = Math.floor(fp.y0);
  const x1 = Math.ceil(fp.x1);
  const y1 = Math.ceil(fp.y1);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      discos.push({
        x: x + 0.5,
        y: y + 0.5,
        z,
        r: 0.55,
        tipo: "baseCasa",
      });
    }
  }
  return discos;
}

/**
 * @param {number} px
 * @param {number} py
 * @param {number} [pr]
 * @param {object[]} blockers
 */
export function jogadorSobrepoe(px, py, pr, blockers) {
  const r = Number.isFinite(pr) ? pr : 0.45;
  const pref = { x0: px - r, y0: py - r, x1: px + r, y1: py + r };
  return anyBlockerOverlaps(blockers, pref);
}

/**
 * Móvel outdoor: 1 célula.
 */
export function blockersMovel(x, y, cols = 1, rows = 1) {
  return [
    {
      x0: Math.floor(x),
      y0: Math.floor(y),
      x1: Math.floor(x) + (cols | 0),
      y1: Math.floor(y) + (rows | 0),
    },
  ];
}
