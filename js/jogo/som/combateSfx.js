/**
 * Stingers de combate (hit / SE / miss / faint / cura).
 * Espacial no alvo com pan leve — mesmo critério do Pokemon AI.
 */

import { definirOuvinte, tocar, tocarEm } from "./barramento.js";

const RAIO = 36;
const REF_DIST = 10;
const PAN_SPREAD = 0.38;

/** @type {WeakMap<object, Record<string, number>>} */
const ultimoPorAlvo = new WeakMap();

function limitar(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

/**
 * @param {string} id
 * @param {{ x?: number, y?: number } | null} alvo
 * @param {number} volume
 * @param {number} gapMs
 */
function tocarCue(id, alvo, volume, gapMs) {
  const agora = performance.now();
  if (alvo && typeof alvo === "object") {
    let stamps = ultimoPorAlvo.get(alvo);
    if (!stamps) {
      stamps = {};
      ultimoPorAlvo.set(alvo, stamps);
    }
    if (agora - (stamps[id] ?? 0) < gapMs) return;
    stamps[id] = agora;
  }

  const x = alvo?.x;
  const y = alvo?.y;
  if (Number.isFinite(x) && Number.isFinite(y)) {
    tocarEm(id, {
      x,
      y,
      volume,
      alcance: RAIO,
      refDistance: REF_DIST,
      espalha: PAN_SPREAD,
      modelo: "linear",
      rolloff: 0.42,
    });
    return;
  }
  tocar(id, { volume });
}

/**
 * @param {{ x?: number, y?: number } | null} alvo
 * @param {number} efet
 * @param {{ dano?: number, basico?: boolean }} [hit]
 */
export function tocarAcerto(alvo, efet, hit = {}) {
  if (!(hit.dano > 0)) return;
  const eff = Number(efet);
  if (!Number.isFinite(eff) || eff <= 0) return;

  const basico = !!hit.basico;
  const superEff = !basico && eff > 1;
  const id = superEff ? "hitSuper" : "hit";
  const volume = superEff ? 1 : basico ? 0.88 : eff < 1 ? 0.78 : 0.92;
  tocarCue(id, alvo, volume, superEff ? 90 : 28);
}

/** Miss / empty swing. */
export function tocarErro(alvo = null) {
  tocarCue("hitErro", alvo, 0.92, 70);
}

/** KO / faint. */
export function tocarNocaute(alvo = null) {
  tocarCue("nocaute", alvo, 0.95, 120);
}

/** Potion / berry / Recover / heal machine. */
export function tocarCura(alvo = null) {
  tocarCue("cura", alvo, 1, 80);
}

/** Mantém o ouvinte alinhado ao jogador (opcional — passos já fazem). */
export function alinharOuvinteCombate(x, y) {
  definirOuvinte(x, y);
}
