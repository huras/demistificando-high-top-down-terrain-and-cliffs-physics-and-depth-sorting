/** Dados e regras do Poké Mart (listagens, quantidade, abas). */

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
import { estado, contar, temChave } from "./estado.js";

export const CATEGORIAS_LOJA = Object.freeze([
  ["tudo", "Tudo"],
  [TIPO_ITEM.BOLA, "Bolas"],
  [TIPO_ITEM.REMEDIO, "Remédios"],
  [TIPO_ITEM.BERRY, "Berries"],
  [TIPO_ITEM.MATERIAL, "Materiais"],
  [TIPO_ITEM.CHAVE, "Chave"],
]);

export function lojaAtual() {
  if (!estado.loja) estado.loja = { aba: "comprar", cat: "tudo", qtd: 1, sel: null };
  estado.loja.qtd = Math.max(1, Math.min(99, estado.loja.qtd | 0));
  return estado.loja;
}

export function itensVendaveis(cat) {
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
      if (qtd > 0 && venda > 0) {
        const def = obj[key];
        lista.push({
          tipo,
          key,
          nome: def.nome,
          qtd,
          preco: venda,
          dica: def.dica || "",
          cor: def.cor || "#94a3b8",
        });
      }
    }
  }
  return lista;
}

export function itensCompra(cat) {
  const lista = [];
  for (let i = 0; i < ESTOQUE_LOJA.length; i++) {
    const e = ESTOQUE_LOJA[i];
    if (cat !== "tudo" && cat !== e.tipo) continue;
    const def = defItem(e.tipo, e.key);
    const preco = precoCompra(e.tipo, e.key);
    if (!def || preco < 0) continue;
    if (e.tipo === TIPO_ITEM.CHAVE && def.unica && temChave(e.key)) continue;
    lista.push({
      tipo: e.tipo,
      key: e.key,
      nome: def.nome,
      preco,
      qtd: contar(e.tipo, e.key),
      dica: def.dica || "",
      cor: def.cor || "#94a3b8",
    });
  }
  return lista;
}

export function maximoLoja(item, aba) {
  if (aba === "vender") return Math.max(1, Math.min(99, item.qtd || 1));
  if (!(item.preco > 0)) return 99;
  return Math.max(1, Math.min(99, Math.floor(estado.dinheiro / item.preco)));
}

export function tratarLoja(act, btn) {
  const loja = lojaAtual();
  if (act === "aba-loja") {
    loja.aba = btn.dataset.aba === "vender" ? "vender" : "comprar";
    loja.qtd = 1;
    loja.sel = null;
    return true;
  }
  if (act === "cat-loja") {
    loja.cat = btn.dataset.cat || "tudo";
    loja.sel = null;
    return true;
  }
  if (act === "qtd-loja") {
    const delta = btn.dataset.delta;
    if (delta === "max") loja.qtd = 99;
    else loja.qtd = Math.max(1, Math.min(99, loja.qtd + (Number(delta) || 0)));
    return true;
  }
  if (act === "sel-loja") {
    loja.sel = { tipo: btn.dataset.tipo, key: btn.dataset.key };
    return true;
  }
  return false;
}

export function quantidadeLoja(item) {
  const loja = lojaAtual();
  const teto = maximoLoja(item, loja.aba);
  return Math.max(1, Math.min(loja.qtd, teto));
}

/** @deprecated Painel antigo — a janela dedicada substitui. */
export function htmlLoja() {
  return "";
}
