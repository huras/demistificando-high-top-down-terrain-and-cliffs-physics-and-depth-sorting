/**
 * Pin de wild home (retrato + badge de stack).
 * Mantém último retrato bom por marca pra não piscar bola amarela no reload.
 */
import { pedirRetrato } from "../pokemon/retrato.js";
import { especie } from "../pokemon/dados.js";

const ZOOM_HIDE_MUNDO = 0.8;

/** @type {Map<string, HTMLImageElement>} */
const ultimoBom = new Map();

/**
 * @param {{ mini?: boolean, dpr?: number, count?: number }} opts
 */
export function tamanhoPinWild(opts = {}) {
  const dpr = opts.dpr > 0 ? opts.dpr : 1;
  const base = opts.mini ? 16 : 20;
  return Math.max(12, Math.round(base * dpr));
}

export function wildPinVisivelNoZoom(vista) {
  if (!vista || vista.mini) return true;
  return (vista.zoom ?? 1) >= ZOOM_HIDE_MUNDO;
}

function desenharBadge(ctx, sx, sy, size, count) {
  if (!(count > 1)) return;
  const r = Math.max(6, size * 0.28);
  const bx = sx + size * 0.38;
  const by = sy - size * 0.38;
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
  ctx.fill();
  ctx.strokeStyle = "rgba(248, 250, 252, 0.9)";
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.stroke();
  ctx.fillStyle = "#f8fafc";
  ctx.font = `600 ${Math.max(8, Math.round(r * 1.15))}px "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(count > 99 ? "99+" : count), bx, by + 0.5);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

function imgPronta(img) {
  return !!(img && img.complete && img.naturalWidth > 0);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ id?: string, dex?: number, shiny?: boolean, count?: number, speciesKey?: string }} marca
 * @param {number} sx
 * @param {number} sy
 * @param {{ mini?: boolean, dpr?: number }} [opts]
 */
export function desenharPinWild(ctx, marca, sx, sy, opts = {}) {
  if (!ctx || !Number.isFinite(sx) || !Number.isFinite(sy)) return;
  const size = tamanhoPinWild({ ...opts, count: marca.count });
  const half = size * 0.5;
  const dex = (marca.dex | 0) || (especie(marca.speciesKey)?.dex | 0);
  const pinKey = String(marca.id || `${dex}:${marca.speciesKey || ""}`);

  ctx.beginPath();
  ctx.arc(sx, sy + size * 0.04, half * 1.08, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15, 23, 42, 0.55)";
  ctx.fill();

  let img = dex > 0 ? pedirRetrato(dex, !!marca.shiny) : null;
  if (!imgPronta(img) && marca.shiny && dex > 0) {
    img = pedirRetrato(dex, false);
  }
  if (imgPronta(img)) {
    ultimoBom.set(pinKey, img);
  } else {
    img = ultimoBom.get(pinKey) || null;
  }

  if (imgPronta(img)) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, half * 0.92, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, sx - half, sy - half, size, size);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(sx, sy, half * 0.92, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(248, 250, 252, 0.35)";
    ctx.lineWidth = Math.max(1, size * 0.06);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(sx, sy, half * 0.65, 0, Math.PI * 2);
    ctx.fillStyle = "#facc15";
    ctx.fill();
  }

  desenharBadge(ctx, sx, sy, size, marca.count | 0);
}
