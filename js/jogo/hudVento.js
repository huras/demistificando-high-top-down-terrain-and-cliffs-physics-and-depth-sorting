/**
 * Chip de vento (km/h) — fluxo de setas estilo Pokémon AI (JS, não CSS).
 */
import { CLIMA_CFG } from "../clima/config.js";
import { obterVentoMundo } from "../clima/amostra.js";
import { ventoHud01, ventoHudKmh } from "../clima/vento.js";
import { estado } from "./estado.js";

const SVG = "http://www.w3.org/2000/svg";
const DARTS = 3;
const ARROW_PADRAO = 18;
const COMPRIMENTO_VB = 15.3;
const VB = 24;
const HZ_MIN = 0.26;
const HZ_MAX = 1.95;
const DT_MAX = 0.05;
const TX = "translate(-50%,-50%) translate3d(";
const TX_END = "px,0,0)";

let root = null;
let rotor = null;
let label = null;
/** @type {SVGElement[]} */
let darts = [];
/** @type {SVGElement[]} */
let echoes = [];
/** @type {number[]} */
let xs = [];
let pronto = false;
let fase = 0;
let lastKmh = -1;
let lastAng = -999;
let stride = ARROW_PADRAO;
let path = ARROW_PADRAO * DARTS;

function criarDardo(echo) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("hud-vento__dart");
  if (echo) svg.classList.add("hud-vento__dart--echo");
  const g = document.createElementNS(SVG, "g");
  g.setAttribute("transform", "translate(12 12)");
  const shaft = document.createElementNS(SVG, "path");
  shaft.setAttribute("d", "M-12.3 0 L3 0");
  const head = document.createElementNS(SVG, "path");
  head.setAttribute("d", "M-3 -4.4 L3 0 L-3 4.4");
  g.append(shaft, head);
  svg.appendChild(g);
  return svg;
}

function lerPx(el, prop, fallback) {
  const n = parseFloat(getComputedStyle(el).getPropertyValue(prop));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function escreverX(el, i, x) {
  const q = Math.round(x * 10) / 10;
  if (xs[i] === q) return;
  xs[i] = q;
  el.style.transform = TX + q + TX_END;
}

function medirTrilho() {
  if (!root) return;
  const arrow = lerPx(root, "--hud-wind-arrow", ARROW_PADRAO);
  const len = arrow * (COMPRIMENTO_VB / VB);
  const gap = Math.max(5, arrow * 0.34);
  stride = len + gap;
  path = stride * DARTS;
}

function pintarFluxo() {
  const p = path;
  const n = DARTS;
  const inv = 1 / n;
  for (let i = 0; i < n; i++) {
    let u = fase + i * inv;
    u -= Math.floor(u);
    const x = (u - 0.5) * p;
    escreverX(darts[i], i, x);
    const echo = x > 0 ? x - p : x + p;
    escreverX(echoes[i], i + n, echo);
    if (echoes[i].style.visibility === "hidden") {
      echoes[i].style.visibility = "";
    }
  }
}

export function ligarHudVento(host) {
  root = host || document.getElementById("jogo-vento");
  if (!root || pronto) return;
  rotor = root.querySelector("[data-vento-rotor]");
  label = root.querySelector("[data-vento-kmh]");
  if (!rotor) return;
  root.hidden = false;
  darts = [];
  echoes = [];
  xs = new Array(DARTS * 2).fill(NaN);
  const frag = document.createDocumentFragment();
  for (let i = 0; i < DARTS; i++) {
    darts[i] = criarDardo(false);
    echoes[i] = criarDardo(true);
    frag.append(darts[i], echoes[i]);
  }
  rotor.replaceChildren(frag);
  medirTrilho();
  pronto = true;
}

/**
 * @param {number} dt
 * @param {HTMLElement} [host]
 */
export function tickHudVento(dt, host) {
  if (!pronto) ligarHudVento(host);
  if (!root || !rotor) return;
  if (estado.interior) {
    root.hidden = true;
    return;
  }
  root.hidden = false;

  const vento = obterVentoMundo();
  const fill = ventoHud01(vento, CLIMA_CFG);
  const kmh = Math.round(ventoHudKmh(vento, CLIMA_CFG));
  const ang = ((vento.angulo || 0) * 180) / Math.PI;

  if (Math.abs(ang - lastAng) > 0.25) {
    lastAng = ang;
    medirTrilho();
    rotor.style.transform = `rotate(${ang.toFixed(1)}deg)`;
  }

  const hz = HZ_MIN + Math.min(1.15, fill) * ((HZ_MAX - HZ_MIN) / 1.15);
  fase += Math.min(DT_MAX, Math.max(0, dt || 0.016)) * hz;
  fase -= Math.floor(fase);
  pintarFluxo();

  root.dataset.force = fill > 0.72 ? "forte" : fill > 0.38 ? "medio" : "calmo";
  root.style.opacity = String(0.52 + Math.min(1, fill) * 0.48);
  if (label && kmh !== lastKmh) {
    lastKmh = kmh;
    label.textContent = `${kmh} km/h`;
  }
}
