/**
 * HUD do catálogo de construção (martelo outdoor) — idioma candy / Skills.
 */
import {
  TIPO_CONSTRUIR,
  SUB_CASA_ORDEM,
  SUB_MOVEL_ORDEM,
  listarCasasConstruiveis,
  listarMoveisConstruiveis,
  listarCercasConstruiveis,
  custosDoRecipe,
  podePagar,
  buildMode,
  selecionarConstruir,
  abrirCatalogoConstruir,
  temClaim,
} from "../construir/indice.js";
import { contarItem } from "../pokemon/party.js";
import { nomeMaterial } from "../construir/custos.js";
import { contarStockCasa, contarStockMovel } from "../construir/stock.js";
import { MATERIAIS } from "../wild/catalogo.js";
import { htmlIcone } from "../jogo/icones.js";
import { soltarTravaMira } from "../entrada/ponteiro3d.js";

const LABELS_SUB = Object.freeze({
  city: "Cidade",
  site: "Sítio",
  beds: "Camas",
  seating: "Assentos",
  tables: "Mesas",
  machines: "Oficina",
  decor: "Decor",
  other: "Outros",
});

let raiz = null;
let tab = TIPO_CONSTRUIR.CASA;
let sub = SUB_CASA_ORDEM[0];
/** @type {null | ((ev: KeyboardEvent) => void)} */
let onEsc = null;

function ligarEsc() {
  if (onEsc) return;
  onEsc = (ev) => {
    if (ev.key !== "Escape" || !buildMode.catalogOpen) return;
    ev.preventDefault();
    abrirCatalogoConstruir(false);
    pintarCatalogoConstruir();
  };
  window.addEventListener("keydown", onEsc);
}

function garantirDom() {
  if (raiz) return raiz;
  raiz = document.createElement("aside");
  raiz.id = "construir-catalogo";
  raiz.className = "bch-hud bch-hud--outdoor";
  raiz.hidden = true;
  raiz.innerHTML = `
    <div class="bch-hud__panel hud-panel" role="dialog" aria-label="Construir">
      <header class="bch-hud__head hud-head">
        <div class="bch-hud__head-text">
          <b>Construir</b>
          <span>Base · casas · móveis · cercas</span>
        </div>
        <button type="button" class="bch-hud__x" data-act="fechar" aria-label="Fechar">×</button>
      </header>
      <p class="bch-hud__aviso" data-aviso hidden></p>
      <div class="bch-hud__tabs" data-tabs></div>
      <div class="bch-hud__subs" data-subs></div>
      <div class="bch-hud__lista" data-lista></div>
      <footer class="bch-hud__foot">
        <p class="bch-hud__hint">Selecione um item — o fantasma segue a mira.</p>
        <button type="button" class="hud-btn red big" data-act="fechar">
          Fechar
          <kbd class="hud-kbd">Esc</kbd>
        </button>
      </footer>
    </div>
  `;
  document.body.appendChild(raiz);
  ligarEsc();
  raiz.addEventListener(
    "pointerdown",
    (ev) => {
      soltarTravaMira();
      ev.stopPropagation();
    },
    true,
  );
  raiz.addEventListener("mousedown", (ev) => ev.stopPropagation(), true);
  raiz.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const btn = ev.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.getAttribute("data-act");
    if (act === "fechar") {
      abrirCatalogoConstruir(false);
      pintarCatalogoConstruir();
      return;
    }
    if (act === "tab") {
      tab = btn.getAttribute("data-id");
      sub = tab === TIPO_CONSTRUIR.CASA ? SUB_CASA_ORDEM[0] : SUB_MOVEL_ORDEM[0];
      pintarCatalogoConstruir();
      return;
    }
    if (act === "sub") {
      sub = btn.getAttribute("data-id");
      pintarCatalogoConstruir();
      return;
    }
    if (act === "item") {
      const kind = btn.getAttribute("data-kind");
      const id = btn.getAttribute("data-id");
      selecionarConstruir(kind, id);
      pintarCatalogoConstruir();
    }
  });
  return raiz;
}

function chipCusto(key, amount, tem) {
  const nome = MATERIAIS[key]?.nome || nomeMaterial(key);
  const empty = tem < amount ? " is-empty" : "";
  return `<span class="bch-mat${empty}" title="${nome} (${tem}/${amount})">${htmlIcone(key, "bch-mat__ico", 16)}<b>${amount}</b></span>`;
}

function itensDaAba() {
  if (tab === TIPO_CONSTRUIR.CASA) return listarCasasConstruiveis(sub);
  if (tab === TIPO_CONSTRUIR.MOVEL) return listarMoveisConstruiveis(sub);
  return listarCercasConstruiveis();
}

export function pintarCatalogoConstruir() {
  const el = garantirDom();
  el.hidden = !buildMode.catalogOpen;
  if (el.hidden) return;

  const aviso = el.querySelector("[data-aviso]");
  if (aviso) {
    if (!temClaim()) {
      aviso.hidden = false;
      aviso.textContent = "Plante a Bandeira primeiro para marcar sua base.";
    } else if (buildMode.selected) {
      aviso.hidden = false;
      aviso.textContent = `Selecionado: ${buildMode.selected.id} — clique no chão dentro da base.`;
    } else {
      aviso.hidden = true;
    }
  }

  const tabs = el.querySelector("[data-tabs]");
  tabs.innerHTML = [
    [TIPO_CONSTRUIR.CASA, "Casas"],
    [TIPO_CONSTRUIR.MOVEL, "Móveis"],
    [TIPO_CONSTRUIR.CERCA, "Cercas"],
  ]
    .map(
      ([id, nome]) =>
        `<button type="button" class="hud-pill${tab === id ? " is-on" : ""}" data-act="tab" data-id="${id}">${nome}</button>`
    )
    .join("");

  const subs = el.querySelector("[data-subs]");
  if (tab === TIPO_CONSTRUIR.CERCA) {
    subs.innerHTML = "";
  } else {
    const ordem = tab === TIPO_CONSTRUIR.CASA ? SUB_CASA_ORDEM : SUB_MOVEL_ORDEM;
    subs.innerHTML = ordem
      .map(
        (id) =>
          `<button type="button" class="hud-pill${sub === id ? " is-on" : ""}" data-act="sub" data-id="${id}">${LABELS_SUB[id] || id}</button>`
      )
      .join("");
  }

  const lista = el.querySelector("[data-lista]");
  const itens = itensDaAba();
  lista.innerHTML = itens
    .map((r) => {
      const costs = custosDoRecipe(r);
      const stock =
        r.kind === TIPO_CONSTRUIR.CASA
          ? contarStockCasa(r.id)
          : r.kind === TIPO_CONSTRUIR.MOVEL
            ? contarStockMovel(r.id)
            : 0;
      const ok = stock > 0 || podePagar(r);
      const sel =
        buildMode.selected?.kind === r.kind && buildMode.selected?.id === r.id;
      const custoHtml = Object.entries(costs)
        .map(([k, n]) => chipCusto(k, n, contarItem(k) | 0))
        .join("");
      const stockHtml =
        stock > 0 ? `<span class="bch-mat">Estoque ${stock}</span>` : "";
      return `<button type="button" class="bch-card${sel ? " is-sel" : ""}${ok ? "" : " is-off"}" data-act="item" data-kind="${r.kind}" data-id="${r.id}">
        <span class="bch-card__nome">${r.label || r.id}</span>
        <span></span>
        <span class="bch-card__custo">${stockHtml}${custoHtml}</span>
      </button>`;
    })
    .join("");
}

export function atualizarCatalogoConstruir() {
  pintarCatalogoConstruir();
}
