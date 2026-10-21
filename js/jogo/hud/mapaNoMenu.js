/**
 * Hospeda o mapa mundial na aba Map do menu (paridade Pokemon AI / is-map-focus).
 * Sem tela intermediária com botão "abrir mapa".
 */

import { abrirMapa, fecharMapa, mapaAberto } from "../../ui/mapa/mapaMundo.js";

/** @type {{ parent: Node, next: ChildNode | null } | null} */
let parque = null;
let hospedado = false;
let fechandoViaMenu = false;
/** @type {(() => void) | null} */
let pedirFecharMenu = null;

function elMapa() {
  return document.getElementById("mapa-mundo");
}

function hostMenu() {
  return document.querySelector("[data-menu-map-host]");
}

function guardarParque(mapa) {
  if (parque || !mapa?.parentNode) return;
  parque = { parent: mapa.parentNode, next: mapa.nextSibling };
}

function hospedar() {
  const mapa = elMapa();
  const host = hostMenu();
  if (!mapa || !host) return false;
  guardarParque(mapa);
  if (mapa.parentNode !== host) host.appendChild(mapa);
  mapa.classList.add("mapa-mundo--menu");
  hospedado = true;
  return true;
}

function devolver() {
  const mapa = elMapa();
  if (!mapa || !parque) {
    hospedado = false;
    return;
  }
  mapa.classList.remove("mapa-mundo--menu");
  if (parque.next && parque.next.parentNode === parque.parent) {
    parque.parent.insertBefore(mapa, parque.next);
  } else {
    parque.parent.appendChild(mapa);
  }
  hospedado = false;
}

/**
 * @param {(fn: () => void) => void} registrar
 */
export function ligarFecharMapaMenu(registrar) {
  pedirFecharMenu = () => {
    if (hospedado) registrar?.();
  };
}

/** Chamado pelo mapa ao fechar (Esc / M / viagem). */
export function notificarMapaFechou() {
  if (!hospedado) return;
  devolver();
  if (!fechandoViaMenu) pedirFecharMenu?.();
}

/**
 * Sync com onPageChange do menu.
 * @param {string} page
 * @param {boolean} open
 * @param {{ x?: number, y?: number }} [pos]
 */
export function sincronizarMapaMenu(page, open, pos = {}) {
  if (open && page === "map") {
    if (!hospedar()) return;
    abrirMapa(pos.x || 0, pos.y || 0);
    return;
  }
  if (!hospedado) return;
  fechandoViaMenu = true;
  try {
    if (mapaAberto()) fecharMapa();
    devolver();
  } finally {
    fechandoViaMenu = false;
  }
}

export function mapaHospedadoNoMenu() {
  return hospedado;
}
