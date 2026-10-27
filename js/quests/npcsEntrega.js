/**
 * NPCs outdoor elegíveis para missões de entrega.
 */

import { listarCivisCidade } from "../npc/index.js";
import { QUEST_TYPE } from "./tipos.js";

/**
 * @param {string} cityId
 * @returns {object[]}
 */
export function npcsEntregaDaCidade(cityId) {
  if (!cityId) return [];
  const civis = listarCivisCidade();
  const out = [];
  for (let i = 0; i < civis.length; i++) {
    const n = civis[i];
    if (n.cidadeKey !== cityId) continue;
    if (!n.houseId) continue;
    out.push(n);
  }
  return out;
}

/**
 * @param {object[]} taken
 * @returns {Map<string, Set<string>>}
 */
export function npcsOcupadosPorCidade(taken = []) {
  const mapa = new Map();
  for (let i = 0; i < taken.length; i++) {
    const p = taken[i].posting ?? taken[i];
    if (p?.type !== QUEST_TYPE.MATERIAL_DELIVERY || !p.cityId || !p.npcId) continue;
    let set = mapa.get(p.cityId);
    if (!set) {
      set = new Set();
      mapa.set(p.cityId, set);
    }
    set.add(p.npcId);
  }
  return mapa;
}

/**
 * Match NPC falante ↔ posting de entrega.
 * @param {object} npc
 * @param {object} posting
 */
export function npcCasaComEntrega(npc, posting) {
  if (!npc || !posting || posting.type !== QUEST_TYPE.MATERIAL_DELIVERY) return false;
  if (posting.npcId && npc.id === posting.npcId) return true;
  if (posting.houseId && npc.houseId === posting.houseId) return true;
  return false;
}
