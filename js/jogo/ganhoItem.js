/**
 * Primeira vez de um item: carta no centro. Repetição: aviso no canto.
 * "mudo" só marca como já visto (itens de início e save antigo).
 */

import { itensBolsa, obterBolas } from "../pokemon/party.js";
import { classificarChave, defItem } from "../wild/catalogo.js";
import { tocarPegarItem } from "./audio.js";
import { estado, avisar } from "./estado.js";
import { htmlIcone } from "./icones.js";
import { aoMudarIdioma, t } from "./i18n.js";
import { nomeDoItem } from "./nomeItem.js";

const SUMIR_MS = 3200;
const fila = [];
const avisos = new Map();
let carta = null;
let itemAberto = null;
let dock = null;
let relogio = 0;

function marcarVisto(chave) {
  if (!estado.vistosItens || typeof estado.vistosItens !== "object") estado.vistosItens = {};
  estado.vistosItens[chave] = true;
}

function ficha(chave) {
  const def = defItem(classificarChave(chave), chave);
  return {
    chave,
    nome: nomeDoItem(chave),
    cor: def?.cor || "#d6d3d1",
    desc: def?.dica || t("ui.guarda"),
  };
}

export function semearVistosDaBolsa() {
  estado.vistosItens = {};
  for (const [chave, qtd] of itensBolsa()) {
    if (qtd > 0) estado.vistosItens[chave] = true;
  }
  if (obterBolas() > 0) estado.vistosItens.pokeball = true;
  const chaves = estado.chaves || [];
  for (let i = 0; i < chaves.length; i++) estado.vistosItens[chaves[i]] = true;
}

export function anunciarGanho(chave, qtd, fonte) {
  const n = qtd | 0;
  if (!chave || n <= 0) return;
  if (fonte === "mudo") {
    marcarVisto(chave);
    return;
  }
  const item = ficha(chave);
  item.qtd = n;
  const novo = !estado.vistosItens?.[chave];
  marcarVisto(chave);
  tocarPegarItem();
  if (typeof document === "undefined") return;
  if (novo) abrirCarta(item);
  else empurrarAviso(item);
  avisar();
}

function abrirCarta(item) {
  if (estado.ganhoAberto) {
    fila.push(item);
    return;
  }
  montarCarta(item);
}

function montarCarta(item) {
  const fresco = { ...ficha(item.chave), qtd: item.qtd };
  itemAberto = fresco;
  estado.ganhoAberto = true;
  if (typeof document !== "undefined" && document.pointerLockElement) document.exitPointerLock();
  if (carta) carta.remove();
  const raiz = document.createElement("div");
  raiz.className = "ganho-carta";
  raiz.setAttribute("role", "dialog");
  raiz.innerHTML =
    `<div class="ganho-carta__brilhos" aria-hidden="true"></div>` +
    `<div class="ganho-carta__folha">` +
    `<p class="ganho-carta__olho"></p>` +
    `<div class="ganho-carta__icone">${htmlIcone(fresco.chave, "ganho-carta__sprite", 72)}</div>` +
    `<h2 class="ganho-carta__nome"></h2>` +
    `<p class="ganho-carta__qtd"></p>` +
    `<p class="ganho-carta__desc"></p>` +
    `<p class="ganho-carta__continua"></p>` +
    `</div>`;
  raiz.querySelector(".ganho-carta__olho").textContent = t("ui.obteve");
  raiz.querySelector(".ganho-carta__nome").textContent = fresco.nome;
  raiz.querySelector(".ganho-carta__qtd").textContent = fresco.qtd > 1 ? `×${fresco.qtd}` : "";
  raiz.querySelector(".ganho-carta__desc").textContent = fresco.desc;
  raiz.querySelector(".ganho-carta__continua").textContent = t("ui.continua");
  const brilhos = raiz.querySelector(".ganho-carta__brilhos");
  for (let i = 0; i < 8; i++) {
    const p = document.createElement("span");
    p.style.setProperty("--i", String(i));
    brilhos.appendChild(p);
  }
  raiz.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    fecharCartaGanho();
  });
  document.body.appendChild(raiz);
  carta = raiz;
}

export function fecharCartaGanho() {
  if (!estado.ganhoAberto) return;
  if (fila.length) {
    montarCarta(fila.shift());
    return;
  }
  estado.ganhoAberto = false;
  itemAberto = null;
  if (carta) {
    carta.remove();
    carta = null;
  }
  avisar();
}

function garantirDock() {
  if (dock && !dock.isConnected) dock = null;
  if (dock) return dock;
  const host = document.getElementById("hud-toast-stack");
  dock = document.createElement("div");
  dock.className = "item-obtain-dock";
  dock.innerHTML = `<div class="item-obtain-toast is-visible"><ul class="item-obtain-toast__list"></ul></div>`;
  if (host) host.appendChild(dock);
  else document.body.appendChild(dock);
  return dock;
}

function empurrarAviso(item) {
  const raiz = garantirDock();
  const lista = raiz.querySelector(".item-obtain-toast__list");
  let linha = avisos.get(item.chave);
  if (linha && !linha.el.isConnected) {
    avisos.delete(item.chave);
    linha = null;
  }
  if (linha) {
    linha.qtd += item.qtd;
    linha.ate = relogio + SUMIR_MS;
    linha.el.querySelector(".item-obtain-toast__qty").textContent = `×${linha.qtd}`;
    linha.el.classList.remove("is-bump");
    void linha.el.offsetWidth;
    linha.el.classList.add("is-bump");
    return;
  }
  const el = document.createElement("li");
  el.className = "item-obtain-toast__row";
  el.innerHTML =
    `<span class="item-obtain-toast__icon">${htmlIcone(item.chave, "item-obtain-toast__sprite", 28)}</span>` +
    `<span class="item-obtain-toast__name"></span>` +
    `<span class="item-obtain-toast__qty"></span>`;
  el.querySelector(".item-obtain-toast__name").textContent = item.nome;
  el.querySelector(".item-obtain-toast__qty").textContent = `×${item.qtd}`;
  lista.appendChild(el);
  requestAnimationFrame(() => el.classList.add("is-visible"));
  avisos.set(item.chave, { el, qtd: item.qtd, ate: relogio + SUMIR_MS });
}

export function tickGanho(dt) {
  if (!avisos.size) return;
  relogio += dt * 1000;
  for (const [chave, linha] of avisos) {
    if (relogio < linha.ate) continue;
    linha.el.remove();
    avisos.delete(chave);
  }
}

aoMudarIdioma(() => {
  for (const [chave, linha] of avisos) {
    const nome = linha.el.querySelector(".item-obtain-toast__name");
    if (nome) nome.textContent = nomeDoItem(chave);
  }
  if (itemAberto && estado.ganhoAberto) montarCarta(itemAberto);
});
