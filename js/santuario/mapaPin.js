/**
 * Pin de santuário no mapa global e minimapa.
 */
import { shrineMapColor } from "./catalogo.js";
import {
  drawTypeShield,
  ensureTypeShieldsLoaded,
  typeShieldsReady,
} from "./tipoEscudo.js";

let loadKicked = false;

/**
 * @param {{ mini?: boolean, dpr?: number, cleared?: boolean }} opts
 */
export function tamanhoPinSantuario(opts = {}) {
  const dpr = opts.dpr > 0 ? opts.dpr : 1;
  const base = opts.mini ? 15 : 22;
  const scale = opts.cleared ? 0.85 : 1;
  return Math.max(10, Math.round(base * scale * dpr));
}

function desenharFallbackTriangulo(ctx, sx, sy, size, cor) {
  const r = size * 0.42;
  ctx.beginPath();
  ctx.moveTo(sx, sy - r);
  ctx.lineTo(sx + r * 0.85, sy + r * 0.7);
  ctx.lineTo(sx - r * 0.85, sy + r * 0.7);
  ctx.closePath();
  ctx.fillStyle = cor || "#e2e8f0";
  ctx.fill();
  ctx.strokeStyle = "rgba(15, 23, 42, 0.75)";
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.stroke();
}

function desenharDisco(ctx, sx, sy, size) {
  const r = size * 0.52;
  ctx.beginPath();
  ctx.arc(sx, sy + size * 0.04, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15, 23, 42, 0.55)";
  ctx.fill();
}

function desenharCleared(ctx, sx, sy, size) {
  const r = size * 0.48;
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15, 23, 42, 0.38)";
  ctx.fill();
  ctx.strokeStyle = "rgba(248, 250, 252, 0.85)";
  ctx.lineWidth = Math.max(1.2, size * 0.08);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  const s = size * 0.22;
  ctx.moveTo(sx - s * 0.7, sy + s * 0.05);
  ctx.lineTo(sx - s * 0.15, sy + s * 0.55);
  ctx.lineTo(sx + s * 0.85, sy - s * 0.55);
  ctx.stroke();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ element?: string, cor?: string, cleared?: boolean }} marca
 * @param {number} sx
 * @param {number} sy
 * @param {{ mini?: boolean, dpr?: number }} [opts]
 */
export function desenharPinSantuario(ctx, marca, sx, sy, opts = {}) {
  if (!ctx || !Number.isFinite(sx) || !Number.isFinite(sy)) return;

  if (!loadKicked) {
    loadKicked = true;
    void ensureTypeShieldsLoaded();
  }

  const cleared = !!marca.cleared;
  const size = tamanhoPinSantuario({
    mini: !!opts.mini,
    dpr: opts.dpr,
    cleared,
  });
  const element = marca.element || "normal";
  const cor = marca.cor || shrineMapColor(element);

  desenharDisco(ctx, sx, sy, size);

  const ok = typeShieldsReady() && drawTypeShield(ctx, element, sx, sy, size);
  if (!ok) desenharFallbackTriangulo(ctx, sx, sy, size, cor);

  if (cleared) desenharCleared(ctx, sx, sy, size);
}

export function kickTypeShieldsLoad() {
  if (loadKicked) return;
  loadKicked = true;
  void ensureTypeShieldsLoaded();
}
