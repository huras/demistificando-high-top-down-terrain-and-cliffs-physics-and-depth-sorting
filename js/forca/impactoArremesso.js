/**
 * Impacto de arremesso Força: dano + Hurt + knockback por peso.
 * Query espacial (atoresPerto) — paridade flecha; sem scan linear de selvagens.
 */
import { atoresPerto } from "../pokemon/grade.js";
import { aplicarDanoLivre } from "../pokemon/combate/executor.js";
import { efeitosPokemon, relogioPokemon } from "../pokemon/sistema.js";
import { pesoDoPokemon } from "./alvos.js";
import { normalizarPeso, PESO_MIN } from "./pesoCarga.js";

const HIT_PAD = 0.42;
const HIT_DZ = 2.2;
const ROLL_HIT_SPEED = 1.2;
const PROXY_STATS = Object.freeze({
  level: 20,
  atk: 45,
  def: 45,
  spa: 45,
  spd: 45,
  spe: 45,
});

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/**
 * @param {object} thrown
 * @param {object} alvo
 * @param {number} poderBase
 */
export function poderDoImpacto(thrown, alvo, poderBase = 35) {
  const wT = normalizarPeso(thrown?.weightTier, PESO_MIN);
  const wA = Math.max(1, pesoDoPokemon(alvo) || PESO_MIN);
  const ratio = wT / wA;
  const carga = clamp(Number(thrown?.launchPower) || 0, 0, 1);
  const base = Math.max(1, Number(poderBase) || 35);
  return (
    base *
    (0.55 + 0.35 * wT) *
    clamp(ratio, 0.45, 1.75) *
    (0.7 + 0.3 * carga)
  );
}

/**
 * @param {object} thrown
 */
function raioHit(thrown) {
  return (
    Math.max(0.35, thrown.halfW ?? thrown.carry?.halfW ?? 0.45, thrown.carry?.enemy?.r ?? 0) +
    HIT_PAD
  );
}

/**
 * @param {object} thrown
 * @returns {object}
 */
function atacanteDoThrow(thrown) {
  const thrower = thrown.thrower;
  if (thrower?.stats) return thrower;
  const spd = Math.hypot(thrown.vx || 0, thrown.vy || 0) || 1;
  const back = 0.35;
  return {
    tipos: ["normal"],
    stats: PROXY_STATS,
    faccao: "player",
    x: thrown.x - ((thrown.vx || 0) / spd) * back,
    y: thrown.y - ((thrown.vy || 0) / spd) * back,
    dirX: (thrown.vx || 0) / spd,
    dirY: (thrown.vy || 0) / spd,
  };
}

/**
 * Direção do voo + escala de distância pelo ratio de peso.
 * @param {object} alvo
 * @param {object} thrown
 * @param {number} ratio
 */
function aplicarKnockbackVoo(alvo, thrown, ratio) {
  if (!alvo || !(alvo.recuoRestante > 0)) return;
  let dx = Number(thrown.vx) || 0;
  let dy = Number(thrown.vy) || 0;
  let len = Math.hypot(dx, dy);
  if (len < 0.05) {
    dx = alvo.recuoDirX || 0;
    dy = alvo.recuoDirY || 1;
    len = Math.hypot(dx, dy) || 1;
  }
  alvo.recuoDirX = dx / len;
  alvo.recuoDirY = dy / len;
  const mul = clamp(0.65 + 0.45 * ratio, 0.55, 1.85);
  alvo.recuoDist = (Number(alvo.recuoDist) || 0.7) * mul;
}

/**
 * @param {object} thrown
 * @param {number} [poderBase]
 * @returns {boolean}
 */
export function tentarAcertoArremesso(thrown, poderBase = 35) {
  if (!thrown || thrown.hitDone) return false;
  if (thrown.phase === "roll") {
    if (Math.hypot(thrown.vx || 0, thrown.vy || 0) < ROLL_HIT_SPEED) return false;
  } else if (thrown.phase !== "air") {
    return false;
  }

  const rHit = raioHit(thrown);
  const perto = atoresPerto(thrown.x, thrown.y, rHit + 0.85);
  const exclude = thrown.carry?.enemy;
  let melhor = null;
  let melhorD2 = Infinity;

  for (let i = 0; i < perto.length; i++) {
    const alvo = perto[i];
    if (!alvo || alvo.faccao !== "selvagem") continue;
    if (alvo.morto || alvo.capturado || alvo.forcaCarregado || (alvo.hp ?? 0) <= 0) continue;
    if (alvo === exclude) continue;
    const ar = Math.max(0.3, alvo.r || 0.34);
    const lim = rHit + ar;
    const dx = alvo.x - thrown.x;
    const dy = alvo.y - thrown.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > lim * lim) continue;
    const pe = alvo.elevacao ?? alvo.z ?? 0;
    if (Math.abs((thrown.z ?? pe) - pe) > HIT_DZ) continue;
    if (d2 >= melhorD2) continue;
    melhorD2 = d2;
    melhor = alvo;
  }

  if (!melhor) return false;

  const wT = normalizarPeso(thrown.weightTier, PESO_MIN);
  const wA = Math.max(1, pesoDoPokemon(melhor) || PESO_MIN);
  const ratio = wT / wA;
  const poder = poderDoImpacto(thrown, melhor, poderBase);
  const atacante = atacanteDoThrow(thrown);
  const agora = relogioPokemon();
  const efeitos = efeitosPokemon();

  thrown.hitDone = true;
  try {
    aplicarDanoLivre(atacante, melhor, poder, "normal", "physical", agora, efeitos);
  } catch {
    /* combate opcional */
  }
  aplicarKnockbackVoo(melhor, thrown, ratio);

  thrown.x = melhor.x;
  thrown.y = melhor.y;
  thrown.vx *= 0.35;
  thrown.vy *= 0.35;
  thrown.vz = Math.min(thrown.vz || 0, 0);
  return true;
}

export { ROLL_HIT_SPEED, HIT_PAD };
