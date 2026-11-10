/**
 * HUD Chrono no overworld — paper candy (golpes + alvo + fuga). Sem canvas de arena.
 */
import {
  atualizarBarrasHp,
  pintarPainelTurno,
} from "../hud/turnoUi.js";
import { escolherGolpeTurno, escolherAlvoTurno } from "../turnos.js";

let raiz = null;
/** @type {{ versaoMenu: number, versaoAlvo: number|string }} */
const estadoUi = { versaoMenu: -1, versaoAlvo: -1 };
/** @type {{ atual: string }} */
const vidasSig = { atual: "" };
/** @type {null|(() => void)} */
let aoFugir = null;

const SELS = Object.freeze({
  turno: "[data-ch-turno]",
  titulo: "[data-ch-turno-titulo]",
  golpes: "[data-ch-golpes]",
  alvos: "[data-ch-alvos]",
});

function garantirDom() {
  if (raiz) return raiz;
  raiz = document.createElement("div");
  raiz.id = "batalha-chrono";
  raiz.className = "batalha-chrono";
  raiz.hidden = true;
  raiz.innerHTML = `
    <div class="batalha-chrono__panel hud-panel">
      <header class="batalha-chrono__cabeca hud-head">
        <p class="batalha-chrono__status" data-ch-status></p>
        <button type="button" class="batalha-chrono__fuga hud-btn red small" data-ch-fuga>Fugir</button>
      </header>
      <div class="batalha-turno__vidas" data-ch-vidas></div>
      <div class="batalha-chrono__turno" data-ch-turno hidden>
        <p class="batalha-turno__titulo" data-ch-turno-titulo></p>
        <div class="batalha-turno__alvos" data-ch-alvos hidden></div>
        <div class="batalha-turno__golpes" data-ch-golpes></div>
      </div>
    </div>
  `;
  document.body.appendChild(raiz);

  raiz.querySelector("[data-ch-fuga]").addEventListener("click", () => {
    if (aoFugir) aoFugir();
  });
  raiz.querySelector("[data-ch-golpes]").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-golpe]");
    if (!btn) return;
    escolherGolpeTurno(btn.dataset.golpe);
  });
  raiz.querySelector("[data-ch-alvos]").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-alvo]");
    if (!btn) return;
    escolherAlvoTurno(btn.dataset.alvo);
    estadoUi.versaoAlvo = -1;
  });
  return raiz;
}

export function abrirHudChrono({ nomeParty, nomeFoe, onFuga } = {}) {
  const host = garantirDom();
  host.hidden = false;
  host.classList.remove("is-open");
  document.body.classList.add("is-chrono");
  aoFugir = typeof onFuga === "function" ? onFuga : null;
  host.querySelector("[data-ch-status]").textContent =
    `${nomeParty || "Pokémon"} vs ${nomeFoe || "Selvagem"}`;
  estadoUi.versaoMenu = -1;
  estadoUi.versaoAlvo = -1;
  vidasSig.atual = "";
  requestAnimationFrame(() => {
    if (!raiz || raiz.hidden) return;
    raiz.classList.add("is-open");
  });
}

export function fecharHudChrono() {
  document.body.classList.remove("is-chrono");
  if (!raiz) return;
  raiz.classList.remove("is-open");
  raiz.hidden = true;
  aoFugir = null;
  estadoUi.versaoMenu = -1;
  estadoUi.versaoAlvo = -1;
  vidasSig.atual = "";
  const vidas = raiz.querySelector("[data-ch-vidas]");
  if (vidas) vidas.replaceChildren();
}

export function tickHudChrono(pedido, aviso, sessao) {
  if (!raiz || raiz.hidden) return;
  atualizarBarrasHp(raiz.querySelector("[data-ch-vidas]"), sessao, {
    soPrimeiroAliado: true,
    assinatura: vidasSig,
  });
  pintarPainelTurno(raiz, estadoUi, pedido, aviso, SELS);
}
