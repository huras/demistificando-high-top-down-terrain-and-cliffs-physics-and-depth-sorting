/**
 * Pin de missão no mapa / minimapa — ícone flag_32 do Pokemon AI.
 */

const FLAG_SRC = "./assets/ui/quest-board/flag_32.png";

/** @type {HTMLImageElement | null} */
let flagImg = null;
/** @type {Set<() => void>} */
const ouvintes = new Set();

function notificarPronta() {
  if (!ouvintes.size) return;
  const fns = [...ouvintes];
  ouvintes.clear();
  for (const fn of fns) fn();
}

function flagPronta() {
  return !!(flagImg?.complete && flagImg.naturalWidth > 0);
}

/**
 * Preload do sprite (idempotente).
 * @param {() => void} [aoPronto]
 */
export function aquecerPinMissao(aoPronto) {
  if (typeof aoPronto === "function") ouvintes.add(aoPronto);
  if (typeof Image === "undefined") return null;
  if (!flagImg) {
    flagImg = new Image();
    flagImg.decoding = "async";
    flagImg.onload = notificarPronta;
    flagImg.onerror = notificarPronta;
    flagImg.src = FLAG_SRC;
  }
  if (flagPronta()) notificarPronta();
  return flagImg;
}

/**
 * @param {{ mini?: boolean, dpr?: number }} opts
 */
export function tamanhoPinMissao(opts = {}) {
  const dpr = opts.dpr > 0 ? opts.dpr : 1;
  const display = opts.mini ? 220 : 480;
  // Paridade Pokemon AI: ~4.5% do minimapa, clamp 5–10 (mini) / um pouco maior no mapa.
  if (opts.mini) {
    const r = Math.max(5, Math.min(10, display * 0.045));
    return Math.round(r * 2 * dpr);
  }
  return Math.max(14, Math.round(18 * dpr));
}

/**
 * Projeta ponto fora da vista para a borda (cue BOTW / Pokemon AI).
 * No minimapa circular usa o raio; no mapa retangular, o retângulo inset.
 * @returns {{ x: number, y: number }}
 */
export function prenderPinNaBorda(px, py, w, h, opts = {}) {
  const padFrac = opts.padFrac ?? 0.06;
  const cx = w * 0.5;
  const cy = h * 0.5;
  const circular = opts.circular !== false && opts.mini;

  if (circular) {
    const pad = Math.min(w, h) * padFrac;
    const R = Math.min(w, h) * 0.5 - pad;
    const dx = px - cx;
    const dy = py - cy;
    const dist = Math.hypot(dx, dy);
    if (dist <= R || dist < 1e-4) return { x: px, y: py };
    const s = R / dist;
    return { x: cx + dx * s, y: cy + dy * s };
  }

  const padX = w * padFrac;
  const padY = h * padFrac;
  if (px >= padX && px <= w - padX && py >= padY && py <= h - padY) {
    return { x: px, y: py };
  }
  const dx = px - cx;
  const dy = py - cy;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return { x: cx, y: cy };
  const halfW = w * 0.5 - padX;
  const halfH = h * 0.5 - padY;
  const sx = halfW / Math.abs(dx);
  const sy = halfH / Math.abs(dy);
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

function blitFlag(ctx, px, py, size, shadow) {
  const img = aquecerPinMissao();
  if (!flagPronta()) {
    ctx.beginPath();
    ctx.arc(px, py, Math.max(2.5, size * 0.14), 0, Math.PI * 2);
    ctx.fillStyle = "rgba(250, 204, 21, 0.92)";
    ctx.fill();
    return false;
  }
  const natW = img.naturalWidth || 1;
  const natH = img.naturalHeight || 1;
  const aspect = natW / natH;
  let dw = size;
  let dh = size;
  if (aspect > 1) dh = Math.max(1, Math.round(size / aspect));
  else if (aspect < 1) dw = Math.max(1, Math.round(size * aspect));

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
  if (shadow !== false) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = 1.5;
    ctx.shadowOffsetY = 1;
  }
  ctx.drawImage(img, Math.round(px) - dw * 0.5, Math.round(py) - dh * 0.5, dw, dh);
  ctx.restore();
  return true;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ kind?: string }} marca
 * @param {number} sx
 * @param {number} sy
 * @param {{ mini?: boolean, dpr?: number, shadow?: boolean }} [opts]
 */
export function desenharPinMissao(ctx, marca, sx, sy, opts = {}) {
  if (!ctx || !Number.isFinite(sx) || !Number.isFinite(sy)) return;
  void marca;
  aquecerPinMissao();
  const size = tamanhoPinMissao(opts);
  blitFlag(ctx, sx, sy, size, opts.shadow);
}
