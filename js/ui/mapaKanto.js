/**
 * Mapa da grade 32×32. A pintura nasce uma vez;
 * o ponto do jogador só muda quando ele troca de área.
 */
import { CIDADES_KANTO } from "../mundo/regiao/kantoCidades.js";
import { LADO_KANTO, zonaEm } from "../mundo/regiao/grafoKanto.js";
import { relevoEm, RELEVO_FUNDO, RELEVO_MONTANHA, RELEVO_RASO } from "../mundo/regiao/kantoRelevo.js";
import { ROTAS_KANTO } from "../mundo/regiao/kantoRotas.js";

const PX = 4;
const LADO_TELA = LADO_KANTO * PX;

let tela = null;
let nomeEl = null;
let base = null;
let axJogador = -1;
let ayJogador = -1;
let dentroDaCasa = false;

function corRelevo(tipo) {
  if (tipo === RELEVO_FUNDO) return "#143e66";
  if (tipo === RELEVO_RASO) return "#2f7ea8";
  if (tipo === RELEVO_MONTANHA) return "#7a736c";
  return "#5c9a45";
}

function segmento(ctx, ax0, ay0, ax1, ay1) {
  let x = ax0;
  let y = ay0;
  const passoX = Math.sign(ax1 - ax0);
  const passoY = Math.sign(ay1 - ay0);
  ctx.beginPath();
  ctx.moveTo((x + 0.5) * PX, (y + 0.5) * PX);
  while (x !== ax1) {
    x += passoX;
    ctx.lineTo((x + 0.5) * PX, (y + 0.5) * PX);
  }
  while (y !== ay1) {
    y += passoY;
    ctx.lineTo((x + 0.5) * PX, (y + 0.5) * PX);
  }
  ctx.stroke();
}

function pintarBase(ctx) {
  for (let ay = 0; ay < LADO_KANTO; ay++) {
    for (let ax = 0; ax < LADO_KANTO; ax++) {
      ctx.fillStyle = corRelevo(relevoEm(ax, ay));
      ctx.fillRect(ax * PX, ay * PX, PX, PX);
    }
  }
  ctx.strokeStyle = "#c4a06a";
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (let i = 0; i < ROTAS_KANTO.length; i++) {
    const path = ROTAS_KANTO[i].path;
    for (let p = 1; p < path.length; p++) {
      segmento(ctx, path[p - 1][0], path[p - 1][1], path[p][0], path[p][1]);
    }
  }
  ctx.fillStyle = "#f3e2b0";
  for (let i = 0; i < CIDADES_KANTO.length; i++) {
    const cidade = CIDADES_KANTO[i];
    ctx.fillRect(cidade.ax * PX, cidade.ay * PX, PX, PX);
  }
}

export function ligarMapaKanto() {
  tela = document.getElementById("mapa-kanto-tela");
  nomeEl = document.getElementById("mapa-kanto-nome");
  if (!tela) return;
  tela.width = LADO_TELA;
  tela.height = LADO_TELA;
  const ctx = tela.getContext("2d");
  pintarBase(ctx);
  base = ctx.getImageData(0, 0, LADO_TELA, LADO_TELA);
  axJogador = -1;
  ayJogador = -1;
}

export function atualizarMapaKanto(x, y) {
  if (!tela || !base) return;
  const fora = x < 0 || y < 0 || x >= LADO_KANTO * 128 || y >= LADO_KANTO * 128;
  if (fora) {
    dentroDaCasa = true;
    if (nomeEl) nomeEl.textContent = "Casa";
    return;
  }
  if (dentroDaCasa) {
    dentroDaCasa = false;
    axJogador = -1;
  }
  const ax = Math.max(0, Math.min(LADO_KANTO - 1, (x / 128) | 0));
  const ay = Math.max(0, Math.min(LADO_KANTO - 1, (y / 128) | 0));
  if (ax === axJogador && ay === ayJogador) return;
  axJogador = ax;
  ayJogador = ay;
  const ctx = tela.getContext("2d");
  ctx.putImageData(base, 0, 0);
  ctx.fillStyle = "#fffef8";
  ctx.fillRect(ax * PX + 1, ay * PX + 1, 2, 2);
  if (nomeEl) nomeEl.textContent = zonaEm(ax, ay)?.nome || "Kanto";
}
