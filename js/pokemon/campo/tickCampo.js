/**
 * Orquestra combate OW (ordem Pokemon AI Follower.update).
 */
import { AI_MODE } from "../aiModes.js";
import { emAvanco, emEsquiva, emRecuo, velocidadeDe } from "../ator.js";
import {
  clearMeleeApproach,
  isCombatMotionLocked,
  tickMeleeApproach,
} from "../combate/meleeApproach.js";
import { bolaNoChaoMaisPerto } from "../captura.js";
import { dropMaisPerto } from "../drops.js";
import { irPara, zDePerseguicao } from "../ia/locomocaoCampo.js";
import { escolherAlvoParty, escolherAlvoWild } from "./alvo.js";
import { integrarEngajar } from "./engajar.js";
import { tentarGolpesCampo } from "./golpes.js";
import { modoEfetivo } from "./modos.js";
import {
  limparInvestigacao,
  pontoInvestigacao,
  tickInvestigacao,
} from "./retaliacao.js";
import { alertarPackAgro } from "../pack.js";
import { selvagensAtivos } from "../populacao.js";
import { ehDiurno } from "../distribuicao/noturno.js";
import { obterHora } from "../../render/3d/ceu/controleCeu.js";

const DIST_ITEM = 0.35;

export function ehNoiteOverworld(h = obterHora()) {
  return h >= 20.5 || h < 5;
}

export function acordarSonoNatural(ator) {
  if (!ator) return;
  if (ator.sonoNatural) ator.sonoNatural = false;
  if (ator.status !== "sleep") ator.dormindo = 0;
}

function deitarNoLar(ator) {
  if (ator.casaX != null) ator.x = ator.casaX;
  if (ator.casaY != null) ator.y = ator.casaY;
  if (ator.casaZ != null) {
    ator.z = ator.casaZ;
    ator.elevacao = ator.casaZ;
  }
  ator.vx = 0;
  ator.vy = 0;
  ator.andando = false;
  ator.correndo = false;
  ator.modo = "roam";
  ator.alvo = null;
  ator.sonoNatural = true;
  ator.dormindo = 1;
}

/** Drop de batalha ou bola grounded — o mais perto do mon. */
function coletavelMaisPerto(mon, jogador) {
  const drop = dropMaisPerto(mon, jogador);
  const bola = bolaNoChaoMaisPerto(mon, jogador);
  if (!drop) return bola;
  if (!bola) return drop;
  const dd = (drop.x - mon.x) ** 2 + (drop.y - mon.y) ** 2;
  const db = (bola.x - mon.x) ** 2 + (bola.y - mon.y) ** 2;
  return dd <= db ? drop : bola;
}

function ocupadoCast(ator) {
  return (
    (ator.conjuroRestante || 0) > 0 ||
    (ator.golpeRecRestante || 0) > 0 ||
    emRecuo(ator) ||
    emAvanco(ator) ||
    emEsquiva(ator)
  );
}

function limparAlvoParty(mon) {
  mon.alvo = null;
  if (mon.ordemAlvo && (mon.ordemAlvo.morto || mon.ordemAlvo.capturado)) {
    mon.ordemAlvo = null;
  }
  if (mon.modo === "agro" && !mon.ordemAlvo) mon.modo = "roam";
}

/** Corre até drop ou bola no chão (Pokemon AI itemTarget). */
function perseguirItem(mon, jogador, dt) {
  const alvo = coletavelMaisPerto(mon, jogador);
  if (!alvo) {
    mon.itemAlvo = null;
    return false;
  }
  mon.itemAlvo = alvo;
  const z = alvo.z ?? mon.elevacao ?? mon.z ?? 0;
  mon.correndo = true;
  irPara(mon, alvo.x, alvo.y, z, velocidadeDe(mon, true), dt, DIST_ITEM);
  return true;
}

/**
 * Party: targeting + engajar. Follow fica em atualizarParty quando sem alvo.
 * @returns {boolean} true se está ocupado (luta / STAY / item) — não deve follow
 */
export function tickPartyCampo(mon, selvagens, jogador, dt) {
  if (!mon || mon.morto || mon.capturado || mon.preso) return false;
  if (mon.ordemCampo || mon.ordemForca || mon._forcaCanalLock) return false;

  if (tickMeleeApproach(mon, dt)) return true;
  tickInvestigacao(mon, dt);

  // Tiro ranged sem visão do atirador: corre à origem do tiro.
  const inv = pontoInvestigacao(mon);
  if (inv) {
    mon.itemAlvo = null;
    mon.correndo = true;
    if (!ocupadoCast(mon) && !isCombatMotionLocked(mon)) {
      irPara(mon, inv.x, inv.y, inv.z, velocidadeDe(mon, true), dt, 0.45);
    } else {
      mon.andando = false;
    }
    return true;
  }

  const alvo = escolherAlvoParty(mon, selvagens, jogador);
  if (!alvo) {
    limparAlvoParty(mon);
    const modo = modoEfetivo(mon);
    if (modo === AI_MODE.STAY) {
      mon.vx = 0;
      mon.vy = 0;
      mon.andando = false;
      mon.correndo = false;
      mon.itemAlvo = null;
      return true;
    }
    // Coleta no agro do treinador (FOLLOW / DEFEND / etc. sem luta).
    if (perseguirItem(mon, jogador, dt)) return true;
    return false;
  }

  limparInvestigacao(mon);
  mon.itemAlvo = null;
  mon.alvo = alvo;
  mon.modo = "agro";
  if (ocupadoCast(mon)) {
    mon.andando = false;
    return true;
  }
  if (isCombatMotionLocked(mon)) return true;

  integrarEngajar(mon, alvo, dt);
  return true;
}

/** Wild em agro/roam hostil. */
export function tickWildCampo(ator, partyMon, jogador, dt) {
  if (!ator || ator.morto || ator.capturado || ator.preso) return;

  // Hurt/desmaio: não troca pra roam (senão a população cull e o mon some).
  if ((ator.hp != null && ator.hp <= 0) || (ator.desmaioEm || 0) > 0) {
    ator.vx = 0;
    ator.vy = 0;
    ator.andando = false;
    ator.correndo = false;
    return;
  }

  if (tickMeleeApproach(ator, dt)) return;

  if (ator.sonoNatural && !ehNoiteOverworld()) {
    acordarSonoNatural(ator);
  }

  const alvoCedo = escolherAlvoWild(ator, partyMon, jogador);
  if (alvoCedo && (ator.sonoNatural || ator.dormindo > 0)) {
    acordarSonoNatural(ator);
  }

  if (ator.dormindo > 0) {
    if (ator.status !== "sleep" && !ator.sonoNatural) {
      ator.dormindo = Math.max(0, ator.dormindo - dt);
    }
    if (ator.sonoNatural || ator.dormindo > 0) {
      if (ator.sonoNatural) deitarNoLar(ator);
      else {
        ator.vx = 0;
        ator.vy = 0;
        ator.andando = false;
      }
      if (!alvoCedo) return;
    }
  }

  const alvo = alvoCedo;
  if (alvo) {
    const mudou = ator.modo !== "agro" || ator.alvo !== alvo;
    ator.modo = "agro";
    ator.alvo = alvo;
    if (mudou && ator.packId != null) {
      alertarPackAgro(selvagensAtivos(), ator, alvo, (mate, t) => {
        mate.modo = "agro";
        mate.alvo = t;
        acordarSonoNatural(mate);
      });
    }
    if (ocupadoCast(ator)) {
      ator.andando = false;
      return;
    }
    if (isCombatMotionLocked(ator)) return;
    integrarEngajar(ator, alvo, dt);
    return;
  }

  if (ator.modo === "agro" && !ator.agroPersistente) {
    ator.modo = "roam";
    ator.alvo = null;
    clearMeleeApproach(ator);
  }

  // Diurnos de lar dormem na palha à noite (sem decay até amanhecer/agro).
  if (
    ehNoiteOverworld() &&
    ator.larId &&
    ator.faccao === "selvagem" &&
    !ator.efemero &&
    ehDiurno(ator.especie || ator)
  ) {
    deitarNoLar(ator);
  }
}

/** Dispara golpes depois da locomoção (party + wilds em luta). */
export function tickGolpesCampo(atores, agora, efeitos) {
  for (let i = 0; i < atores.length; i++) {
    const a = atores[i];
    if (!a || a.morto || a.capturado) continue;
    if (!a.alvo || a.alvo.morto || a.alvo.capturado) continue;
    if (isCombatMotionLocked(a)) continue;
    tentarGolpesCampo(a, agora, efeitos);
  }
}

/** Utilitário: chase barato se precisar (export). */
export function irAte(ator, x, y, z, dt, correndo = true) {
  const zz = z != null ? z : zDePerseguicao(ator, { x, y, z: ator.z });
  irPara(ator, x, y, zz, velocidadeDe(ator, correndo), dt, DIST_ITEM);
}
