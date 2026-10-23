/**
 * Gema elemental do totem (one-shot).
 */
import { TIPO_ITEM } from "../wild/catalogo.js";
import { darItem } from "../jogo/estado.js";
import { anunciarGanho } from "../jogo/ganhoItem.js";
import { shrineGemKey } from "./catalogo.js";
import { marcarSantuarioLimpo, santuarioLimpo } from "./estadoSantuario.js";
import { marcarTotemLimpo, santuarioAtivo } from "./interior.js";
import { onShrineClearedQuest } from "./questDevice.js";

export function reclamarTotem() {
  const hub = santuarioAtivo();
  if (!hub?.shrineId) return { ok: false, msg: "Nada acontece." };
  if (santuarioLimpo(hub.shrineId) || hub.cleared) {
    return { ok: false, msg: "O totem já entregou sua gema." };
  }
  const key = shrineGemKey(hub.element);
  const novo = marcarSantuarioLimpo(hub.shrineId, hub.element);
  marcarTotemLimpo();
  if (novo) {
    darItem(TIPO_ITEM.MATERIAL, key, 1);
    anunciarGanho(key, 1);
    onShrineClearedQuest();
  }
  return { ok: true, msg: "A gema elemental brilha na sua bolsa.", key };
}
