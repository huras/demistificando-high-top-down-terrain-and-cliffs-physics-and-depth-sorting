/**
 * Pedra e cristal: um material por ponto de vida. Quebrar tira mais rápido.
 */

import { ajustarItem } from "../pokemon/party.js";
import { sfx } from "../jogo/audio.js";
import { emitirLascas } from "./fx.js";
import { FASE, confirmar, preparar } from "./estadoProps.js";

export function materialDoMineral(prop) {
  if (!prop || prop.tipo !== "cristal") return "stone";
  const id = prop.sprite || "";
  if (id.includes("red")) return "redCrystal";
  if (id.includes("yellow")) return "yellowCrystal";
  if (id.includes("purple")) return "purpleCrystal";
  if (id.includes("green")) return "greenCrystal";
  if (id.includes("pink")) return "pinkCrystal";
  return "blueCrystal";
}

function soltar(prop, antes, agoraHp) {
  let n = Math.floor(antes) - Math.floor(agoraHp);
  if (n <= 0 && agoraHp <= 0 && antes > 0) n = 1;
  if (n <= 0) return 0;
  ajustarItem(materialDoMineral(prop), n);
  return n;
}

/**
 * @returns {"nao"|"acertou"|"pedra"|"cristal"}
 */
export function minerarProp(prop, dano) {
  if (!prop || (prop.tipo !== "pedra" && prop.tipo !== "cristal")) return "nao";
  preparar(prop);
  if (prop.fase === FASE.REMOVIDO || prop.oculto) return "nao";
  const golpe = dano > 0 ? dano : 1;
  if (prop.tipo === "cristal" && golpe > 1) return "nao";
  const antes = prop.hp;
  prop.hp = Math.max(0, prop.hp - golpe);
  soltar(prop, antes, prop.hp);
  emitirLascas(prop.x, prop.y, prop.hp <= 0 ? 10 : 4);
  sfx("cavar");
  if (prop.hp <= 0) {
    prop.fase = FASE.REMOVIDO;
    prop.hp = 0;
    confirmar(prop);
    return prop.tipo === "cristal" ? "cristal" : "pedra";
  }
  confirmar(prop);
  return "acertou";
}
