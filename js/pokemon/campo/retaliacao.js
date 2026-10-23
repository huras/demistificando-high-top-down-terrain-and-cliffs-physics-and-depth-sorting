/**
 * Retaliação / investigação de tiro ranged (party).
 * Hit → se não está no alvo, corre à origem do tiro → acha quem atirou → luta.
 */
import { POKEMON } from "../../config.js";
import { definirEmocao, EMOCAO } from "../emocoes.js";
import { saoInimigos } from "../faccao.js";

const INVESTIGAR_SEG = 10;
const CHEGOU = 1.35;
const ACHAR_RAIO = 4.5;

function vivo(a) {
  return a && !a.morto && !a.capturado && (a.hp == null || a.hp > 0);
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function inimigoDe(vitima, atacante) {
  if (!vivo(vitima) || !vivo(atacante)) return false;
  return saoInimigos(vitima, atacante);
}

/** Marca quem bateu (melee ou ranged). */
export function marcarAtacante(vitima, atacante) {
  if (!inimigoDe(vitima, atacante)) return;
  vitima.pendenteAtacante = atacante;
  if (vitima.faccao === "party") {
    vitima.retaliacaoAlvo = atacante;
  }
}

/**
 * Tiro ranged: investiga a origem se o mon ainda não está nesse alvo.
 * @param {object} [origem] { x, y, z } — base do projetil; senão usa pé do atacante
 */
export function marcarTiroRanged(vitima, atacante, origem) {
  if (!inimigoDe(vitima, atacante)) return;
  marcarAtacante(vitima, atacante);

  if (vitima.faccao !== "party") return;

  const jaNoAlvo = vitima.alvo === atacante || vitima.ordemAlvo === atacante;
  if (jaNoAlvo) return;

  const ox = origem?.x ?? atacante.x;
  const oy = origem?.y ?? atacante.y;
  const oz = origem?.z ?? atacante.elevacao ?? atacante.z ?? 0;

  vitima.investigarTiro = {
    x: ox,
    y: oy,
    z: oz,
    ate: INVESTIGAR_SEG,
    suspeito: atacante,
  };
  definirEmocao(vitima, EMOCAO.EXCLAMACAO, { duracao: 1.1 });
}

export function limparInvestigacao(mon) {
  if (mon) mon.investigarTiro = null;
}

export function limparRetaliacao(mon) {
  if (!mon) return;
  mon.retaliacaoAlvo = null;
  mon.pendenteAtacante = null;
  limparInvestigacao(mon);
}

/** Alvo sticky de retaliação (vale mesmo em FOLLOW). */
export function alvoRetaliacao(mon) {
  if (!vivo(mon)) return null;

  if (vivo(mon.pendenteAtacante) && inimigoDe(mon, mon.pendenteAtacante)) {
    mon.retaliacaoAlvo = mon.pendenteAtacante;
    mon.pendenteAtacante = null;
  }

  const r = mon.retaliacaoAlvo;
  if (!vivo(r) || !inimigoDe(mon, r)) {
    mon.retaliacaoAlvo = null;
    return null;
  }

  const leash = POKEMON.RAIO_SOLTA * 1.35;
  if (dist2(mon, r) > leash * leash) {
    mon.retaliacaoAlvo = null;
    return null;
  }
  return r;
}

/**
 * Ainda precisa ir à origem do tiro antes de engajar o suspeito.
 * @returns {object|null} ponto {x,y,z} ou null se já pode lutar / expirou
 */
export function pontoInvestigacao(mon) {
  const inv = mon?.investigarTiro;
  if (!inv) return null;
  if ((inv.ate || 0) <= 0) {
    limparInvestigacao(mon);
    return null;
  }

  // Já chegou perto da origem — tenta achar quem atirou.
  if (dist2(mon, inv) <= CHEGOU * CHEGOU) {
    const achado = acharSuspeito(mon, inv);
    if (achado) {
      mon.retaliacaoAlvo = achado;
      mon.alvo = achado;
      mon.modo = "agro";
      limparInvestigacao(mon);
      definirEmocao(mon, EMOCAO.RAIVA, { duracao: 1.0 });
      return null;
    }
    limparInvestigacao(mon);
    return null;
  }

  // Suspeito já à vista (perto): pula investigação e luta.
  if (vivo(inv.suspeito) && dist2(mon, inv.suspeito) < ACHAR_RAIO * ACHAR_RAIO) {
    mon.retaliacaoAlvo = inv.suspeito;
    limparInvestigacao(mon);
    return null;
  }

  return inv;
}

function acharSuspeito(mon, inv) {
  if (vivo(inv.suspeito) && dist2(inv, inv.suspeito) <= ACHAR_RAIO * ACHAR_RAIO) {
    return inv.suspeito;
  }
  return null;
}

export function tickInvestigacao(mon, dt) {
  const inv = mon?.investigarTiro;
  if (!inv) return;
  inv.ate = (inv.ate || 0) - dt;
  if (inv.ate <= 0) limparInvestigacao(mon);
}
