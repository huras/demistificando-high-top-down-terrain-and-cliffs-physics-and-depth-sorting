/**
 * Visual da asa-delta — portado do Pokemon AI (leitura BOTW top-down).
 * Delta no plano do chão, nariz no vetor do voo.
 */
import { ESCALA, TILE } from "../config.js";
import { estaPlanando } from "../fisica/asaDelta.js";

const VELA = Object.freeze([
  Object.freeze([1.28, 0]),
  Object.freeze([-0.52, -1.18]),
  Object.freeze([-0.52, 1.18]),
]);

const QUILHA = Object.freeze([
  Object.freeze([-0.42, 0]),
  Object.freeze([1.12, 0]),
]);

const TRAVES = Object.freeze([
  Object.freeze([-0.22, -0.55, 1.12, 0]),
  Object.freeze([-0.22, 0.55, 1.12, 0]),
]);

const PERSPECTIVA_Y = 0.44;
const ATTACH = Object.freeze({ x: 0, y: -0.18 });

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} corpo
 * @param {number} px âncora tela (pés / centro)
 * @param {number} py
 * @param {number} [liftPx] elevação visual em pixels
 */
export function desenharAsaDelta(ctx, corpo, px, py, liftPx = 0) {
  if (!ctx || !estaPlanando(corpo)) return;
  const cs = TILE * ESCALA;
  const tempo = corpo._glideTempo ?? 0;
  const bob = Math.sin(tempo * 7.2) * cs * 0.035;
  const yaw = Number.isFinite(corpo._glideYaw) ? corpo._glideYaw : 0;
  const bank = corpo._glideBank ?? 0;
  const scale = cs * 0.9;
  const ax = px + ATTACH.x * cs;
  const ay = py - liftPx + ATTACH.y * cs + bob;

  ctx.save();
  ctx.translate(ax, ay);
  ctx.scale(scale, scale * PERSPECTIVA_Y);
  ctx.rotate(yaw + bank * 0.22);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(VELA[0][0], VELA[0][1]);
  ctx.lineTo(VELA[1][0], VELA[1][1]);
  ctx.lineTo(VELA[2][0], VELA[2][1]);
  ctx.closePath();
  ctx.fillStyle = "#5ec8c0";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(VELA[1][0], VELA[1][1]);
  ctx.lineTo(VELA[0][0], VELA[0][1]);
  ctx.lineTo(-0.12, 0);
  ctx.closePath();
  ctx.fillStyle = "#8fdad4";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(VELA[0][0], VELA[0][1]);
  ctx.lineTo(VELA[1][0], VELA[1][1]);
  ctx.lineTo(VELA[2][0], VELA[2][1]);
  ctx.closePath();
  ctx.strokeStyle = "#2f4a46";
  ctx.lineWidth = 0.08;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(QUILHA[0][0], QUILHA[0][1]);
  ctx.lineTo(QUILHA[1][0], QUILHA[1][1]);
  ctx.strokeStyle = "#8b5a2b";
  ctx.lineWidth = 0.11;
  ctx.stroke();

  ctx.beginPath();
  for (let i = 0; i < TRAVES.length; i++) {
    const t = TRAVES[i];
    ctx.moveTo(t[0], t[1]);
    ctx.lineTo(t[2], t[3]);
  }
  ctx.strokeStyle = "#c4894a";
  ctx.lineWidth = 0.065;
  ctx.stroke();

  ctx.restore();
}
