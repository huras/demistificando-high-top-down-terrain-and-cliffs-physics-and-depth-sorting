/**
 * HUD do catálogo de construção (martelo outdoor).
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
} from "../construir/indice.js";
import { contarItem } from "../pokemon/party.js";
import { nomeMaterial } from "../construir/custos.js";
import { contarStockCasa, contarStockMovel } from "../construir/stock.js";
import { MATERIAIS } from "../wild/catalogo.js";

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

function garantirDom() {
  if (raiz) return raiz;
  raiz = document.createElement("aside");
  raiz.id = "construir-catalogo";
  raiz.className = "bch";
  raiz.hidden = true;
  raiz.innerHTML = `
    <div class="bch__topo">
      <h2 class="bch__titulo">Construir</h2>
      <button type="button" class="bch__fechar" data-act="fechar" aria-label="Fechar">×</button>
    </div>
    <div class="bch__tabs" data-tabs></div>
    <div class="bch__subs" data-subs></div>
    <div class="bch__lista" data-lista></div>
    <p class="bch__rodape">Selecione e clique no chão para iniciar a construção.</p>
  `;
  document.body.appendChild(raiz);
  raiz.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.getAttribute("data-act");
    if (act === "fechar") {
      abrirCatalogoConstruir(false);
      pintar();
      return;
    }
    if (act === "tab") {
      tab = btn.getAttribute("data-id");
      sub = tab === TIPO_CONSTRUIR.CASA ? SUB_CASA_ORDEM[0] : SUB_MOVEL_ORDEM[0];
      pintar();
      return;
    }
    if (act === "sub") {
      sub = btn.getAttribute("data-id");
      pintar();
      return;
    }
    if (act === "item") {
      const kind = btn.getAttribute("data-kind");
      const id = btn.getAttribute("data-id");
      selecionarConstruir(kind, id);
      pintar();
    }
  });
  return raiz;
}

function chipCusto(key, amount, tem) {
  const nome = MATERIAIS[key]?.nome || nomeMaterial(key);
  const empty = tem < amount ? " is-empty" : "";
  return `<span class="bch__mat${empty}" title="${nome}">${nome} ${amount}</span>`;
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

  const tabs = el.querySelector("[data-tabs]");
  tabs.innerHTML = [
    [TIPO_CONSTRUIR.CASA, "Casas"],
    [TIPO_CONSTRUIR.MOVEL, "Móveis"],
    [TIPO_CONSTRUIR.CERCA, "Cercas"],
  ]
    .map(
      ([id, nome]) =>
        `<button type="button" class="bch__tab${tab === id ? " is-on" : ""}" data-act="tab" data-id="${id}">${nome}</button>`
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
          `<button type="button" class="bch__sub${sub === id ? " is-on" : ""}" data-act="sub" data-id="${id}">${LABELS_SUB[id] || id}</button>`
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
      const stockHtml = stock > 0 ? `<span class="bch__mat">Estoque ${stock}</span>` : "";
      return `<button type="button" class="bch__item${sel ? " is-sel" : ""}${ok ? "" : " is-off"}" data-act="item" data-kind="${r.kind}" data-id="${r.id}">
        <span class="bch__nome">${r.label || r.id}</span>
        <span></span>
        <span class="bch__custo">${stockHtml}${custoHtml}</span>
      </button>`;
    })
    .join("");
}

function pintar() {
  pintarCatalogoConstruir();
}

export function atualizarCatalogoConstruir() {
  pintarCatalogoConstruir();
}
