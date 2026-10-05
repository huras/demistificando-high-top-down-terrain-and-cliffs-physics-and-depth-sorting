import { EPS_SORT } from "../config.js";

/**
 * sortKey = y + z·ε
 * Maior sortKey desenha por cima (na frente da câmera).
 */
export function chaveProfundidade(y, z = 0) {
  return y + z * EPS_SORT;
}

export function criarListaProfundidade() {
  return { itens: [] };
}

export function limparLista(lista) {
  lista.itens.length = 0;
}

export function empilhar(lista, sortKey, camada, desenhar, tie = 0) {
  lista.itens.push({ sortKey, camada, tie, desenhar });
}

export function desenharLista(lista, ctx) {
  const arr = lista.itens;
  arr.sort((a, b) => a.camada - b.camada || a.sortKey - b.sortKey || a.tie - b.tie);
  for (let i = 0; i < arr.length; i++) arr[i].desenhar(ctx);
}
