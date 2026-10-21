/**
 * Chip de vento (km/h) — só com asa-delta na bolsa.
 */
import { CLIMA_CFG } from "../clima/config.js";
import { obterVentoMundo } from "../clima/amostra.js";
import { ventoHud01, ventoHudKmh } from "../clima/vento.js";
import { temChave } from "./estado.js";

const SVG = "http://www.w3.org/2000/svg";
const DARTS = 3;

let root = null;
let rotor = null;
let label = null;
let pronto = false;
let fase = 0;
let lastKmh = -1;
let lastAng = -999;

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
  shaft.setAttribute("fill", "none");
  shaft.setAttribute("stroke", "currentColor");
  shaft.setAttribute("stroke-width", "1.6");
  const head = document.createElementNS(SVG, "path");
  head.setAttribute("d", "M-3 -4.4 L3 0 L-3 4.4");
  head.setAttribute("fill", "none");
  head.setAttribute("stroke", "currentColor");
  head.setAttribute("stroke-width", "1.6");
  head.setAttribute("stroke-linejoin", "round");
  g.append(shaft, head);
  svg.appendChild(g);
  return svg;
}

export function ligarHudVento(host) {
  root = host || document.getElementById("jogo-vento");
  if (!root || pronto) return;
  rotor = root.querySelector("[data-vento-rotor]");
  label = root.querySelector("[data-vento-kmh]");
  if (!rotor) return;
  rotor.innerHTML = "";
  for (let i = 0; i < DARTS; i++) {
    const d = criarDardo(false);
    d.style.setProperty("--i", String(i));
    rotor.appendChild(d);
  }
  for (let i = 0; i < DARTS; i++) {
    const d = criarDardo(true);
    d.style.setProperty("--i", String(i));
    rotor.appendChild(d);
  }
  pronto = true;
}

/**
 * @param {number} dt
 * @param {HTMLElement} [host]
 */
export function tickHudVento(dt, host) {
  if (!pronto) ligarHudVento(host);
  if (!root) return;
  const ativo = temChave("asaDelta");
  root.hidden = !ativo;
  if (!ativo) return;

  const vento = obterVentoMundo();
  const fill = ventoHud01(vento, CLIMA_CFG);
  const kmh = Math.round(ventoHudKmh(vento, CLIMA_CFG));
  const ang = ((vento.angulo || 0) * 180) / Math.PI;
  const hz = 0.26 + fill * 1.7;
  fase = (fase + Math.min(0.05, dt || 0.016) * hz) % 1;

  if (rotor && Math.abs(ang - lastAng) > 0.4) {
    lastAng = ang;
    rotor.style.transform = `rotate(${ang.toFixed(1)}deg)`;
  }
  root.dataset.force = fill > 0.72 ? "forte" : fill > 0.38 ? "medio" : "calmo";
  root.style.setProperty("--vento-fase", fase.toFixed(3));
  root.style.opacity = String(0.45 + fill * 0.55);
  if (label && kmh !== lastKmh) {
    lastKmh = kmh;
    label.textContent = `${kmh} km/h`;
  }
}
