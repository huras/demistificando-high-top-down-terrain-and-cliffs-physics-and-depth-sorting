/** Precisão da segunda à quarta geração. Sem comando de esquiva. */

import { calcularDano, efetividade } from "../tipos.js";
import { imuneAStatus } from "./status.js";

/** Estágio −6..+6. Positivo (3+n)/3, negativo 3/(3−n). */
export function multiplicadorPrecisao(estagio) {
  const e = Math.max(-6, Math.min(6, estagio | 0));
  if (e >= 0) return (3 + e) / 3;
  return 3 / (3 - e);
}

/** 101 = acerta sempre. 0 = erra sempre. */
export function chanceAcerto(atacante, alvo, def) {
  const base = Number(def?.acerto);
  if (!Number.isFinite(base) || base > 100) return 101;
  if (base <= 0) return 0;
  const acc = multiplicadorPrecisao(atacante?.estagioPrecisao || 0);
  const eva = multiplicadorPrecisao(alvo?.estagioEvasao || 0);
  return Math.max(0, Math.min(100, (base * acc) / eva));
}

export function acertaClassico(atacante, alvo, def, rng = Math.random) {
  const chance = chanceAcerto(atacante, alvo, def);
  if (chance > 100) return true;
  if (chance <= 0) return false;
  return Math.floor(rng() * 100) + 1 <= chance;
}

/** Tira acerto e dano antes da cena. A animação só mostra isto. */
export function resolverTurno(atacante, alvo, def, rng = Math.random) {
  const comum = { alvo, dano: 0, efet: 0, crit: false };
  if (!acertaClassico(atacante, alvo, def, rng)) {
    return { ...comum, acertou: false, imune: false };
  }
  if ((def?.poder || 0) <= 0) return { ...comum, acertou: true, imune: false };
  const { dano, efet, crit } = calcularDano(
    atacante,
    alvo,
    def.poder || 0,
    def.tipo,
    def.categoria
  );
  if (efet === 0 || dano <= 0) return { ...comum, acertou: false, imune: true };
  return { ...comum, acertou: true, imune: false, dano, efet, crit: !!crit };
}

const CAMPO_ESTAGIO = {
  atk: "estagioAtk",
  def: "estagioDef",
  spa: "estagioSpa",
  spd: "estagioSpd",
  spe: "estagioSpe",
  accuracy: "estagioPrecisao",
  evasion: "estagioEvasao",
};

function notaStatus(def, alvo) {
  let nota = 0;
  if (def?.debuff?.stat) {
    const campo = CAMPO_ESTAGIO[def.debuff.stat];
    const quem = def.debuff.target === "self" ? null : alvo;
    const atual = quem ? quem[campo] || 0 : 0;
    const delta = def.debuff.delta | 0;
    if (delta < 0) {
      if (atual > -6) nota = Math.max(nota, 28 * Math.abs(delta) * (1 + Math.max(0, atual) / 6));
    } else if (delta > 0) {
      nota = Math.max(nota, 22 * delta);
    }
  }
  const ail = def?.ailment?.id;
  if (ail && alvo && !alvo.status && !imuneAStatus(alvo, ail, def)) {
    const peso =
      ail === "sleep" ? 48 : ail === "freeze" ? 42 : ail === "paralysis" ? 38 : ail === "burn" ? 36 : 35;
    nota = Math.max(nota, peso);
  }
  return nota;
}

export function notaGolpeTurno(def, alvo) {
  const base = Number(def?.acerto);
  const prec = !Number.isFinite(base) || base > 100 ? 100 : Math.max(0, base);
  if ((def?.poder || 0) <= 0) return notaStatus(def, alvo) * (prec / 100);
  const efet = efetividade(def?.tipo, alvo?.tipos || []);
  return (def?.poder || 0) * efet * (prec / 100);
}
