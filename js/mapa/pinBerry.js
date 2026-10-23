/**
 * Pin de berry no minimapa.
 */
import { imagemIcone } from "../jogo/icones.js";
import { BERRIES } from "../wild/catalogo.js";

/**
 * @param {{ mini?: boolean, dpr?: number }} opts
 */
export function tamanhoPinBerry(opts = {}) {
  const dpr = opts.dpr > 0 ? opts.dpr : 1;
  return Math.max(10, Math.round(13 * dpr));
}

function corBerry(key) {
  return BERRIES[key]?.cor || "#86efac";
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ berryKey?: string, cor?: string }} marca
 * @param {number} sx
 * @param {number} sy
 * @param {{ dpr?: number }} [opts]
 */
export function desenharPinBerry(ctx, marca, sx, sy, opts = {}) {
  if (!ctx || !Number.isFinite(sx) || !Number.isFinite(sy)) return;
  const size = tamanhoPinBerry(opts);
  const key = marca.berryKey || "oran";
  const half = size * 0.5;

  ctx.beginPath();
  ctx.arc(sx, sy + size * 0.03, half * 1.05, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15, 23, 42, 0.5)";
  ctx.fill();

  const img = imagemIcone(key);
  if (img?.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, sx - half, sy - half, size, size);
    return;
  }
  ctx.beginPath();
  ctx.arc(sx, sy, half * 0.7, 0, Math.PI * 2);
  ctx.fillStyle = marca.cor || corBerry(key);
  ctx.fill();
  ctx.strokeStyle = "rgba(15, 23, 42, 0.65)";
  ctx.lineWidth = Math.max(1, size * 0.08);
  ctx.stroke();
}
