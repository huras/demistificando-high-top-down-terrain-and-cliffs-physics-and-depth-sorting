/** Texto curto de efeito/dica para HUD (bag wheel, etc.). */

import { defItem, TIPO_ITEM } from "../wild/catalogo.js";

const STATUS = Object.freeze({
  paralysis: "paralisia",
  sleep: "sono",
  poison: "envenenamento",
  burn: "queimadura",
  freeze: "congelamento",
  confusion: "confusão",
  all: "todos os status",
});

function partesEfeito(efeito) {
  if (!efeito) return [];
  const partes = [];
  if (efeito.curaHp) partes.push(`Recupera ${efeito.curaHp} de HP`);
  if (efeito.curaFrac) {
    const pct = Math.round(Number(efeito.curaFrac) * 100);
    partes.push(`Recupera ${pct}% do HP`);
  }
  if (efeito.pp) partes.push(`Recupera ${efeito.pp} PP`);
  if (efeito.reviver != null) {
    const pct = Math.round(Number(efeito.reviver) * 100);
    partes.push(`Revive com ${pct}% do HP`);
  }
  if (efeito.cura) {
    const nome = STATUS[efeito.cura] || efeito.cura;
    partes.push(`Cura ${nome}`);
  }
  return partes;
}

/**
 * @param {string} tipo
 * @param {string} key
 * @returns {string}
 */
export function descricaoItem(tipo, key) {
  const def = defItem(tipo, key);
  if (!def) return "";
  if (def.dica) return def.dica;
  const partes = partesEfeito(def.efeito);
  if (partes.length) return partes.join(" · ");
  if (tipo === TIPO_ITEM.BERRY && def.plantavel) return "Berry plantável.";
  if (tipo === TIPO_ITEM.BLOCO) return "Bloco para construção.";
  return "";
}
