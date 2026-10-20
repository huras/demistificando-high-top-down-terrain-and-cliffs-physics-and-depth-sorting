/**
 * Janela full-page do Poké Mart (cream HUD).
 * Espelha o padrão do PC do Bill.
 */
import { comprar, estado, fecharTopo, vender } from "../estado.js";
import { htmlIcone } from "../icones.js";
import {
  CATEGORIAS_LOJA,
  itensCompra,
  itensVendaveis,
  lojaAtual,
  maximoLoja,
  quantidadeLoja,
} from "../loja.js";

let raiz = null;
let mensagem = "";
let tom = "";

export function ligarJanelaLoja(overlay) {
  raiz = overlay.querySelector("#jogo-loja");
  if (!raiz || raiz.dataset.pronta) return;
  raiz.dataset.pronta = "1";
  montar();
  raiz.addEventListener("click", noClique);
}

export function sincronizarJanelaLoja(aberta) {
  if (!raiz) return;
  if (!aberta) {
    if (raiz.hidden) return;
    raiz.hidden = true;
    raiz.classList.remove("is-in");
    document.body.classList.remove("is-loja-open");
    mensagem = "";
    tom = "";
    return;
  }
  const abrindo = raiz.hidden;
  if (abrindo) {
    const loja = lojaAtual();
    loja.sel = null;
    loja.qtd = 1;
    mensagem = "";
    tom = "";
    raiz.hidden = false;
    document.body.classList.add("is-loja-open");
    requestAnimationFrame(() => raiz?.classList.add("is-in"));
  }
  pintar();
}

function montar() {
  raiz.innerHTML = `<div class="loja-hud__backdrop" data-loja="fechar"></div>
    <div class="loja-hud__sheet" role="dialog" aria-modal="true" aria-labelledby="loja-titulo">
      <header class="loja-hud__header">
        <div class="loja-hud__identity">
          <p class="loja-hud__kicker">Balcão</p>
          <h2 class="loja-hud__title" id="loja-titulo">Poké Mart</h2>
        </div>
        <div class="loja-hud__wallet" title="Carteira">
          <span aria-hidden="true">¥</span>
          <b data-loja-dinheiro>0</b>
        </div>
        <button type="button" class="loja-hud__close" data-loja="fechar" aria-label="Fechar">×</button>
      </header>
      <nav class="loja-hud__modes" role="tablist" data-loja-modos></nav>
      <div class="loja-hud__main">
        <nav class="loja-hud__cats" role="tablist" data-loja-cats></nav>
        <div class="loja-hud__shelf" data-loja-prateleira tabindex="0"></div>
        <aside class="loja-hud__inspector" data-loja-inspector></aside>
      </div>
    </div>`;
}

function noClique(ev) {
  const btn = ev.target.closest("[data-loja]");
  if (!btn || !raiz.contains(btn)) return;
  const act = btn.dataset.loja;
  const loja = lojaAtual();

  if (act === "fechar") {
    fecharTopo();
    return;
  }
  if (act === "modo") {
    loja.aba = btn.dataset.aba === "vender" ? "vender" : "comprar";
    loja.qtd = 1;
    loja.sel = null;
    mensagem = "";
    pintar();
    return;
  }
  if (act === "cat") {
    loja.cat = btn.dataset.cat || "tudo";
    loja.sel = null;
    mensagem = "";
    pintar();
    return;
  }
  if (act === "card") {
    loja.sel = { tipo: btn.dataset.tipo, key: btn.dataset.key };
    mensagem = "";
    pintar();
    return;
  }
  if (act === "qtd") {
    const delta = btn.dataset.delta;
    const item = itemSelecionado();
    if (delta === "max" && item) loja.qtd = maximoLoja(item, loja.aba);
    else if (delta === "min") loja.qtd = 1;
    else loja.qtd = Math.max(1, Math.min(99, loja.qtd + (Number(delta) || 0)));
    pintar();
    return;
  }
  if (act === "acao") {
    const item = itemSelecionado();
    if (!item) return;
    const n = quantidadeLoja(item);
    const err =
      loja.aba === "vender"
        ? vender(item.tipo, item.key, n)
        : comprar(item.tipo, item.key, n);
    if (err) {
      mensagem = err;
      tom = "bad";
    } else {
      mensagem =
        loja.aba === "vender"
          ? `Vendeu ${item.nome} ×${n}.`
          : `Comprou ${item.nome} ×${n}.`;
      tom = "good";
      if (loja.aba === "vender" && contarSeguro(item) <= 0) loja.sel = null;
    }
    pintar();
  }
}

function contarSeguro(item) {
  const lista = lojaAtual().aba === "vender" ? itensVendaveis("tudo") : itensCompra("tudo");
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].tipo === item.tipo && lista[i].key === item.key) return lista[i].qtd || 0;
  }
  return 0;
}

function itemSelecionado() {
  const loja = lojaAtual();
  if (!loja.sel) return null;
  const lista = loja.aba === "vender" ? itensVendaveis(loja.cat) : itensCompra(loja.cat);
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].tipo === loja.sel.tipo && lista[i].key === loja.sel.key) return lista[i];
  }
  return null;
}

function pintar() {
  if (!raiz || raiz.hidden) return;
  const loja = lojaAtual();
  const compra = loja.aba !== "vender";
  const itens = compra ? itensCompra(loja.cat) : itensVendaveis(loja.cat);

  const dinheiro = raiz.querySelector("[data-loja-dinheiro]");
  if (dinheiro) dinheiro.textContent = String(estado.dinheiro | 0);

  const modos = raiz.querySelector("[data-loja-modos]");
  if (modos) {
    modos.innerHTML = `
      <button type="button" class="loja-hud__mode${compra ? " is-active" : ""}" data-loja="modo" data-aba="comprar">Comprar</button>
      <button type="button" class="loja-hud__mode${!compra ? " is-active" : ""}" data-loja="modo" data-aba="vender">Vender</button>`;
  }

  const cats = raiz.querySelector("[data-loja-cats]");
  if (cats) {
    cats.innerHTML = CATEGORIAS_LOJA.map(
      ([id, rotulo]) =>
        `<button type="button" class="loja-hud__cat${loja.cat === id ? " is-active" : ""}" data-loja="cat" data-cat="${id}">${rotulo}</button>`,
    ).join("");
  }

  if (!loja.sel && itens.length) loja.sel = { tipo: itens[0].tipo, key: itens[0].key };
  const sel = itemSelecionado();

  const prateleira = raiz.querySelector("[data-loja-prateleira]");
  if (prateleira) {
    if (!itens.length) {
      prateleira.innerHTML = `<p class="loja-hud__empty">${compra ? "Nada nessa categoria." : "Nada para vender."}</p>`;
    } else {
      const cards = itens
        .map((item) => {
          const on = sel && sel.tipo === item.tipo && sel.key === item.key;
          const caro = compra && item.preco > 0 && estado.dinheiro < item.preco;
          const owned = item.qtd > 0 ? `<span class="loja-hud__card-owned">×${item.qtd}</span>` : `<span class="loja-hud__card-owned" hidden></span>`;
          return `<button type="button" class="loja-hud__card${on ? " is-selected" : ""}${caro ? " is-unaffordable" : ""}" data-loja="card" data-tipo="${item.tipo}" data-key="${item.key}">
            <span class="loja-hud__card-icon">${htmlIcone(item.key, "loja-hud__icon", 44)}</span>
            <span class="loja-hud__card-name">${esc(item.nome)}</span>
            ${owned}
            <span class="loja-hud__card-price">¥${item.preco}</span>
          </button>`;
        })
        .join("");
      prateleira.innerHTML = `<div class="loja-hud__grid">${cards}</div>`;
    }
  }

  pintarInspector(sel, compra);
}

function pintarInspector(item, compra) {
  const host = raiz.querySelector("[data-loja-inspector]");
  if (!host) return;
  if (!item) {
    host.innerHTML = `<p class="loja-hud__detail-name">Escolha um item</p>
      <p class="loja-hud__detail-desc">Toque num card da prateleira.</p>
      <p class="loja-hud__message" data-tone="${tom}">${esc(mensagem)}</p>`;
    return;
  }
  const loja = lojaAtual();
  const teto = maximoLoja(item, loja.aba);
  loja.qtd = Math.max(1, Math.min(loja.qtd, teto));
  const total = item.preco * loja.qtd;
  const pode =
    compra
      ? item.preco === 0 || estado.dinheiro >= total
      : (item.qtd || 0) >= loja.qtd;
  host.innerHTML = `
    <div class="loja-hud__detail-icon">${htmlIcone(item.key, "loja-hud__icon", 56)}</div>
    <div class="loja-hud__detail-name">${esc(item.nome)}</div>
    <div class="loja-hud__detail-meta">¥${item.preco}${loja.qtd > 1 ? ` · total ¥${total}` : ""}</div>
    <p class="loja-hud__detail-owned">${compra ? `Você tem ×${item.qtd | 0}` : `Estoque ×${item.qtd | 0}`}</p>
    <p class="loja-hud__detail-desc">${esc(item.dica || "Item do Poké Mart.")}</p>
    <div class="loja-hud__qty">
      <label class="loja-hud__qty-label">Qtd <b>${loja.qtd}</b></label>
      <div class="loja-hud__qty-steps">
        <button type="button" class="loja-hud__qty-btn" data-loja="qtd" data-delta="-1">−1</button>
        <button type="button" class="loja-hud__qty-btn" data-loja="qtd" data-delta="1">+1</button>
        <button type="button" class="loja-hud__qty-btn" data-loja="qtd" data-delta="10">+10</button>
        <button type="button" class="loja-hud__qty-btn" data-loja="qtd" data-delta="max">Máx</button>
      </div>
      <button type="button" class="loja-hud__action" data-loja="acao" ${pode ? "" : "disabled"}>
        ${compra ? "Comprar" : "Vender"}
      </button>
    </div>
    <p class="loja-hud__message" data-tone="${tom}">${esc(mensagem)}</p>`;
}

function esc(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&amp;";
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === '"') return "&quot;";
    return "&#39;";
  });
}
