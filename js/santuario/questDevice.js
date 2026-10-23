/**
 * Quest da Rina: device → explorar um santuário → reportar.
 */
import { TIPO_ITEM } from "../wild/catalogo.js";
import { darItem, estado, marcarQuest, temChave } from "../jogo/estado.js";
import { estadoSantuario } from "./estadoSantuario.js";

export const ELEMENTAL_SHRINE_DEVICE_KEY = "elementalShrineDevice";

const QUEST_ID = "santuarioDevice";

export function garantirQuestDevice() {
  if (estado.quests.some((q) => q.id === QUEST_ID)) return;
  estado.quests.push({
    id: QUEST_ID,
    titulo: "Santuários elementais",
    texto: "Fale com a Rina no laboratório sobre os santuários.",
    feita: false,
    progresso: 0,
    meta: 1,
  });
}

export function temDeviceSantuario() {
  return temChave(ELEMENTAL_SHRINE_DEVICE_KEY);
}

/**
 * Diálogo / avanço da quest com a Rina.
 * @returns {string[]}
 */
export function falarRinaSantuario() {
  garantirQuestDevice();
  const st = estadoSantuario.questDevice;
  if (st === "idle" || st === "talkRina") {
    estadoSantuario.questDevice = "explore";
    darItem(TIPO_ITEM.CHAVE, ELEMENTAL_SHRINE_DEVICE_KEY, 1);
    const q = estado.quests.find((x) => x.id === QUEST_ID);
    if (q) {
      q.texto = "Encontre um santuário elemental e entre nele.";
      q.progresso = 0;
      q.feita = false;
    }
    return [
      "Os santuários elementais estão espalhados pelo mundo — um para cada espécie.",
      "Leve este dispositivo. Ele aponta para o santuário mais próximo ainda intacto.",
      "Quando entrar em um, volte aqui e me conte.",
    ];
  }
  if (st === "explore") {
    return [
      "Ainda não encontrou um santuário? O dispositivo brilha perto deles.",
      "Monte o retrato na pedra para abrir a entrada.",
    ];
  }
  if (st === "ready") {
    estadoSantuario.questDevice = "done";
    marcarQuest(QUEST_ID);
    const q = estado.quests.find((x) => x.id === QUEST_ID);
    if (q) {
      q.feita = true;
      q.progresso = 1;
      q.texto = "Você explorou um santuário e reportou à Rina.";
    }
    return [
      "Então o totem realmente entrega uma gema…",
      "Obrigada. Continue mapeando os santuários com o dispositivo.",
    ];
  }
  return [
    "Os dados dos santuários estão entrando no cruzamento da Pokédex.",
    "Se achar mais gemas, guarde — podem servir depois.",
  ];
}

export function onShrineEnteredQuest() {
  if (estadoSantuario.questDevice === "explore") {
    estadoSantuario.questDevice = "ready";
    const q = estado.quests.find((x) => x.id === QUEST_ID);
    if (q && !q.feita) {
      q.texto = "Volte ao laboratório e fale com a Rina.";
      q.progresso = 1;
    }
  }
}

export function onShrineClearedQuest() {
  onShrineEnteredQuest();
}
