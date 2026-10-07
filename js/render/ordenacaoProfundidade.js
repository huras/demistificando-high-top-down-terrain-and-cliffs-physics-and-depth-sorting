import { EPS_SORT } from "../config.js";

/**
 * sortKey = y + z·ε
 * Maior sortKey desenha por cima (na frente da câmera).
 */
export function chaveProfundidade(y, z = 0) {
  return y + z * EPS_SORT;
}

/**
 * Topo ancora perto do SUL da célula (cy+0.97).
 * Assim o terraço oclui quem está ao lado (mesma faixa de Y) —
 * o lip sul sozinho não cobre esquerda/direita.
 * Entidades usam chaveEntidade pra não ficarem sob o próprio chão.
 */
export function chaveTopo(cy, z) {
  return chaveProfundidade(cy + 0.97, z);
}

/**
 * Face sul / laterais: lip sul da célula (cy+0.99).
 * Norte = atrás; sul no chão baixo = na frente.
 */
export function chaveFaceSul(cy, _queda, z) {
  return chaveProfundidade(cy + 0.99, z);
}

export function chaveFaceLateral(cy, z) {
  return chaveProfundidade(cy + 0.99, z);
}

/**
 * Entidade: Y real, mas nunca atrás do topo da célula onde os pés estão.
 */
export function chaveEntidade(y, z = 0) {
  const cy = Math.floor(y);
  const ySort = Math.max(y, cy + 0.971);
  return chaveProfundidade(ySort, z);
}

export function criarListaProfundidade() {
  return { itens: [] };
}

export function limparLista(lista) {
  lista.itens.length = 0;
}

export function empilhar(lista, sortKey, camada, desenhar, tie = 0, z = 0) {
  lista.itens.push({ sortKey, camada, tie, z, desenhar });
}

export function desenharLista(lista, ctx) {
  const arr = lista.itens;
  // z desempata: terreno mais alto na frente de quem está mais baixo na mesma faixa
  arr.sort(
    (a, b) =>
      a.camada - b.camada ||
      a.sortKey - b.sortKey ||
      a.z - b.z ||
      a.tie - b.tie,
  );
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < arr.length; i++) arr[i].desenhar(ctx);
}
