/**
 * HUD de comando do BattleStage (golpes, alvos, HP, fuga).
 */
import {
  atualizarBarrasHp,
  pintarPainelTurno,
} from "../hud/turnoUi.js";
import { escolherAlvoTurno, escolherGolpeTurno } from "../turnos.js";

const SELS = Object.freeze({
  turno: "[data-bs-turno]",
  titulo: "[data-bs-turno-titulo]",
  golpes: "[data-bs-golpes]",
  alvos: "[data-bs-alvos]",
});

/** @type {{ atual: string }} */
const vidasSig = { atual: "" };

/**
 * @param {HTMLElement} raiz
 * @param {{
 *  versaoMenu: number,
 *  versaoAlvo: number|string,
 *  statusEscolhaVersao: number,
 *  onStatus?: (t: string) => void,
 * }} estadoUi
 * @param {object|null} pedido
 * @param {object|null} aviso
 */
export function pintarTurnoStage(raiz, estadoUi, pedido, aviso) {
  pintarPainelTurno(raiz, estadoUi, pedido, aviso, SELS);
}

/**
 * @param {HTMLElement} raiz
 * @param {{ aliados?: object[], foes?: object[] }|null} sessao
 */
export function pintarVidasStage(raiz, sessao) {
  atualizarBarrasHp(raiz.querySelector("[data-bs-vidas]"), sessao, {
    assinatura: vidasSig,
  });
}

export function resetarAssinaturaVidasStage() {
  vidasSig.atual = "";
}

export function ligarCliquesHud(raiz) {
  raiz.querySelector("[data-bs-golpes]").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-golpe]");
    if (!btn) return;
    escolherGolpeTurno(btn.dataset.golpe);
  });
  raiz.querySelector("[data-bs-alvos]").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-alvo]");
    if (!btn) return;
    escolherAlvoTurno(btn.dataset.alvo);
  });
}
