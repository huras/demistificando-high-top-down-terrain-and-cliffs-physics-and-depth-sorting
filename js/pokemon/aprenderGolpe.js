/**
 * Regras de aprendizado de golpe no level-up (sem DOM).
 */

import { golpe } from "./dados.js";
import { sincronizarPpTipos } from "./pp.js";

export const SLOTS_GOLPE = 4;

/** @param {object | null | undefined} especie */
/** @param {number} nivel */
export function golpesNoNivel(especie, nivel) {
  const lista = especie?.learnset || [];
  const n = nivel | 0;
  const out = [];
  const vistos = new Set();
  for (let i = 0; i < lista.length; i++) {
    if ((lista[i][0] | 0) !== n) continue;
    const chave = lista[i][1];
    if (!chave || vistos.has(chave) || !golpe(chave)) continue;
    vistos.add(chave);
    out.push(chave);
  }
  return out;
}

export function chaveDoSlot(slot) {
  return slot?.chave || slot?.def?.key || null;
}

export function jaSabe(ator, chave) {
  if (!ator || !chave) return false;
  const golpes = ator.golpes || [];
  for (let i = 0; i < golpes.length; i++) {
    if (chaveDoSlot(golpes[i]) === chave) return true;
  }
  return false;
}

export function slotsOcupados(ator) {
  return (ator?.golpes || []).length | 0;
}

export function temSlotLivre(ator) {
  return slotsOcupados(ator) < SLOTS_GOLPE;
}

function montarSlot(chave, velho) {
  const def = golpe(chave);
  if (!def) return null;
  return {
    chave: def.key,
    cd: velho?.cd || 0,
    def,
    pp: velho?.pp,
  };
}

/** @returns {boolean} */
export function adicionarGolpe(ator, chave) {
  if (!ator || !chave || jaSabe(ator, chave) || !temSlotLivre(ator)) return false;
  const slot = montarSlot(chave, null);
  if (!slot) return false;
  if (!Array.isArray(ator.golpes)) ator.golpes = [];
  ator.golpes.push(slot);
  sincronizarPpTipos(ator);
  return true;
}

/**
 * Troca o slot `indice` pelo golpe novo.
 * @returns {boolean}
 */
export function substituirGolpe(ator, indice, chave) {
  if (!ator || !chave || jaSabe(ator, chave)) return false;
  const i = indice | 0;
  if (i < 0 || i >= SLOTS_GOLPE) return false;
  if (!Array.isArray(ator.golpes) || i >= ator.golpes.length) return false;
  const slot = montarSlot(chave, null);
  if (!slot) return false;
  ator.golpes[i] = slot;
  sincronizarPpTipos(ator);
  return true;
}
