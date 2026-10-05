import { EPS_SORT } from "../config.js";

/**
 * sortKey = y + z·ε
 * Maior sortKey desenha por cima (na frente da câmera).
 */
export function chaveProfundidade(y, z = 0) {
  return y + z * EPS_SORT;
}

/** Topo da célula — atrás da face da mesma célula. */
export function chaveTopo(cy, z) {
  return chaveProfundidade(cy + 0.9, z);
}

/**
 * Face sul: ancora no lip sul da célula alta (cy+0.99).
 * Norte (y menor) = atrás; sul no chão baixo (y > cy+1) = na frente.
 */
export function chaveFaceSul(cy, _queda, z) {
  return chaveProfundidade(cy + 0.99, z);
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
