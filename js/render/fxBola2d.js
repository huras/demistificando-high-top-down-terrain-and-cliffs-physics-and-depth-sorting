import { ESCALA, TILE } from "../config.js";
import { aneisBola, faiscasBola, flashesBola } from "../fx/fxBola.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import { chaveEntidade, empilhar } from "./ordenacaoProfundidade.js";

const PX = TILE * ESCALA;
const desenhoFaisca = [];
const desenhoAnel = [];
const desenhoFlash = [];

function estrela(ctx, x, y, raio) {
  const interno = raio * 0.38;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4 - Math.PI / 2;
    const rad = i % 2 === 0 ? raio : interno;
    const px = x + Math.cos(ang) * rad;
    const py = y + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function pintarFaisca(ctx, i) {
  const p = faiscasBola()[i];
  if (!p?.viva) return;
  const alfa = Math.max(0, p.vida / (p.vidaMax || 0.4));
  if (alfa <= 0) return;
  const x = mundoParaTelaX(p.x);
  const y = mundoParaTelaY(p.y, p.z, 0);
  const r = Math.max(1.1, p.tam * PX);
  ctx.save();
  ctx.globalAlpha = 0.3 + 0.7 * alfa;
  if (p.traco) {
    const vel = Math.hypot(p.vx, p.vy) || 1;
    const len = r * (2.2 + alfa * 1.8);
    const dx = (p.vx / vel) * len;
    const dy = (p.vy / vel) * len;
    ctx.strokeStyle = `rgb(${p.r},${p.g},${p.b})`;
    ctx.lineWidth = Math.max(1.2, r * 0.75);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - dx * 0.3, y - dy * 0.3);
    ctx.lineTo(x + dx * 0.7, y + dy * 0.7);
    ctx.stroke();
  }
  if (p.estrela) {
    ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
    estrela(ctx, x, y, r * 1.35);
    ctx.globalAlpha *= 0.55 + 0.4 * alfa;
    ctx.fillStyle = "#fff";
    estrela(ctx, x, y, r * 0.55);
  } else {
    ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha *= 0.5 + 0.4 * alfa;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function pintarAnel(ctx, i) {
  const an = aneisBola()[i];
  if (!an?.viva || an.idade < 0) return;
  const max = an.vidaMax || 0.7;
  const t = 1 - Math.max(0, an.vida) / max;
  const x = mundoParaTelaX(an.x);
  const y = mundoParaTelaY(an.y, an.z, 0);
  const raio = (an.inicio + (an.fim - an.inicio) * Math.min(1, t)) * PX;
  if (raio <= 0) return;
  const fade = an.vida / max;
  const alfa = an.suave
    ? Math.max(0, fade * (1 - t) * 0.55)
    : Math.max(0, fade * (t < 0.15 ? t / 0.15 : 1) * 0.9);
  if (alfa <= 0.01) return;
  ctx.save();
  if (an.preenche) {
    const cheio = an.suave ? alfa * 0.55 : alfa * 0.35;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, raio);
    if (an.branco) {
      grd.addColorStop(0, `rgba(255,255,255,${cheio})`);
      grd.addColorStop(0.55, `rgba(255,248,230,${cheio * 0.45})`);
      grd.addColorStop(1, "rgba(255,255,255,0)");
    } else {
      grd.addColorStop(0, `rgba(${an.r},${an.g},${an.b},${cheio})`);
      grd.addColorStop(1, `rgba(${an.r},${an.g},${an.b},0)`);
    }
    ctx.beginPath();
    ctx.arc(x, y, raio, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y, raio, 0, Math.PI * 2);
  ctx.strokeStyle = an.branco ? `rgba(255,255,255,${alfa * 0.85})` : `rgba(${an.r},${an.g},${an.b},${alfa})`;
  ctx.lineWidth = Math.max(1.5, (an.espessura || 0.08) * PX * (an.suave ? 2.2 : 1));
  ctx.stroke();
  if (!an.suave && t < 0.45) {
    ctx.beginPath();
    ctx.arc(x, y, raio * 0.92, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(254,243,199,${alfa * 0.45})`;
    ctx.lineWidth = Math.max(1, ctx.lineWidth * 0.45);
    ctx.stroke();
  }
  ctx.restore();
}

function pintarFlash(ctx, i) {
  const f = flashesBola()[i];
  if (!f?.viva) return;
  const max = f.vidaMax || 0.4;
  const t = Math.max(0, f.vida / max);
  if (t <= 0) return;
  const x = mundoParaTelaX(f.x);
  const y = mundoParaTelaY(f.y, f.z, 0);
  const r = Math.max(2, (f.raio || 0.4) * PX);
  const recolhe = f.tipo === "recolher";
  const pulso = 0.6 + 0.4 * Math.sin((1 - t) * Math.PI * 5);
  const externo = r * (recolhe ? 1.15 + t * 0.35 : 1.25 + (1 - t) * 0.6);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, externo, 0, Math.PI * 2);
  ctx.strokeStyle = recolhe
    ? `rgba(248,113,113,${0.22 + 0.55 * t * pulso})`
    : `rgba(255,255,255,${0.28 + 0.55 * t * pulso})`;
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.stroke();
  const grd = ctx.createRadialGradient(x, y, 0, x, y, externo);
  if (recolhe) {
    grd.addColorStop(0, `rgba(254,202,202,${0.2 + 0.28 * t})`);
    grd.addColorStop(1, "rgba(239,68,68,0)");
  } else {
    grd.addColorStop(0, `rgba(255,255,255,${0.28 + 0.35 * t})`);
    grd.addColorStop(0.55, `rgba(254,243,199,${0.12 * t})`);
    grd.addColorStop(1, "rgba(255,255,255,0)");
  }
  ctx.beginPath();
  ctx.arc(x, y, externo, 0, Math.PI * 2);
  ctx.fillStyle = grd;
  ctx.fill();
  ctx.restore();
}

function fnDe(lista, i, pintar) {
  let fn = lista[i];
  if (!fn) {
    fn = (ctx) => pintar(ctx, i);
    lista[i] = fn;
  }
  return fn;
}

function empilharVivos(lista, itens, desenhos, pintar, ordem) {
  for (let i = 0; i < itens.length; i++) {
    const p = itens[i];
    if (!p.viva) continue;
    empilhar(lista, chaveEntidade(p.y, p.z), 0, fnDe(desenhos, i, pintar), ordem, p.z);
  }
}

export function empilharFxBola(lista) {
  empilharVivos(lista, aneisBola(), desenhoAnel, pintarAnel, 6);
  empilharVivos(lista, faiscasBola(), desenhoFaisca, pintarFaisca, 8);
  empilharVivos(lista, flashesBola(), desenhoFlash, pintarFlash, 9);
}
