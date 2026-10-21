/**
 * Faixa de previsão (7 slots) — ícones SVG do Pokémon AI + skin Sheikah.
 */
import {
  iconeClimaDisplay,
  obterClimaJogo,
  obterForecastScroll,
} from "../clima/amostra.js";
import { INTENSIDADE, nomeClimaDisplay } from "../clima/kinds.js";

const SLOTS = 7;
const SLOT_STEP = 28; /* 20px + 8px gap */
const SVG = "http://www.w3.org/2000/svg";

/** Markup interno por kind (paths do AI). */
const ICONES = Object.freeze({
  limpo: `<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.2M12 19v2.2M2.8 12h2.2M19 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"/>`,
  nublado: `<path d="M7.8 17.5h9.2a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.6 1.4A3.2 3.2 0 0 0 7.8 17.5z"/>`,
  chuva: `<path d="M7.8 14.2h9.2a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.6 1.4A3.2 3.2 0 0 0 7.8 14.2z"/><path d="M9 16.2l-1.2 3.2M12.2 16.6l-1.2 3.2M15.4 16.2l-1.2 3.2"/>`,
  nevasca: `<path d="M7.8 14.2h9.2a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.6 1.4A3.2 3.2 0 0 0 7.8 14.2z"/><circle cx="9.2" cy="17.6" r="1.05"/><circle cx="12.2" cy="19" r="1.05"/><circle cx="15.4" cy="17.4" r="1.05"/><path d="M9.2 16.2v2.8M12.2 17.5v2.8M15.4 16v2.8"/>`,
  areia: `<path d="M7.8 13.6h9.2a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.6 1.4A3.2 3.2 0 0 0 7.8 13.6z"/><path d="M7.6 16.2c1.4.7 2.8.7 4.2 0s2.8-.7 4.2 0M7.6 18.4c1.4.7 2.8.7 4.2 0s2.8-.7 4.2 0M7.6 20.5c1.4.7 2.8.7 4.2 0s2.8-.7 4.2 0"/>`,
  nevoa: `<path d="M7.8 12.2h9.2a3.6 3.6 0 0 0 .4-7.2 5 5 0 0 0-9.6 1.4A3.2 3.2 0 0 0 7.8 12.2z"/><path d="M6 16.2h12M7.5 18.8h9"/>`,
  vendaval: `<path d="M4 8.5h11.5c2 0 3.2-1.6 3.2-3s-1-2.6-2.4-2.6"/><path d="M4 12.5h14.2c1.8 0 3 1.3 3 2.7s-1.2 2.6-2.8 2.6"/><path d="M4 16.8h8.5"/>`,
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
  svg.innerHTML = ICONES[kind] || ICONES.limpo;
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
    btn.dataset.kind = "limpo";
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
    slot.dataset.role =
      entry.role || (i < past ? "past" : i === past ? "now" : "future");
    slot.dataset.force =
      entry.intensity === INTENSIDADE.FORTE ? "forte" : "fraco";
    slot.title = `${nomeClimaDisplay(display)}${
      entry.intensity === INTENSIDADE.FORTE ? " (forte)" : ""
    }`;
  }
  const offset = -(scroll.progress || 0) * SLOT_STEP * 0.35;
  track.style.transform = `translateX(${offset.toFixed(2)}px)`;
}
