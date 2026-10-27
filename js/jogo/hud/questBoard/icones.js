/**
 * Ícones pixel do quadro de missões.
 */

import {
  QUEST_BOARD_TAB,
  QUEST_BOARD_TYPE_TAB,
  QUEST_TYPE,
} from "../../../quests/tipos.js";

const BASE = "./assets/ui/quest-board";

export const QUEST_BOARD_ICON = Object.freeze({
  header: `${BASE}/quest.png`,
  pokedollars: `${BASE}/pokedollars.png`,
  status: Object.freeze({
    [QUEST_BOARD_TAB.AVAILABLE]: `${BASE}/quest_available.png`,
    [QUEST_BOARD_TAB.TAKEN]: `${BASE}/quest_accepted.png`,
    [QUEST_BOARD_TAB.COMPLETED]: `${BASE}/flag_32.png`,
  }),
  type: Object.freeze({
    [QUEST_BOARD_TYPE_TAB.ALL]: `${BASE}/quest.png`,
    [QUEST_TYPE.MISSING_PERSON]: `${BASE}/quest_rescue.png`,
    [QUEST_TYPE.MATERIAL_DELIVERY]: `${BASE}/quest_delivery.png`,
  }),
});

export function criarIconeQuadro(src, className = "quest-board-hud__icon", size = 22) {
  const img = document.createElement("img");
  img.className = className;
  img.src = src;
  img.alt = "";
  img.width = size;
  img.height = size;
  img.draggable = false;
  img.decoding = "async";
  img.setAttribute("aria-hidden", "true");
  return img;
}

export function preencherIconeQuadro(host, src, iconKey, opts = {}) {
  if (!host || !src) return;
  if (host.dataset.iconKey === iconKey && host.firstChild) return;
  host.dataset.iconKey = iconKey;
  host.replaceChildren(
    criarIconeQuadro(src, opts.className ?? "quest-board-hud__icon", opts.size ?? 22),
  );
}

export function srcIconeTipoMissao(type) {
  return (
    QUEST_BOARD_ICON.type[type] ??
    QUEST_BOARD_ICON.type[QUEST_TYPE.MISSING_PERSON]
  );
}
