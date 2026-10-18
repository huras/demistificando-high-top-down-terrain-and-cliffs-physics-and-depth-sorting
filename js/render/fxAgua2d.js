import { ESCALA, TILE } from "../config.js";
import {
  amostraGota,
  amostraOnda,
  amostraPegada,
  gotasAgua,
  ondasAgua,
  pegadasAgua,
} from "../fx/fxAgua.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import { chaveEntidade, chaveProfundidade, empilhar } from "./ordenacaoProfundidade.js";

const PX = TILE * ESCALA;
const LINHA = Math.max(1, PX * 0.04);

const desOnda = new Array(96);
const desPegada = new Array(80);
const desGota = new Array(64);

function chaveLamina(y, z) {
  return chaveProfundidade(Math.floor(y) + 0.97055, z);
}

function chaveChao(y, z) {
  return chaveProfundidade(Math.floor(y) + 0.969, z);
}

function desenharOnda(ctx, i) {
  const o = ondasAgua()[i];
  if (!o?.viva) return;
  const a = amostraOnda(o);
  if (a.alfa < 0.02) return;
  const sx = mundoParaTelaX(o.x);
  const sy = mundoParaTelaY(o.y, o.z, 0);
  ctx.beginPath();
  ctx.ellipse(sx, sy, a.rx * PX, a.ry * PX, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(240, 250, 255, ${a.alfa * 0.22})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(240, 250, 255, ${a.alfa})`;
  ctx.lineWidth = LINHA;
  ctx.stroke();
}

function desenharPegada(ctx, i) {
  const p = pegadasAgua()[i];
  if (!p?.viva) return;
  const alfa = amostraPegada(p);
  if (alfa < 0.02) return;
  const sx = mundoParaTelaX(p.x);
  const sy = mundoParaTelaY(p.y, p.z, 0);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(p.ang);
  ctx.beginPath();
  ctx.ellipse(0, 0, p.sx * PX, p.sy * PX, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(64, 145, 210, ${alfa})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(36, 88, 140, ${alfa * 0.4})`;
  ctx.lineWidth = LINHA;
  ctx.stroke();
  ctx.restore();
}

function desenharGota(ctx, i) {
  const g = gotasAgua()[i];
  if (!g?.viva) return;
  const a = amostraGota(g);
  if (a.alfa < 0.02) return;
  const sx = mundoParaTelaX(g.x);
  const sy = mundoParaTelaY(g.y, g.z, 0);
  ctx.beginPath();
  ctx.arc(sx, sy, a.tam * PX, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(220, 244, 255, ${a.alfa})`;
  ctx.fill();
}

function fnDe(cache, i, desenhar) {
  let fn = cache[i];
  if (!fn) {
    fn = (ctx) => desenhar(ctx, i);
    cache[i] = fn;
  }
  return fn;
}

/** Elipse e pegada, atrás do corpo. */
export function empilharFxAguaChao(lista) {
  const ondas = ondasAgua();
  for (let i = 0; i < ondas.length; i++) {
    const o = ondas[i];
    if (!o.viva) continue;
    empilhar(lista, chaveLamina(o.y, o.z), 0, fnDe(desOnda, i, desenharOnda), 2, o.z);
  }
  const pes = pegadasAgua();
  for (let i = 0; i < pes.length; i++) {
    const p = pes[i];
    if (!p.viva) continue;
    empilhar(lista, chaveChao(p.y, p.z), 0, fnDe(desPegada, i, desenharPegada), 1, p.z);
  }
}

/** Gota por cima de quem acabou de sair. */
export function empilharFxAguaGotas(lista) {
  const gotas = gotasAgua();
  for (let i = 0; i < gotas.length; i++) {
    const g = gotas[i];
    if (!g.viva) continue;
    empilhar(lista, chaveEntidade(g.y, g.z), 0, fnDe(desGota, i, desenharGota), 12, g.z);
  }
}
