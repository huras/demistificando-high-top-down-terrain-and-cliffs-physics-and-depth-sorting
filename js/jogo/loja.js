/** Balcão do Poké Mart: abas, categorias e quantidade. */

import {
  BOLAS,
  BERRIES,
  ESTOQUE_LOJA,
  MATERIAIS,
  REMEDIOS,
  TIPO_ITEM,
  defItem,
  precoCompra,
  precoVenda,
} from "../wild/catalogo.js";
import { estado, contar } from "./estado.js";
import { htmlIcone } from "./icones.js";

const CATEGORIAS = Object.freeze([
  ["tudo", "Tudo"],
  [TIPO_ITEM.BOLA, "Bolas"],
  [TIPO_ITEM.REMEDIO, "Remédios"],
  [TIPO_ITEM.BERRY, "Berries"],
  [TIPO_ITEM.MATERIAL, "Materiais"],
  [TIPO_ITEM.CHAVE, "Chave"],
]);

export function lojaAtual() {
  if (!estado.loja) estado.loja = { aba: "comprar", cat: "tudo", qtd: 1 };
  estado.loja.qtd = Math.max(1, Math.min(99, estado.loja.qtd | 0));
  return estado.loja;
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

function itensVendaveis(cat) {
  const lista = [];
  const grupos = [
    [BOLAS, TIPO_ITEM.BOLA],
    [BERRIES, TIPO_ITEM.BERRY],
    [REMEDIOS, TIPO_ITEM.REMEDIO],
    [MATERIAIS, TIPO_ITEM.MATERIAL],
  ];
  for (let g = 0; g < grupos.length; g++) {
    const obj = grupos[g][0];
    const tipo = grupos[g][1];
    if (cat !== "tudo" && cat !== tipo) continue;
    const chaves = Object.keys(obj);
    for (let i = 0; i < chaves.length; i++) {
      const key = chaves[i];
      const qtd = contar(tipo, key);
      const venda = precoVenda(tipo, key);
      if (qtd > 0 && venda > 0) lista.push({ tipo, key, nome: obj[key].nome, qtd, preco: venda });
    }
  }
  return lista;
}

function itensCompra(cat) {
  const lista = [];
  for (let i = 0; i < ESTOQUE_LOJA.length; i++) {
    const e = ESTOQUE_LOJA[i];
    if (cat !== "tudo" && cat !== e.tipo) continue;
    const def = defItem(e.tipo, e.key);
    const preco = precoCompra(e.tipo, e.key);
    if (!def || preco < 0) continue;
    lista.push({ tipo: e.tipo, key: e.key, nome: def.nome, preco });
  }
  return lista;
}

function maximo(item, aba) {
  if (aba === "vender") return Math.max(1, Math.min(99, item.qtd || 1));
  if (!(item.preco > 0)) return 99;
  return Math.max(1, Math.min(99, Math.floor(estado.dinheiro / item.preco)));
}

export function htmlLoja() {
  const loja = lojaAtual();
  const compra = loja.aba !== "vender";
  const itens = compra ? itensCompra(loja.cat) : itensVendaveis(loja.cat);
  const cats = CATEGORIAS.map(([id, rotulo]) => {
    return `<button type="button" data-act="cat-loja" data-cat="${id}" class="${loja.cat === id ? "is-on" : ""}">${rotulo}</button>`;
  }).join("");
  const linhas = itens.length
    ? itens
        .map((item) => {
          const topo = maximo(item, loja.aba);
          return `<div class="jogo-item loja-linha">${htmlIcone(item.key, "jogo-item__icone")}<span>${esc(item.nome)}</span><span>¥${item.preco}</span><button type="button" data-act="${compra ? "comprar" : "vender"}" data-tipo="${item.tipo}" data-key="${item.key}" data-max="${topo}">${compra ? "Comprar" : "Vender"}</button></div>`;
        })
        .join("")
    : `<p>${compra ? "Nada nessa categoria." : "Nada para vender."}</p>`;
  return `<header class="jogo-topo"><h2>Poké Mart</h2><button type="button" data-act="fechar">Fechar</button></header>
    <p class="jogo-dinheiro">¥ ${estado.dinheiro}</p>
    <div class="loja-abas">
      <button type="button" data-act="aba-loja" data-aba="comprar" class="${compra ? "is-on" : ""}">Comprar</button>
      <button type="button" data-act="aba-loja" data-aba="vender" class="${compra ? "" : "is-on"}">Vender</button>
    </div>
    <div class="jogo-cats">${cats}</div>
    <div class="loja-qtd">
      <span>Quantidade <b data-loja-qtd>${loja.qtd}</b></span>
      <button type="button" data-act="qtd-loja" data-delta="1">+1</button>
      <button type="button" data-act="qtd-loja" data-delta="10">+10</button>
      <button type="button" data-act="qtd-loja" data-delta="max">Máx</button>
      <button type="button" data-act="qtd-loja" data-delta="-1">−1</button>
    </div>
    <div class="jogo-grade">${linhas}</div>`;
}

export function tratarLoja(act, btn) {
  const loja = lojaAtual();
  if (act === "aba-loja") {
    loja.aba = btn.dataset.aba === "vender" ? "vender" : "comprar";
    loja.qtd = 1;
    return true;
  }
  if (act === "cat-loja") {
    loja.cat = btn.dataset.cat || "tudo";
    return true;
  }
  if (act === "qtd-loja") {
    const delta = btn.dataset.delta;
    if (delta === "max") loja.qtd = 99;
    else loja.qtd = Math.max(1, Math.min(99, loja.qtd + (Number(delta) || 0)));
    return true;
  }
  return false;
}

export function quantidadeLoja(btn) {
  const loja = lojaAtual();
  const teto = Number(btn?.dataset.max);
  if (teto > 0) return Math.max(1, Math.min(loja.qtd, teto));
  return loja.qtd;
}
