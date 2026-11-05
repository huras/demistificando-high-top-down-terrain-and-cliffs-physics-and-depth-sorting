/** Equip de held item e berries de auto-cura na party. */

import { BERRIES, HOLD_ITEMS, TIPO_ITEM } from "../wild/catalogo.js";
import { ajustarItem, contarItem, listaParty } from "./party.js";

export function berryPodeAutoHeal(key) {
  const efeito = BERRIES[key]?.efeito;
  return !!(efeito && (efeito.curaHp || efeito.curaFrac) && !efeito.cura);
}

export function berryPodeAutoCure(key) {
  const efeito = BERRIES[key]?.efeito;
  return !!(efeito?.cura);
}

export function equiparHold(indice, key, opts = {}) {
  const party = listaParty();
  const ator = party[indice];
  if (!ator || !HOLD_ITEMS[key]) return false;
  if (ator.heldItemKey === key) return true;

  const from = opts.fromHolderIndex;
  if (from != null) {
    const doador = party[from];
    if (!doador || from === indice || doador.heldItemKey !== key) return false;
    if (ator.heldItemKey) {
      ajustarItem(ator.heldItemKey, 1, "mudo");
      ator.heldItemKey = null;
      ator.itemSegurado = null;
    }
    doador.heldItemKey = null;
    doador.itemSegurado = null;
    ator.heldItemKey = key;
    ator.itemSegurado = key;
    return true;
  }

  if (ator.heldItemKey) {
    ajustarItem(ator.heldItemKey, 1, "mudo");
    ator.heldItemKey = null;
    ator.itemSegurado = null;
  }
  if (contarItem(key) <= 0) {
    const doadorIdx = party.findIndex(
      (m, i) => i !== indice && m?.heldItemKey === key,
    );
    if (doadorIdx < 0) return false;
    return equiparHold(indice, key, { fromHolderIndex: doadorIdx });
  }
  ajustarItem(key, -1, "mudo");
  ator.heldItemKey = key;
  ator.itemSegurado = key;
  return true;
}

export function desequiparHold(indice) {
  const ator = listaParty()[indice];
  if (!ator?.heldItemKey) return false;
  ajustarItem(ator.heldItemKey, 1, "mudo");
  ator.heldItemKey = null;
  ator.itemSegurado = null;
  return true;
}

export function equiparAutoHeal(indice, key) {
  const ator = listaParty()[indice];
  if (!ator || !berryPodeAutoHeal(key) || contarItem(key) <= 0) return false;
  ator.autoHealBerryKey = key;
  return true;
}

export function desequiparAutoHeal(indice) {
  const ator = listaParty()[indice];
  if (!ator?.autoHealBerryKey) return false;
  ator.autoHealBerryKey = null;
  return true;
}

export function equiparAutoCure(indice, key) {
  const ator = listaParty()[indice];
  if (!ator || !berryPodeAutoCure(key) || contarItem(key) <= 0) return false;
  ator.autoCureBerryKey = key;
  return true;
}

export function desequiparAutoCure(indice) {
  const ator = listaParty()[indice];
  if (!ator?.autoCureBerryKey) return false;
  ator.autoCureBerryKey = null;
  return true;
}

export function listarEquipaveis(indiceAtual) {
  /** @type {Array<{ kind: string, key: string, count: number, heldBy?: { index: number, nome: string } }>} */
  const out = [];
  const seen = new Set();
  const party = listaParty();

  for (const key of Object.keys(HOLD_ITEMS)) {
    const n = contarItem(key);
    if (n <= 0) continue;
    seen.add(`hold:${key}`);
    out.push({ kind: "hold", key, count: n });
  }
  for (const key of Object.keys(BERRIES)) {
    const n = contarItem(key);
    if (n <= 0) continue;
    if (berryPodeAutoHeal(key)) {
      const sig = `autoHeal:${key}`;
      if (!seen.has(sig)) {
        seen.add(sig);
        out.push({ kind: "autoHeal", key, count: n });
      }
    }
    if (berryPodeAutoCure(key)) {
      const sig = `autoCure:${key}`;
      if (!seen.has(sig)) {
        seen.add(sig);
        out.push({ kind: "autoCure", key, count: n });
      }
    }
  }

  for (let i = 0; i < party.length; i++) {
    if (i === indiceAtual) continue;
    const mon = party[i];
    if (!mon) continue;
    const nome = mon.especie?.nome || mon.especie?.name || mon.especie?.key || `Pokémon ${i + 1}`;
    if (mon.heldItemKey) {
      out.push({
        kind: "hold",
        key: mon.heldItemKey,
        count: 1,
        heldBy: { index: i, nome },
      });
    }
  }
  return out;
}

export { TIPO_ITEM };
