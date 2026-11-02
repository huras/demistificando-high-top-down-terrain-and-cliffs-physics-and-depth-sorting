/**
 * Pin da base do jogador no mapa / minimapa (player_base_32 do Pokemon AI).
 * Asset é 96×42 — preserva aspect (não estica em quadrado).
 */

const BASE_SRC = "./assets/ui/construir/player_base_32.png";
/** Aspect fallback se a imagem ainda não carregou. */
const ASPECT_FALLBACK = 96 / 42;

/** @type {HTMLImageElement | null} */
let img = null;
/** @type {Set<() => void>} */
const ouvintes = new Set();

function notificar() {
  if (!ouvintes.size) return;
  const fns = [...ouvintes];
  ouvintes.clear();
  for (const fn of fns) fn();
}

function pronta() {
  return !!(img?.complete && img.naturalWidth > 0);
}

function aspectAtual() {
  if (!pronta() || !img) return ASPECT_FALLBACK;
  return (img.naturalWidth || 1) / (img.naturalHeight || 1);
}

/**
 * @param {() => void} [aoPronto]
 */
export function aquecerPinBase(aoPronto) {
  if (typeof aoPronto === "function") ouvintes.add(aoPronto);
  if (typeof Image === "undefined") return null;
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.onload = notificar;
    img.onerror = notificar;
    img.src = BASE_SRC;
  }
  if (pronta()) notificar();
  return img;
}

/**
 * Eixo maior (largura do asset). Mini: scale 0.092 do Pokemon AI; mapa: bem legível.
 * @param {{ mini?: boolean, dpr?: number }} opts
 */
export function tamanhoPinBase(opts = {}) {
  const dpr = opts.dpr > 0 ? opts.dpr : 1;
  if (opts.mini) {
    const display = 220;
    const r = Math.max(10, Math.min(20, display * 0.092));
    return Math.round(r * 2 * dpr);
  }
  return Math.max(48, Math.round(64 * dpr));
}

/**
 * Caixa desenhada (aspect preservado) — útil pro offset do rótulo.
 * @param {{ mini?: boolean, dpr?: number }} opts
 * @returns {{ dw: number, dh: number, size: number }}
 */
export function dimensoesPinBase(opts = {}) {
  const size = tamanhoPinBase(opts);
  const aspect = aspectAtual();
  let dw = size;
  let dh = size;
  if (aspect > 1) dh = Math.max(1, Math.round(size / aspect));
  else if (aspect < 1) dw = Math.max(1, Math.round(size * aspect));
  return { dw, dh, size };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} icon
 * @param {number} px
 * @param {number} py
 * @param {number} size
 * @param {boolean} [shadow]
 */
function blitBase(ctx, icon, px, py, size, shadow) {
  const aspect = aspectAtual();
  let w = size;
  let h = size;
  if (aspect > 1) h = Math.max(1, Math.round(size / aspect));
  else if (aspect < 1) w = Math.max(1, Math.round(size * aspect));

  const cx = Math.round(px);
  const cy = Math.round(py);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
  if (shadow !== false) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = 1.5;
    ctx.shadowOffsetY = 1;
  }
  ctx.drawImage(icon, cx - w * 0.5, cy - h * 0.5, w, h);
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, tipo?: string }} marca
 * @param {number} sx
 * @param {number} sy
 * @param {{ mini?: boolean, dpr?: number, shadow?: boolean }} opts
 */
export function desenharPinBase(ctx, marca, sx, sy, opts = {}) {
  if (!ctx || !Number.isFinite(sx) || !Number.isFinite(sy)) return;
  void marca;
  aquecerPinBase();
  const size = tamanhoPinBase(opts);
  const dpr = opts.dpr > 0 ? opts.dpr : 1;
  if (pronta() && img) {
    blitBase(ctx, img, sx, sy, size, opts.shadow);
    return;
  }
  ctx.fillStyle = "rgba(220, 38, 38, 0.92)";
  ctx.beginPath();
  ctx.arc(sx, sy, Math.max(4, size * 0.14), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(15,23,42,0.55)";
  ctx.lineWidth = 1.2 * dpr;
  ctx.stroke();
}
