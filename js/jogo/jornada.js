/**
 * Jornada do jogador: trilha, mortes e teleportes (estilo BOTW).
 * Sem persistência em save nesta entrega.
 */

import { dentroDoMundo } from "../mundo/bounds.js";

const DIST_PONTO = 2.2;
/** Salto maior que isso = teleporte/bolso; quebra a linha em vez de ligar. */
const DIST_GAP = 48;
const ANG_MIN = 0.22;
const MAX_PONTOS_SEG = 400;
const MAX_SEGMENTOS = 48;
const MAX_MORTES = 64;
const MAX_TELEPORTES = 64;

/** @type {{ pontos: {x:number,y:number}[] }[]} */
const segmentos = [];
/** @type {{x:number,y:number,z:number,t:number}[]} */
const mortes = [];
/** @type {{de:{x:number,y:number},para:{x:number,y:number},t:number}[]} */
const teleportes = [];

let segAtual = null;
let ultimoX = NaN;
let ultimoY = NaN;
let penultX = NaN;
let penultY = NaN;
let tJogo = 0;
let pausado = false;

function novoSegmento() {
  if (segAtual && segAtual.pontos.length < 2) {
    // Descarta segmento vazio/inútil.
    const idx = segmentos.indexOf(segAtual);
    if (idx >= 0) segmentos.splice(idx, 1);
  }
  segAtual = { pontos: [] };
  segmentos.push(segAtual);
  while (segmentos.length > MAX_SEGMENTOS) segmentos.shift();
  ultimoX = NaN;
  ultimoY = NaN;
  penultX = NaN;
  penultY = NaN;
}

function anguloVirada(ax, ay, bx, by, cx, cy) {
  const ux = bx - ax;
  const uy = by - ay;
  const vx = cx - bx;
  const vy = cy - by;
  const ul = Math.hypot(ux, uy) || 1;
  const vl = Math.hypot(vx, vy) || 1;
  const dot = (ux / ul) * (vx / vl) + (uy / ul) * (vy / vl);
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

function empurrarPonto(x, y) {
  if (!segAtual) novoSegmento();
  const pts = segAtual.pontos;
  if (pts.length >= MAX_PONTOS_SEG) {
    pts.splice(0, pts.length - MAX_PONTOS_SEG + 1);
  }
  pts.push({ x, y });
  penultX = ultimoX;
  penultY = ultimoY;
  ultimoX = x;
  ultimoY = y;
}

/** Amostra a trilha; chama gap em teleporte/respawn. */
export function tickJornada(x, y, dt) {
  tJogo += Math.max(0, dt || 0);
  if (pausado || !Number.isFinite(x) || !Number.isFinite(y)) return;
  // Salas/santuário vivem no bolso (~100000); não entram na trilha do mapa.
  if (!dentroDoMundo(x, y)) {
    gapJornada();
    return;
  }
  if (!segAtual) {
    novoSegmento();
    empurrarPonto(x, y);
    return;
  }
  if (!Number.isFinite(ultimoX)) {
    empurrarPonto(x, y);
    return;
  }
  const dist = Math.hypot(x - ultimoX, y - ultimoY);
  if (dist < DIST_PONTO) return;
  // Warp sem gapJornada (porta, debug, hitch): não desenha linha reta pelo oceano.
  if (dist >= DIST_GAP) {
    gapJornada();
    novoSegmento();
    empurrarPonto(x, y);
    return;
  }
  if (
    Number.isFinite(penultX) &&
    dist < DIST_PONTO * 2.2 &&
    anguloVirada(penultX, penultY, ultimoX, ultimoY, x, y) < ANG_MIN
  ) {
    // Estica o último ponto em vez de criar outro (compactação).
    const pts = segAtual.pontos;
    pts[pts.length - 1].x = x;
    pts[pts.length - 1].y = y;
    ultimoX = x;
    ultimoY = y;
    return;
  }
  empurrarPonto(x, y);
}

/** Quebra a linha (teleporte / respawn). */
export function gapJornada() {
  if (segAtual && segAtual.pontos.length > 0) {
    segAtual = null;
    ultimoX = NaN;
    ultimoY = NaN;
    penultX = NaN;
    penultY = NaN;
  }
}

export function registrarMorte(x, y, z = 0) {
  mortes.push({ x, y, z, t: tJogo });
  while (mortes.length > MAX_MORTES) mortes.shift();
  gapJornada();
}

export function registrarTeleporte(deX, deY, paraX, paraY) {
  teleportes.push({
    de: { x: deX, y: deY },
    para: { x: paraX, y: paraY },
    t: tJogo,
  });
  while (teleportes.length > MAX_TELEPORTES) teleportes.shift();
  gapJornada();
}

/** Pausa amostragem durante a animação de teleporte. */
export function pausarJornada(ativo) {
  pausado = !!ativo;
}

export function obterJornada() {
  return { segmentos, mortes, teleportes };
}
