/**
 * One-shots de mundo / party / captura (porta, árvore, bola, level-up…).
 */

import { tocar, tocarEm } from "./barramento.js";

function em(alvo, id, volume = 1) {
  if (alvo && Number.isFinite(alvo.x) && Number.isFinite(alvo.y)) {
    tocarEm(id, { x: alvo.x, y: alvo.y, volume, alcance: 28 });
    return;
  }
  tocar(id, { volume });
}

export function tocarPorta() {
  tocar("porta");
}

export function tocarChopHit(alvo = null) {
  em(alvo, "chopHit", 1);
}

export function tocarChopFell(alvo = null) {
  em(alvo, "chopFell", 1.05);
}

export function tocarItemDrop(alvo = null) {
  em(alvo, "itemDrop", 1);
}

export function tocarBump() {
  tocar("bump", { volume: 0.95 });
}

export function tocarSalvar() {
  tocar("salvar");
}

export function tocarThrow(alvo = null) {
  em(alvo, "throw", 1);
}

export function tocarBallDrop(alvo = null) {
  em(alvo, "ballDrop", 1);
}

export function tocarBallShake(alvo = null) {
  em(alvo, "ballShake", 1);
}

export function tocarChoose() {
  tocar("choose", { volume: 0.9 });
}

export function tocarHotbarEquip() {
  tocar("hotbarEquip");
}

export function tocarHotbarUnequip() {
  tocar("hotbarUnequip");
}

export function tocarPcOpen() {
  tocar("pcOpen");
}

export function tocarPcClose() {
  tocar("pcClose");
}

export function tocarLevelUp(alvo = null) {
  em(alvo, "levelUp", 1.05);
}

export function tocarObtido(alvo = null) {
  em(alvo, "obtido", 1.1);
}
