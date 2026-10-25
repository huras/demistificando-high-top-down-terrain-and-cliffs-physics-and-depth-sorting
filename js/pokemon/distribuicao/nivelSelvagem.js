/**
 * Portões de nível selvagem — paridade Pokemon AI (minWildLevel / canWildSpawnAtLevel).
 * nivelMin é assado no catálogo (extrairCatalogo).
 */
import { especie } from "../dados.js";

export function nivelMinSelvagem(chave) {
  const n = especie(chave)?.nivelMin;
  return Number.isFinite(n) && n > 0 ? n | 0 : 1;
}

export function podeSpawnarNoNivel(chave, nivel) {
  const lv = Math.max(1, nivel | 0);
  return lv >= nivelMinSelvagem(chave);
}

/**
 * Filtra chaves elegíveis no nível (preserva ordem).
 * @param {string[]} lista
 * @param {number} nivel
 */
export function filtrarPorNivel(lista, nivel) {
  const saida = [];
  for (let i = 0; i < lista.length; i++) {
    const k = lista[i];
    if (especie(k) && podeSpawnarNoNivel(k, nivel)) saida.push(k);
  }
  return saida;
}
