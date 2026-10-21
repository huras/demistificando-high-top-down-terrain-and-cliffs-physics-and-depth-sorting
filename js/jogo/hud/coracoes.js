/** Corações do jogador estilo Zelda (sob a hotbar). */

import { obterTreinador } from "../../pokemon/sistema.js";

const HEART_SVG = `
<svg class="heart__svg" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
  <path class="heart__outline" d="M8 14.2 2.6 9.1C1.2 7.8 1.1 5.5 2.6 4.1c1.4-1.3 3.6-1.2 4.9.2L8 5l.5-.7c1.3-1.4 3.5-1.5 4.9-.2 1.5 1.4 1.4 3.7 0 5.1L8 14.2z"/>
  <path class="heart__fill" d="M8 13.1 3.3 8.7c-1-1-1.1-2.6 0-3.6.9-.9 2.4-.8 3.3.2L8 6.6l1.4-1.3c.9-1 2.4-1.1 3.3-.2 1.1 1 1 2.6 0 3.6L8 13.1z"/>
</svg>`;

const HP_POR_CORACAO = 20;

let root = null;
let cachedN = -1;

function numCoracoes(maxHp) {
  const m = Math.max(1, maxHp | 0);
  return Math.max(1, Math.min(10, Math.ceil(m / HP_POR_CORACAO)));
}

function quartos(hp, maxHp, n) {
  const fills = [];
  const porCoracao = Math.max(1, maxHp / n);
  for (let i = 0; i < n; i++) {
    const local = hp - i * porCoracao;
    if (local <= 0) fills.push(0);
    else if (local >= porCoracao) fills.push(4);
    else fills.push(Math.max(1, Math.min(4, Math.ceil((local / porCoracao) * 4))));
  }
  return fills;
}

function classeQuarto(q) {
  if (q >= 4) return "heart heart--full";
  if (q === 3) return "heart heart--3q";
  if (q === 2) return "heart heart--half";
  if (q === 1) return "heart heart--1q";
  return "heart heart--empty";
}

export function montarCoracoes(host) {
  root = host;
  if (!root) return { sync() {}, setMenuHidden() {} };
  root.classList.add("player-hearts-hud");
  if (!root.querySelector(".heart-meter__row")) {
    root.innerHTML = `<div class="heart-meter player-hearts-hud__meter">
      <div class="heart-meter__row" data-hearts-row role="img" aria-label="Vida"></div>
    </div>`;
  }
  return {
    sync: pintarCoracoes,
    setMenuHidden(hidden) {
      if (root) root.classList.toggle("is-menu-hidden", !!hidden);
    },
  };
}

export function pintarCoracoes() {
  if (!root) return;
  const row = root.querySelector("[data-hearts-row]");
  if (!row) return;
  const tre = obterTreinador();
  const max = Math.max(1, tre?.hpMax || tre?.maxHp || 120);
  const hp = Math.max(0, Math.min(max, tre?.hp ?? max));
  const n = numCoracoes(max);

  if (n !== cachedN) {
    cachedN = n;
    const partes = [];
    for (let i = 0; i < n; i++) {
      partes.push(`<span class="heart heart--empty">${HEART_SVG}</span>`);
    }
    row.innerHTML = partes.join("");
  }

  const fills = quartos(hp, max, n);
  const slots = row.children;
  for (let i = 0; i < slots.length; i++) {
    slots[i].className = classeQuarto(fills[i] ?? 0);
  }
  row.setAttribute("aria-label", `Vida ${Math.round(hp)} de ${Math.round(max)}`);
  root.classList.toggle("is-low", hp > 0 && hp / max <= 0.3);
  root.classList.toggle("is-down", !(hp > 0));
}
