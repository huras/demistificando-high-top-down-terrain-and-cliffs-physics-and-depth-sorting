/**
 * Pin de missão ativa no mapa mundo.
 */

import { deLocalKanto } from "../mundo/bounds.js";
import { AREA_KANTO } from "../mundo/regiao/grafoKanto.js";
import { listarCivisCidade } from "../npc/index.js";
import { obterQuestNpc } from "./escort.js";
import { objetivoQuadroAtivo } from "./runtime.js";
import { QUEST_TYPE } from "./tipos.js";
import { cidadePorId } from "./cidades.js";

/**
 * @returns {{ x: number, y: number, kind: string, questId: string } | null}
 */
export function pinMissaoAtiva() {
  const rec = objetivoQuadroAtivo();
  if (!rec?.posting) return null;
  const p = rec.posting;

  if (p.type === QUEST_TYPE.MISSING_PERSON) {
    const npc = obterQuestNpc();
    if (npc && (rec.escorting || npc.escorting)) {
      return { x: npc.x, y: npc.y, kind: "escort", questId: p.id };
    }
    if (Number.isFinite(rec.spawnX) && Number.isFinite(rec.spawnY)) {
      return { x: rec.spawnX, y: rec.spawnY, kind: "search", questId: p.id };
    }
    const ax = rec.targetAx ?? p.targetAx;
    const ay = rec.targetAy ?? p.targetAy;
    if (Number.isFinite(ax) && Number.isFinite(ay)) {
      const mid = deLocalKanto(
        ax * AREA_KANTO + AREA_KANTO * 0.5,
        ay * AREA_KANTO + AREA_KANTO * 0.5,
      );
      return { x: mid.x, y: mid.y, kind: "search", questId: p.id };
    }
    return null;
  }

  if (p.type === QUEST_TYPE.MATERIAL_DELIVERY) {
    const civis = listarCivisCidade();
    for (let i = 0; i < civis.length; i++) {
      const n = civis[i];
      if (p.npcId && n.id === p.npcId) {
        return { x: n.x, y: n.y, kind: "delivery", questId: p.id };
      }
      if (p.houseId && n.houseId === p.houseId) {
        return { x: n.x, y: n.y, kind: "delivery", questId: p.id };
      }
    }
    const city = cidadePorId(p.cityId);
    if (city) {
      const mid = deLocalKanto(
        city.ax * AREA_KANTO + AREA_KANTO * 0.5,
        city.ay * AREA_KANTO + AREA_KANTO * 0.5,
      );
      return { x: mid.x, y: mid.y, kind: "delivery", questId: p.id };
    }
  }
  return null;
}
