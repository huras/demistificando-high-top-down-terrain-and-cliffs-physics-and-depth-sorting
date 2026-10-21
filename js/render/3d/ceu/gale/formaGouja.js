/** Rajada Wind Waker — Bezier com pontas afiadas. */

export const VARIANTES_GALE = Object.freeze([
  { bend: 0.028, hook: 0.055 },
  { bend: -0.032, hook: 0.062 },
  { bend: 0.018, hook: 0.042 },
  { bend: -0.022, hook: 0.05 },
]);

export const PASSOS_FAIXA = 10;

const _pt = { x: 0, y: 0 };
const _tg = { x: 0, y: 0 };
const _curva = { cx: 0, cy: 0, len: 0 };

export function controleCurva(x0, y0, x1, y1, v, cxEx, cyEx) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (!(len > 0.4)) return null;
  const px = -dy / len;
  const py = dx / len;
  if (Number.isFinite(cxEx) && Number.isFinite(cyEx)) {
    const bend = v.bend * len * 0.35;
    _curva.len = len;
    _curva.cx = cxEx + px * bend;
    _curva.cy = cyEx + py * bend;
    return _curva;
  }
  const bend = v.bend * len;
  const hook = v.hook * len * 0.35;
  _curva.len = len;
  _curva.cx = x0 + dx * 0.72 + px * bend + dx * 0.04 - (dx / len) * hook;
  _curva.cy = y0 + dy * 0.72 + py * bend + dy * 0.04 - (dy / len) * hook;
  return _curva;
}

export function pontoBezier(x0, y0, cx, cy, x1, y1, t, out = _pt) {
  const u = 1 - t;
  out.x = u * u * x0 + 2 * u * t * cx + t * t * x1;
  out.y = u * u * y0 + 2 * u * t * cy + t * t * y1;
  return out;
}

export function tangenteBezier(x0, y0, cx, cy, x1, y1, t, out = _tg) {
  const u = 1 - t;
  out.x = 2 * u * (cx - x0) + 2 * t * (x1 - cx);
  out.y = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
  return out;
}

/** Largura da faixa: grossa no meio, ponta fina. */
export function perfilLargura(t, halfBase) {
  const s = Math.sin(Math.PI * Math.max(0, Math.min(1, t)));
  return halfBase * Math.pow(s, 1.22);
}
