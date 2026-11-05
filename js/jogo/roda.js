/** Roda de itens: segurar 1–6 abre; soltar equipa o ícone sob o mouse. */

import { teclaAgora, teclaBaixa } from "../entrada/teclado.js";
import { alternarCampo } from "../pokemon/party.js";
import { BOLAS, BERRIES, BLOCOS, FERRAMENTAS, REMEDIOS, TIPO_ITEM, slotDaTecla } from "../wild/catalogo.js";
import { descricaoItem } from "./descricaoItem.js";
import { htmlIcone } from "./icones.js";
import { atribuirSlot, alternarSlot, contar, estado, nomeDe } from "./estado.js";
import { cancelarRanged } from "./ranged.js";
import { pintar } from "./ui.js";

const SEGURAR_MS = 160;
const POR_PAGINA = 10;
const ICONE_PX = 56;
const MOUSE_DEADZONE_PX = 20;
const MOUSE_CENTER_RATIO = 0.5;
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
let spoke = null;
let aberta = false;
let tecla = "";
let desde = 0;
let cat = 0;
let pagina = 0;
let mira = 0;
let ponteiro = null;
let acumScroll = 0;
let slotAlvo = 0;
let comShift = false;
/** Depois de Escape (ou fechar sem equipar), ignora o Digit até soltar. */
let ignoraAteSoltar = false;
let aimDeg = -90;
let ouvindoPonteiro = false;

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

function totalPaginas(lista) {
  return Math.max(1, Math.ceil((lista?.length || 0) / POR_PAGINA));
}

function itensDaPagina(lista) {
  const todos = lista || itensDaCat();
  const max = totalPaginas(todos);
  if (pagina >= max) pagina = max - 1;
  if (pagina < 0) pagina = 0;
  const ini = pagina * POR_PAGINA;
  return todos.slice(ini, ini + POR_PAGINA);
}

function wrapDeg360(deg) {
  return ((deg % 360) + 360) % 360;
}

function shortestRotation(currentDeg, targetDeg) {
  const from = wrapDeg360(currentDeg);
  const to = wrapDeg360(targetDeg);
  let delta = to - from;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return currentDeg + delta;
}

function itemAngleDeg(index, count) {
  if (count < 1) return -90;
  return (index / count) * 360 - 90;
}

function pintarCmds() {
  const el = raiz?.querySelector("[data-cmds-soltar]");
  if (el) el.textContent = `atribuir no ${slotAlvo + 1}`;
}

function syncAim(hoverIndex, count) {
  if (!spoke) return;
  const on = hoverIndex >= 0 && count > 0;
  spoke.classList.toggle("is-on", on);
  if (!on) return;
  aimDeg = shortestRotation(aimDeg, itemAngleDeg(hoverIndex, count));
  spoke.style.transform = `rotate(${aimDeg}deg)`;
}

function atualizarWedge(count) {
  if (!anel) return;
  const wedge = Math.min(count > 0 ? 360 / count : 36, 44);
  anel.style.setProperty("--bag-wheel-wedge", `${wedge.toFixed(2)}deg`);
}

function aoPonteiroJanela(ev) {
  if (!aberta) return;
  ponteiro = { x: ev.clientX, y: ev.clientY };
  apontar();
}

function ligarPonteiroJanela() {
  if (ouvindoPonteiro) return;
  window.addEventListener("pointermove", aoPonteiroJanela);
  ouvindoPonteiro = true;
}

function desligarPonteiroJanela() {
  if (!ouvindoPonteiro) return;
  window.removeEventListener("pointermove", aoPonteiroJanela);
  ouvindoPonteiro = false;
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
        <div class="bag-wheel__aim" data-spoke>
          <div class="bag-wheel__aim-wedge"></div>
          <svg class="bag-wheel__aim-mark" viewBox="0 0 22 18" aria-hidden="true">
            <path class="bag-wheel__aim-mark-edge" d="M1 1.2 21 9 1 16.8 6.2 9Z"/>
            <path class="bag-wheel__aim-mark-body" d="M2.6 3.2 17.8 9 2.6 14.8 6.6 9Z"/>
          </svg>
        </div>
        <div class="bag-wheel__center">
          <div class="bag-wheel__hero">
            <div data-centro-icone></div>
            <span class="bag-wheel__center-qty" data-centro-qtd hidden></span>
          </div>
          <div class="bag-wheel__center-name" data-centro-nome></div>
          <div class="bag-wheel__center-desc" data-centro-desc></div>
        </div>
      </div>
      <div class="bag-wheel__cmds">
        <span class="bag-wheel__cmd"><b>Scroll</b> página / categoria</span>
        <span class="bag-wheel__cmd"><b>Mouse</b> aponta para escolher</span>
        <span class="bag-wheel__cmd"><b>Soltar</b> <span data-cmds-soltar>atribuir no 1</span></span>
      </div>
    </div>`;
  document.body.appendChild(raiz);
  anel = raiz.querySelector("[data-anel]");
  spoke = raiz.querySelector("[data-spoke]");
  raiz.querySelector("[data-tabs]").addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-cat]");
    if (!btn) return;
    cat = Number(btn.dataset.cat);
    pagina = 0;
    mira = 0;
    desenhar();
  });
}

function aplicarMira(i, lista) {
  mira = i;
  pintarCentro(lista);
  syncAim(mira, lista.length);
  anel.querySelectorAll(".bag-wheel__item").forEach((node, k) => node.classList.toggle("is-on", k === i));
}

function desenhar() {
  const paginaItens = itensDaPagina();
  if (mira >= paginaItens.length) mira = Math.max(0, paginaItens.length - 1);
  const tabs = raiz.querySelector("[data-tabs]");
  tabs.innerHTML = CATS.map((c, i) => `<button type="button" class="bag-wheel__tab${i === cat ? " is-active" : ""}" data-cat="${i}">${c.nome}</button>`).join("");
  anel.querySelectorAll(".bag-wheel__item").forEach((n) => n.remove());
  const n = paginaItens.length || 1;
  atualizarWedge(paginaItens.length);
  paginaItens.forEach((item, i) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `bag-wheel__item${i === mira ? " is-on" : ""}`;
    const rad = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const raio = 41;
    el.style.left = `calc(50% + ${Math.cos(rad) * raio}%)`;
    el.style.top = `calc(50% + ${Math.sin(rad) * raio}%)`;
    const qtd = contar(item.tipo, item.key);
    el.innerHTML = `${htmlIcone(item.key, "bag-wheel__icon", ICONE_PX)}<span class="bag-wheel__qty">x${qtd}</span>`;
    el.addEventListener("pointerenter", () => {
      aplicarMira(i, paginaItens);
    });
    anel.appendChild(el);
  });
  pintarCmds();
  pintarCentro(paginaItens);
  syncAim(paginaItens.length ? mira : -1, paginaItens.length);
}

function pintarCentro(lista) {
  const item = lista[mira];
  const icone = raiz.querySelector("[data-centro-icone]");
  const nome = raiz.querySelector("[data-centro-nome]");
  const qtd = raiz.querySelector("[data-centro-qtd]");
  const desc = raiz.querySelector("[data-centro-desc]");
  if (!item) {
    icone.innerHTML = "";
    nome.textContent = "Vazio";
    qtd.hidden = true;
    qtd.textContent = "";
    desc.textContent = "";
    desc.hidden = true;
    return;
  }
  icone.innerHTML = htmlIcone(item.key, "bag-wheel__center-icon", 120);
  nome.textContent = item.nome || nomeDe(item.tipo, item.key);
  qtd.hidden = false;
  qtd.textContent = `x${contar(item.tipo, item.key)}`;
  const texto = descricaoItem(item.tipo, item.key);
  desc.textContent = texto;
  desc.hidden = !texto;
}

function indicePeloMouse(lista) {
  if (!ponteiro || !anel || !lista.length) return null;
  const rect = anel.getBoundingClientRect();
  const cx = rect.left + rect.width * 0.5;
  const cy = rect.top + rect.height * 0.5;
  const dx = ponteiro.x - cx;
  const dy = ponteiro.y - cy;
  const radius = Math.min(rect.width, rect.height) * 0.5;
  const dz = Math.max(MOUSE_DEADZONE_PX, radius * MOUSE_CENTER_RATIO);
  if (Math.hypot(dx, dy) < dz) return null;
  const ang = Math.atan2(dy, dx);
  let t = (ang + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
  return Math.min(lista.length - 1, Math.floor((t / (Math.PI * 2)) * lista.length));
}

function apontar() {
  if (!anel) return;
  const lista = itensDaPagina();
  if (!lista.length) return;
  const i = indicePeloMouse(lista);
  if (i == null || i === mira) return;
  aplicarMira(i, lista);
}

function catInicial(slot) {
  const item = estado.hotbar[slot];
  if (!item) return 0;
  const i = CATS.findIndex((c) => c.tipo === item.tipo);
  return i < 0 ? 0 : i;
}

function abrir(slot) {
  cancelarRanged();
  aberta = true;
  estado.roda = true;
  slotAlvo = slot;
  acumScroll = 0;
  cat = catInicial(slot);
  const atual = estado.hotbar[slot];
  const lista = itensDaCat();
  const achou = lista.findIndex((it) => atual && it.tipo === atual.tipo && it.key === atual.key);
  if (achou < 0) {
    pagina = 0;
    mira = 0;
  } else {
    pagina = Math.floor(achou / POR_PAGINA);
    mira = achou % POR_PAGINA;
  }
  raiz.hidden = false;
  raiz.classList.add("is-in");
  ligarPonteiroJanela();
  desenhar();
}

function fechar(equipar) {
  const lista = itensDaPagina();
  const item = equipar ? lista[mira] : null;
  const slot = slotAlvo;
  aberta = false;
  estado.roda = false;
  acumScroll = 0;
  desligarPonteiroJanela();
  raiz.classList.remove("is-in");
  raiz.hidden = true;
  if (spoke) spoke.classList.remove("is-on");
  if (item) {
    const atual = estado.hotbar[slot];
    const mesmo = !!(atual && atual.tipo === item.tipo && atual.key === item.key);
    // Mesmo item já no slot: soltar a roda = toque (liga/desliga), não re-arma sempre.
    if (mesmo) alternarSlot(slot);
    else {
      atribuirSlot(slot, item.tipo, item.key);
      estado.slotAtivo = contar(item.tipo, item.key) > 0 ? slot : -1;
    }
  }
  pintar();
}

function mudarCategoria(dir) {
  cat = (cat + dir + CATS.length) % CATS.length;
  pagina = 0;
  mira = 0;
  desenhar();
}

function mudarPagina(dir) {
  const todos = itensDaCat();
  const paginas = totalPaginas(todos);
  let p = pagina + dir;
  if (p >= paginas) {
    mudarCategoria(1);
    return;
  }
  if (p < 0) {
    cat = (cat - 1 + CATS.length) % CATS.length;
    pagina = totalPaginas(itensDaCat()) - 1;
    mira = 0;
    desenhar();
    return;
  }
  pagina = p;
  mira = 0;
  desenhar();
}

/** True se a roda comeu o scroll. Página primeiro; na borda troca categoria. */
export function rolarCategoria(deltaY) {
  if (!aberta || !deltaY) return aberta;
  acumScroll += deltaY;
  if (Math.abs(acumScroll) < 60) return true;
  mudarPagina(acumScroll > 0 ? 1 : -1);
  acumScroll = 0;
  return true;
}

export function ligarRoda() {
  montarDom();
  raiz.addEventListener("wheel", (ev) => {
    if (!aberta) return;
    ev.preventDefault();
    rolarCategoria(ev.deltaY);
  }, { passive: false });
}

export function tickRoda() {
  if (!raiz) return;
  if (
    campoFocado() ||
    estado.painel ||
    estado.capsulaAberta ||
    estado.dialogo ||
    estado.construir ||
    estado.craft
  ) {
    if (aberta) fechar(false);
    tecla = "";
    comShift = false;
    ignoraAteSoltar = false;
    return;
  }
  if (aberta) {
    if (teclaAgora("KeyQ")) mudarCategoria(-1);
    else if (teclaAgora("KeyE")) mudarCategoria(1);
    else if (teclaAgora("Escape")) {
      fechar(false);
      tecla = "";
      comShift = false;
      ignoraAteSoltar = true;
      return;
    }
  }
  // Shift = sprint; não pode engolir o Digit. Toque com Shift troca a party;
  // segurar (com ou sem Shift) abre a roda.
  let baixa = "";
  for (let i = 0; i < TECLAS.length; i++) {
    if (teclaBaixa(TECLAS[i])) {
      baixa = TECLAS[i];
      break;
    }
  }
  if (ignoraAteSoltar) {
    if (!baixa) ignoraAteSoltar = false;
    return;
  }
  const shift = teclaBaixa("ShiftLeft") || teclaBaixa("ShiftRight");
  if (baixa && !tecla) {
    tecla = baixa;
    desde = performance.now();
    slotAlvo = slotDaTecla(baixa);
    comShift = shift;
  } else if (!baixa && tecla) {
    const slot = slotAlvo;
    const foiShift = comShift;
    tecla = "";
    comShift = false;
    if (aberta) fechar(true);
    else if (foiShift) alternarCampo(slot);
    else {
      cancelarRanged();
      alternarSlot(slot);
    }
  } else if (baixa && tecla && !aberta && performance.now() - desde >= SEGURAR_MS) {
    abrir(slotAlvo);
  }
}

export function rodaAberta() {
  return aberta;
}
