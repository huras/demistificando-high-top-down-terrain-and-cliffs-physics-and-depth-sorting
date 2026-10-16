/**
 * Habilidade de campo sai do tipo da espécie. O menu só oferece o que o alvo aceita.
 */

import { FASE } from "./estadoProps.js";

export const ACAO = Object.freeze({
  CORTAR: "cortar",
  QUEIMAR: "queimar",
  MINERAR: "minerar",
  QUEBRAR: "quebrar",
});

const LISTA = Object.freeze([
  Object.freeze({ id: ACAO.CORTAR, nome: "Cortar", tipos: Object.freeze(["grass", "bug"]) }),
  Object.freeze({ id: ACAO.QUEIMAR, nome: "Queimar", tipos: Object.freeze(["fire"]) }),
  Object.freeze({ id: ACAO.MINERAR, nome: "Minerar", tipos: Object.freeze(["rock", "ground", "steel"]) }),
  Object.freeze({ id: ACAO.QUEBRAR, nome: "Quebrar", tipos: Object.freeze(["fighting"]) }),
]);

const ESPERA = Object.freeze({
  cortar: 900,
  queimar: 550,
  minerar: 400,
  quebrar: 350,
});

export function esperaDaAcao(id) {
  return ESPERA[id] || 600;
}

export function definicaoAcao(id) {
  for (let i = 0; i < LISTA.length; i++) {
    if (LISTA[i].id === id) return LISTA[i];
  }
  return null;
}

export function capacidadesDe(tipos) {
  const tem = new Set(tipos || []);
  const ids = [];
  for (let i = 0; i < LISTA.length; i++) {
    const acao = LISTA[i];
    for (let t = 0; t < acao.tipos.length; t++) {
      if (!tem.has(acao.tipos[t])) continue;
      ids.push(acao.id);
      break;
    }
  }
  return ids;
}

export function ofertaMenu(id, prop) {
  if (!prop || prop.fase === FASE.REMOVIDO || prop.oculto) return false;
  if (id === ACAO.CORTAR) {
    return prop.tipo === "arvore" && (
      prop.fase === FASE.EM_PE || prop.fase === FASE.CAINDO || prop.fase === FASE.TOCO || prop.fase === FASE.TOCO_QUEIMADO
    );
  }
  if (id === ACAO.QUEIMAR) {
    if (prop.tipo === "grama") return prop.fase === FASE.EM_PE;
    return prop.tipo === "arvore" && (prop.fase === FASE.EM_PE || prop.fase === FASE.TOCO);
  }
  if (id === ACAO.MINERAR) {
    return (prop.tipo === "pedra" || prop.tipo === "cristal") && prop.fase !== FASE.REMOVIDO;
  }
  if (id === ACAO.QUEBRAR) return prop.tipo === "pedra" && prop.fase !== FASE.REMOVIDO;
  return false;
}

/** A ordem de corte segue a queda até o toco. O fogo solta assim que acende. */
export function segueOrdem(id, prop) {
  if (!prop) return false;
  if (id === ACAO.CORTAR && prop.tipo === "arvore" && prop.fase === FASE.CAINDO) return true;
  return ofertaMenu(id, prop);
}

export function acoesDoPokemon(tipos, prop) {
  const caps = capacidadesDe(tipos);
  const saida = [];
  for (let i = 0; i < caps.length; i++) {
    if (!ofertaMenu(caps[i], prop)) continue;
    const def = definicaoAcao(caps[i]);
    if (def) saida.push(def);
  }
  return saida;
}
