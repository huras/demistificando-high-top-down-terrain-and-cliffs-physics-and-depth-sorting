/** Roda de itens: segurar 1–6 abre; soltar equipa o ícone sob o mouse. */

import { teclaAgora, teclaBaixa } from "../entrada/teclado.js";
import { BOLAS, BERRIES, BLOCOS, FERRAMENTAS, REMEDIOS, TIPO_ITEM, slotDaTecla } from "../wild/catalogo.js";
import { htmlIcone } from "./icones.js";
import { atribuirSlot, contar, estado, nomeDe } from "./estado.js";
import { pintar } from "./ui.js";

const SEGURAR_MS = 160;
const TECLAS = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6"];
const CATS = [
  { id: "ball", nome: "Bolas", tipo: TIPO_ITEM.BOLA, fonte: BOLAS },
  { id: "berry", nome: "Berries", tipo: TIPO_ITEM.BERRY, fonte: BERRIES },
  { id: "medicine", nome: "Remédios", tipo: TIPO_ITEM.REMEDIO, fonte: REMEDIOS },
  { id: "tool", nome: "Ferramentas", tipo: TIPO_ITEM.FERRAMENTA, fonte: FERRAMENTAS },
  { id: "block", nome: "Blocos", tipo: TIPO_ITEM.BLOCO, fonte: BLOCOS },
];

let raiz = null;
let anel = null;
let aberta = false;
let tecla = "";
let desde = 0;
let cat = 0;
let mira = 0;
let ponteiro = null;

function campoFocado() {
  const tag = document.activeElement?.tagName;
  return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
}

function itensDaCat() {
  const c = CATS[cat];
  const lista = [];
  for (const key of Object.keys(c.fonte)) {
    if (contar(c.tipo, key) <= 0) continue;
    lista.push({ tipo: c.tipo, key, nome: c.fonte[key].nome });
  }
  return lista;
}

function montarDom() {
  raiz = document.createElement("div");
  raiz.className = "bag-wheel";
  raiz.hidden = true;
  raiz.innerHTML = `
    <div class="bag-wheel__dim"></div>
    <div class="bag-wheel__frame">
      <div class="bag-wheel__tabs" data-tabs></div>
      <div class="bag-wheel__ring" data-anel>
        <div class="bag-wheel__center">
          <div data-centro-icone></div>
          <div class="bag-wheel__center-name" data-centro-nome></div>
          <div class="bag-wheel__center-desc" data-centro-qtd></div>
        </div>
      </div>
      <p class="bag-wheel__cmds">Segure o número · mire com o mouse · solte para equipar · Q e E trocam a categoria</p>
    </div>`;
  document.body.appendChild(raiz);
  anel = raiz.querySelector("[data-anel]");
  raiz.addEventListener("pointermove", (ev) => {
    ponteiro = { x: ev.clientX, y: ev.clientY };
    if (aberta) apontar();
  });
  raiz.querySelector("[data-tabs]").addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-cat]");
    if (!btn) return;
    cat = Number(btn.dataset.cat);
    mira = 0;
    desenhar();
  });
}

function desenhar() {
  const lista = itensDaCat();
  if (mira >= lista.length) mira = 0;
  const tabs = raiz.querySelector("[data-tabs]");
  tabs.innerHTML = CATS.map((c, i) => `<button type="button" class="bag-wheel__tab${i === cat ? " is-active" : ""}" data-cat="${i}">${c.nome}</button>`).join("");
  anel.querySelectorAll(".bag-wheel__item").forEach((n) => n.remove());
  const n = lista.length || 1;
  lista.forEach((item, i) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `bag-wheel__item${i === mira ? " is-on" : ""}`;
    const rad = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const raio = 30;
    el.style.left = `calc(50% + ${Math.cos(rad) * raio}%)`;
    el.style.top = `calc(50% + ${Math.sin(rad) * raio}%)`;
    el.innerHTML = `${htmlIcone(item.key, "bag-wheel__icon")}<span>${contar(item.tipo, item.key)}</span>`;
    el.addEventListener("pointerenter", () => {
      mira = i;
      pintarCentro(lista);
      anel.querySelectorAll(".bag-wheel__item").forEach((node, k) => node.classList.toggle("is-on", k === i));
    });
    anel.appendChild(el);
  });
  pintarCentro(lista);
}

function pintarCentro(lista) {
  const item = lista[mira];
  const icone = raiz.querySelector("[data-centro-icone]");
  const nome = raiz.querySelector("[data-centro-nome]");
  const qtd = raiz.querySelector("[data-centro-qtd]");
  if (!item) {
    icone.innerHTML = "";
    nome.textContent = "Vazio";
    qtd.textContent = "";
    return;
  }
  icone.innerHTML = htmlIcone(item.key, "bag-wheel__center-icon");
  nome.textContent = item.nome || nomeDe(item.tipo, item.key);
  qtd.textContent = `×${contar(item.tipo, item.key)}`;
}

function apontar() {
  if (!ponteiro || !anel) return;
  const lista = itensDaCat();
  if (!lista.length) return;
  const rect = anel.getBoundingClientRect();
  const ang = Math.atan2(ponteiro.y - (rect.top + rect.height / 2), ponteiro.x - (rect.left + rect.width / 2));
  let t = (ang + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
  const i = Math.min(lista.length - 1, Math.floor((t / (Math.PI * 2)) * lista.length));
  if (i === mira) return;
  mira = i;
  pintarCentro(lista);
  anel.querySelectorAll(".bag-wheel__item").forEach((node, k) => node.classList.toggle("is-on", k === i));
}

function catInicial(slot) {
  const item = estado.hotbar[slot];
  if (!item) return 0;
  const i = CATS.findIndex((c) => c.tipo === item.tipo);
  return i < 0 ? 0 : i;
}

function abrir(slot) {
  aberta = true;
  estado.roda = true;
  estado.slotAtivo = slot;
  cat = catInicial(slot);
  const atual = estado.hotbar[slot];
  const lista = itensDaCat();
  const achou = lista.findIndex((it) => atual && it.tipo === atual.tipo && it.key === atual.key);
  mira = achou < 0 ? 0 : achou;
  raiz.hidden = false;
  raiz.classList.add("is-in");
  desenhar();
}

function fechar(equipar) {
  const lista = itensDaCat();
  const item = equipar ? lista[mira] : null;
  const slot = estado.slotAtivo;
  aberta = false;
  estado.roda = false;
  raiz.classList.remove("is-in");
  raiz.hidden = true;
  if (item) atribuirSlot(slot, item.tipo, item.key);
  pintar();
}

export function ligarRoda() {
  montarDom();
}

export function tickRoda() {
  if (!raiz) return;
  if (campoFocado() || estado.painel || estado.dialogo || estado.construir || estado.craft) {
    if (aberta) fechar(false);
    tecla = "";
    return;
  }
  if (aberta) {
    if (teclaAgora("KeyQ")) {
      cat = (cat + CATS.length - 1) % CATS.length;
      mira = 0;
      desenhar();
    } else if (teclaAgora("KeyE")) {
      cat = (cat + 1) % CATS.length;
      mira = 0;
      desenhar();
    } else if (teclaAgora("Escape")) {
      fechar(false);
      tecla = "";
      return;
    }
  }
  let baixa = "";
  for (let i = 0; i < TECLAS.length; i++) {
    if (teclaBaixa(TECLAS[i])) {
      baixa = TECLAS[i];
      break;
    }
  }
  if (baixa && !tecla) {
    tecla = baixa;
    desde = performance.now();
    estado.slotAtivo = slotDaTecla(baixa);
    pintar();
  } else if (!baixa && tecla) {
    const slot = slotDaTecla(tecla);
    tecla = "";
    if (aberta) fechar(true);
    else {
      estado.slotAtivo = slot;
      pintar();
    }
  } else if (baixa && !aberta && performance.now() - desde >= SEGURAR_MS) {
    abrir(slotDaTecla(baixa));
  }
}

export function rodaAberta() {
  return aberta;
}
