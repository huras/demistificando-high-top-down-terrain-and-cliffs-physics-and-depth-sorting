/**
 * Pin de sítio outdoor no mapa / minimapa (emoji por tipo).
 */
import { TIPO_SITE } from "../mundo/sites/catalogo.js";

export const EMOJI_SITE = Object.freeze({
  [TIPO_SITE.FAZENDA]: "🌾",
  [TIPO_SITE.CEMITERIO]: "💀",
  [TIPO_SITE.POSTO]: "🏕️",
  [TIPO_SITE.DOCA]: "⚓",
  [TIPO_SITE.MIRANTE]: "🔭",
});

export const COR_SITE = Object.freeze({
  [TIPO_SITE.FAZENDA]: "#c4a35a",
  [TIPO_SITE.CEMITERIO]: "#7a8494",
  [TIPO_SITE.POSTO]: "#8b6b4a",
  [TIPO_SITE.DOCA]: "#4a8ab5",
  [TIPO_SITE.MIRANTE]: "#9a7b5a",
});

/**
 * @param {{ mini?: boolean, dpr?: number }} opts
 */
export function tamanhoPinSite(opts = {}) {
  const dpr = opts.dpr > 0 ? opts.dpr : 1;
  return Math.max(opts.mini ? 11 : 14, Math.round((opts.mini ? 13 : 18) * dpr));
}

export function emojiDoSite(subtipo) {
  return EMOJI_SITE[subtipo] || "📍";
}

export function corDoSite(subtipo) {
  return COR_SITE[subtipo] || "#d2b48c";
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ subtipo?: string, emoji?: string, cor?: string }} marca
 * @param {number} sx
 * @param {number} sy
 * @param {{ mini?: boolean, dpr?: number }} [opts]
 */
export function desenharPinSite(ctx, marca, sx, sy, opts = {}) {
  if (!ctx || !Number.isFinite(sx) || !Number.isFinite(sy)) return;
  const size = tamanhoPinSite(opts);
  const cor = marca.cor || corDoSite(marca.subtipo);
  const emoji = marca.emoji || emojiDoSite(marca.subtipo);
  const r = size * 0.52;

  // Sombra / disco de leitura no terrain
  ctx.beginPath();
  ctx.arc(sx, sy + size * 0.04, r * 1.05, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15, 23, 42, 0.5)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(sx, sy, r * 0.92, 0, Math.PI * 2);
  ctx.fillStyle = cor;
  ctx.fill();
  ctx.strokeStyle = "rgba(15, 23, 42, 0.72)";
  ctx.lineWidth = Math.max(1, size * 0.07);
  ctx.stroke();

  const fontPx = Math.max(9, Math.round(size * (opts.mini ? 0.72 : 0.78)));
  ctx.font = `${fontPx}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, sx, sy + fontPx * 0.05);
}
