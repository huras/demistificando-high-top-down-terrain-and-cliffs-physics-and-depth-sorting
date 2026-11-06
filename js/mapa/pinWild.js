/**
 * Pin de wild no mapa / minimapa — ícones `sprites/pokemon/{gen}/minimap`
 * do Pokemon AI. Já vêm redondos com transparência: desenha o size inteiro,
 * sem clip nem anel.
 */
import { pedirIconeMinimap, enfileirarIconeMinimap, espiarIconeMinimap } from "../pokemon/minimapIcone.js";
import { especie } from "../pokemon/dados.js";

const ZOOM_HIDE_MUNDO = 0.8;

/** @type {Map<string, HTMLImageElement>} */
const ultimoBom = new Map();

/**
 * Diâmetro do pin. Paridade Pokemon AI: r = clamp(display×0.075, 6…12) no mini.
 * @param {{ mini?: boolean, dpr?: number }} opts
 */
export function tamanhoPinWild(opts = {}) {
  const dpr = opts.dpr > 0 ? opts.dpr : 1;
  const display = opts.mini ? 220 : 480;
  const r = opts.mini
    ? Math.max(6, Math.min(12, display * 0.075))
    : Math.max(8, Math.min(14, display * 0.035));
  return Math.round(r * 2 * dpr * 1.2);
}

export function wildPinVisivelNoZoom(vista) {
  if (!vista || vista.mini) return true;
  return (vista.zoom ?? 1) >= ZOOM_HIDE_MUNDO;
}

/**
 * Preload do ícone de minimapa (chamado pelo pintar quando há wilds na vista).
 * @param {number} dex
 * @param {boolean} [shiny]
 */
export function aquecerPinWild(dex, shiny = false) {
  return enfileirarIconeMinimap(dex, shiny);
}

function desenharBadge(ctx, sx, sy, iconR, count) {
  const n = count | 0;
  if (n <= 1) return;
  const label = n > 99 ? "99+" : String(n);
  const badgeR = Math.max(5, Math.min(9, iconR * 0.45));
  const bx = Math.round(sx + iconR * 0.68);
  const by = Math.round(sy + iconR * 0.68);
  const fontPx = Math.max(7, Math.min(10, badgeR * 1.15));

  ctx.save();
  ctx.beginPath();
  ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  ctx.fill();
  ctx.strokeStyle = "rgba(248, 250, 252, 0.88)";
  ctx.lineWidth = Math.max(1, badgeR * 0.14);
  ctx.stroke();
  ctx.fillStyle = "#f8fafc";
  ctx.font = `700 ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, bx, by + 0.5);
  ctx.restore();
}

function imgPronta(img) {
  return !!(img && img.complete && img.naturalWidth > 0);
}

/**
 * Sprite inteiro no size — sem clip/anel (transparência natural do asset).
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} icon
 * @param {number} px
 * @param {number} py
 * @param {number} r
 */
function blitIconeCheio(ctx, icon, px, py, r) {
  const cx = Math.round(px);
  const cy = Math.round(py);
  const size = Math.max(2, Math.round(r * 2));
  const half = size * 0.5;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
  ctx.drawImage(icon, cx - half, cy - half, size, size);
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ id?: string, dex?: number, shiny?: boolean, count?: number, speciesKey?: string }} marca
 * @param {number} sx
 * @param {number} sy
 * @param {{ mini?: boolean, dpr?: number, semRede?: boolean }} [opts]
 */
export function desenharPinWild(ctx, marca, sx, sy, opts = {}) {
  if (!ctx || !Number.isFinite(sx) || !Number.isFinite(sy)) return;
  const size = tamanhoPinWild(opts);
  const r = size * 0.5;
  const dex = (marca.dex | 0) || (especie(marca.speciesKey)?.dex | 0);
  const pinKey = String(marca.id || `${dex}:${marca.speciesKey || ""}`);
  const semRede = !!opts.semRede;
  const icone = semRede ? espiarIconeMinimap : pedirIconeMinimap;

  let img = dex > 0 ? icone(dex, !!marca.shiny) : null;
  if (!imgPronta(img) && marca.shiny && dex > 0) {
    img = icone(dex, false);
  }
  if (imgPronta(img)) {
    ultimoBom.set(pinKey, img);
  } else {
    img = ultimoBom.get(pinKey) || null;
  }

  if (imgPronta(img)) {
    blitIconeCheio(ctx, img, sx, sy, r);
  } else {
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(2.5, r * 0.35), 0, Math.PI * 2);
    ctx.fillStyle = "rgba(250, 204, 21, 0.92)";
    ctx.fill();
    ctx.strokeStyle = "rgba(15, 23, 42, 0.85)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  desenharBadge(ctx, sx, sy, r, marca.count | 0);
}
