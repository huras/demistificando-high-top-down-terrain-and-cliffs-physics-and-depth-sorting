/** Estado do céu que existe antes da cena 3D (o painel mexe aqui). */

import {
  INCLINACAO_SOL_MAX,
  INCLINACAO_SOL_MIN,
  INCLINACAO_SOL_PADRAO,
  ROTACAO_SOL_MAX,
  ROTACAO_SOL_MIN,
  ROTACAO_SOL_PADRAO,
} from "./parametros.js";

export {
  INCLINACAO_SOL_MAX,
  INCLINACAO_SOL_MIN,
  INCLINACAO_SOL_PADRAO,
  ROTACAO_SOL_MAX,
  ROTACAO_SOL_MIN,
  ROTACAO_SOL_PADRAO,
};

export const CLIMAS = ["limpo", "chuva", "areia", "nevasca", "vendaval"];

const NOMES = {
  limpo: "Limpo",
  chuva: "Chuva",
  areia: "Tempestade de areia",
  nevasca: "Nevasca",
  vendaval: "Vendaval",
};

let hora = 9.35;
let ciclo = true;
let clima = "limpo";
let inclinacaoSol = INCLINACAO_SOL_PADRAO;
let rotacaoSol = ROTACAO_SOL_PADRAO;

function enrolar(h) {
  let x = h % 24;
  if (x < 0) x += 24;
  return x;
}

function limitar(n, min, max, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, x));
}

export function obterHora() {
  return hora;
}

export function definirHora(h) {
  hora = enrolar(Number(h) || 0);
  return hora;
}

export function avancarHora(delta) {
  return definirHora(hora + delta);
}

export function cicloLigado() {
  return ciclo;
}

export function definirCiclo(ligado) {
  ciclo = !!ligado;
  return ciclo;
}

export function obterClima() {
  return clima;
}

export function definirClima(id) {
  if (NOMES[id]) clima = id;
  return clima;
}

export function alternarClima() {
  const i = CLIMAS.indexOf(clima);
  clima = CLIMAS[(i + 1) % CLIMAS.length];
  return clima;
}

export function nomeClima(id = clima) {
  return NOMES[id] || id;
}

export function nomeFase(h = hora) {
  if (h >= 5 && h < 8) return "Amanhecer";
  if (h >= 8 && h < 15.5) return "Dia";
  if (h >= 15.5 && h < 18.2) return "Tarde";
  if (h >= 18.2 && h < 20.5) return "Anoitecer";
  return "Noite";
}

export function textoHora(h = hora) {
  const horas = Math.floor(h);
  const minutos = Math.floor((h - horas) * 60);
  const hh = String(horas).padStart(2, "0");
  const mm = String(minutos).padStart(2, "0");
  return `${hh}:${mm} · ${nomeFase(h)}`;
}

export function definirInclinacaoSol(graus) {
  inclinacaoSol = limitar(graus, INCLINACAO_SOL_MIN, INCLINACAO_SOL_MAX, INCLINACAO_SOL_PADRAO);
  return inclinacaoSol;
}

export function definirRotacaoSol(graus) {
  rotacaoSol = limitar(graus, ROTACAO_SOL_MIN, ROTACAO_SOL_MAX, ROTACAO_SOL_PADRAO);
  return rotacaoSol;
}

export function obterControleCeu() {
  return { hora, ciclo, clima, inclinacao: inclinacaoSol, rotacao: rotacaoSol };
}

/** Avança o relógio se o ciclo automático estiver ligado. */
export function avancarCiclo(dt, duracaoDia) {
  if (ciclo && dt > 0) hora = enrolar(hora + (dt * 24) / duracaoDia);
  return hora;
}
