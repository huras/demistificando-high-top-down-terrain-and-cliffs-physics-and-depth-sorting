/**
 * Textos de posting (título, detalhe, recompensa).
 */

import { t } from "../jogo/i18n.js";
import { nomeDoItem } from "../jogo/nomeItem.js";
import { TIPO_ITEM } from "../wild/catalogo.js";
import { nomeAreaBusca } from "./locaisResgate.js";
import { QUEST_STATUS, QUEST_TYPE } from "./tipos.js";

const FALLBACK_NOME = Object.freeze({
  "dp-char": "Desaparecido",
});

export function nomeNpcResgate(posting) {
  if (!posting) return t("quests.missingNpc.default");
  if (posting.npcNome) return posting.npcNome;
  const key = `quests.missingNpc.${posting.peopleId}`;
  const nome = t(key);
  if (nome && nome !== key) return nome;
  return t("quests.missingNpc.default");
}

export function nomeNpcEntrega(posting) {
  if (posting?.npcNome) return posting.npcNome;
  return t("quests.delivery.npcDefault");
}

export function nomeItemRecompensa(posting) {
  if (posting?.rewardKind === "berry") {
    return nomeDoItem(posting.rewardKey, TIPO_ITEM.BERRY);
  }
  return nomeDoItem(posting.rewardKey, TIPO_ITEM.REMEDIO);
}

export function tituloMissao(posting) {
  if (posting?.type === QUEST_TYPE.MATERIAL_DELIVERY) {
    return t("quests.delivery.title", { name: nomeNpcEntrega(posting) });
  }
  return t("quests.missingPerson.title", { name: nomeNpcResgate(posting) });
}

function areaBusca(posting) {
  return nomeAreaBusca(posting) || t("quests.area.wild");
}

export function detalheMissao(posting, status) {
  if (posting?.type === QUEST_TYPE.MATERIAL_DELIVERY) {
    const vars = {
      name: nomeNpcEntrega(posting),
      city: posting.cityName,
      item: nomeDoItem(posting.materialKey, TIPO_ITEM.MATERIAL),
      count: posting.amount | 0,
    };
    if (status === QUEST_STATUS.COMPLETED) {
      return t("quests.delivery.completed", vars);
    }
    return t("quests.delivery.active", vars);
  }

  const name = nomeNpcResgate(posting);
  const city = posting?.cityName || "";
  if (status === QUEST_STATUS.COMPLETED) {
    return t("quests.missingPerson.completed", { name, city });
  }
  if (status === QUEST_STATUS.ESCORT) {
    return t("quests.missingPerson.escort", { name, city });
  }
  return t("quests.board.searchHint", {
    name,
    area: areaBusca(posting),
  });
}

export function textoRecompensa(posting) {
  const money = posting?.money | 0;
  const item = nomeItemRecompensa(posting);
  if (money > 0 && item) {
    return t("quests.board.rewardBoth", { money, item });
  }
  if (money > 0) return t("quests.board.rewardMoney", { money });
  return item || "";
}

export function textoObjetivoAtivo(rec) {
  if (!rec?.posting) return null;
  const p = rec.posting;
  if (p.type === QUEST_TYPE.MATERIAL_DELIVERY) {
    return t("quests.hud.delivery", {
      count: p.amount | 0,
      item: nomeDoItem(p.materialKey, TIPO_ITEM.MATERIAL),
      name: nomeNpcEntrega(p),
      city: p.cityName,
    });
  }
  if (rec.escorting) {
    return t("quests.hud.escort", {
      name: nomeNpcResgate(p),
      city: p.cityName,
    });
  }
  return t("quests.hud.search", {
    name: nomeNpcResgate(p),
    area: areaBusca(p),
  });
}

void FALLBACK_NOME;
