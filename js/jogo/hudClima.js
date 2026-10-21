/**
 * Faixa de previsão (7 slots) — estilo Sheikah / Pokémon AI.
 */
import {
  iconeClimaDisplay,
  obterClimaJogo,
  obterForecastScroll,
} from "../clima/amostra.js";
import { INTENSIDADE, nomeClimaDisplay } from "../clima/kinds.js";

const SLOTS = 7;
const SVG = "http://www.w3.org/2000/svg";

const PATHS = Object.freeze({
  limpo: "M12 4l1.2 3.2L16.5 8l-2.6 2.1.9 3.4L12 11.5 9.2 13.5l.9-3.4L7.5 8l3.3-.8L12 4z",
  nublado: "M7 14a4 4 0 118-1.2A3.5 3.5 0 1116 16H7.5A3.5 3.5 0 017 14z",
  chuva: "M8 4h8v2H8zm1 4h2v8H9zm4 0h2v8h-2zM8 14h8v2H8z",
  nevasca: "M12 3v18M5 7l14 10M19 7L5 17M4 12h16",
  areia: "M4 16c2-3 4-3 6 0s4 3 6 0 4-3 6 0M4 10c2-3 4-3 6 0s4 3 6 0 4-3 6 0",
  nevoa: "M5 8h14M4 12h16M6 16h12",
  vendaval: "M4 8c4 0 4-3 8-3s4 3 8 3M4 12c4 0 4-3 8-3s4 3 8 3M4 16c4 0 4-3 8-3s4 3 8 3",
});

let montado = false;
let track = null;
/** @type {HTMLElement[]} */
let slots = [];

function svgIcone(kind) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("hud-wx__icon");
  const path = document.createElementNS(SVG, "path");
  path.setAttribute("d", PATHS[kind] || PATHS.limpo);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.8");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  return svg;
}

export function ligarHudClima(host) {
  const root = host || document.getElementById("jogo-clima-previsao");
  if (!root || montado) return;
  track = root.querySelector("[data-wx-track]");
  if (!track) return;
  track.innerHTML = "";
  slots = [];
  for (let i = 0; i < SLOTS; i++) {
    const btn = document.createElement("span");
    btn.className = "hud-wx__slot";
    btn.dataset.i = String(i);
    btn.appendChild(svgIcone("limpo"));
    track.appendChild(btn);
    slots.push(btn);
  }
  montado = true;
}

/**
 * @param {HTMLElement} [host]
 */
export function tickHudPrevisao(host) {
  if (!montado) ligarHudClima(host);
  if (!track || !slots.length) return;
  const clima = obterClimaJogo();
  const scroll = obterForecastScroll(SLOTS);
  const icons = scroll.icons || [];
  const past = scroll.past | 0;
  for (let i = 0; i < slots.length; i++) {
    const entry = icons[i] || { kind: "limpo", intensity: INTENSIDADE.FRACO };
    const display = iconeClimaDisplay(entry.kind, clima.familia);
    const slot = slots[i];
    if (slot.dataset.kind !== display) {
      slot.dataset.kind = display;
      slot.replaceChildren(svgIcone(display));
    }
    slot.dataset.role = entry.role || (i < past ? "past" : i === past ? "now" : "future");
    slot.dataset.force = entry.intensity === INTENSIDADE.FORTE ? "forte" : "fraco";
    slot.title = `${nomeClimaDisplay(display)}${entry.intensity === INTENSIDADE.FORTE ? " (forte)" : ""}`;
  }
  const slotW = 28;
  const offset = -(scroll.progress || 0) * slotW * 0.35;
  track.style.transform = `translateX(${offset.toFixed(2)}px)`;
}
