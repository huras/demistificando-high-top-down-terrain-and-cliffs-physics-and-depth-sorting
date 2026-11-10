/**
 * Chrono no overworld — engate estilo Paper Mario 64:
 * só contato corporal (player↔wild ou party↔wild). Hostil persegue até o bump.
 */
import { CHRONO, RAIO_CORPO, RAIO_POKEMON } from "../../config.js";
import { velocidadeDe } from "../../pokemon/ator.js";
import { escolherAlvoWild } from "../../pokemon/campo/alvo.js";
import { andar } from "../../pokemon/locomocao.js";
import { modoChronoCampo } from "./modo.js";
import { abrirSessaoChrono, sessaoChronoAtiva } from "./sessao.js";

const FOLGA_PISO = 1.05;

let cooldown = 0;

function vivo(ator) {
  return !!(ator && !ator.morto && !ator.capturado && (ator.hp == null || ator.hp > 0));
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function raioDe(ator, fallback) {
  return ator?.raioCorpo > 0 ? ator.raioCorpo : fallback;
}

function elevDe(ator) {
  return ator?.elevacao ?? ator?.z ?? 0;
}

/** Colisão XY + altura compatível (soma de raios + CONTATO_FOLGA). */
function corposColidem(a, b, fallbackA = RAIO_POKEMON, fallbackB = RAIO_POKEMON, folgaVertical = FOLGA_PISO) {
  if (!a || !b) return false;
  if (Math.abs(elevDe(a) - elevDe(b)) > folgaVertical) return false;
  const folga = CHRONO.CONTATO_FOLGA ?? 0.08;
  const lim = raioDe(a, fallbackA) + raioDe(b, fallbackB) + folga;
  return dist2(a, b) <= lim * lim;
}

function tentarAbrir(fonte, motivo, efeitos, corpo = null) {
  cooldown = CHRONO.CONTATO_COOLDOWN;
  return abrirSessaoChrono(fonte, { motivo, efeitos, corpo });
}

/** Player encostou / stompou um selvagem. */
function contatoPlayer(corpo, mon, efeitos) {
  if (!corpo || !vivo(mon)) return false;
  if (mon.forcaCarregado || mon._forcaSendoLevantado) return false;

  const elevP = elevDe(corpo);
  const elevM = elevDe(mon);
  if (Math.abs(elevP - elevM) > FOLGA_PISO + CHRONO.ALTURA_MON) return false;

  const noChao = !!corpo.noChao && !corpo.pulando;
  const caindo = !noChao && (corpo.vz == null || corpo.vz <= 0.15);
  const rPlayer = raioDe(corpo, RAIO_CORPO);
  const rMon = raioDe(mon, RAIO_POKEMON);
  const folga = CHRONO.CONTATO_FOLGA ?? 0.08;
  const lim = rPlayer + rMon + folga;
  if (dist2(corpo, mon) > lim * lim) return false;

  if (caindo) {
    const topoMon = elevM + CHRONO.ALTURA_MON;
    if (elevP >= topoMon - CHRONO.STOMP_FOLGA_CABECA) {
      corpo.vz = Math.max(corpo.vz || 0, CHRONO.STOMP_BOUNCE_VZ);
      corpo.pulando = true;
      corpo.noChao = false;
      return tentarAbrir(mon, "stomp", efeitos, corpo);
    }
  }

  if (noChao && Math.abs(elevP - elevM) <= FOLGA_PISO) {
    return tentarAbrir(mon, "toque", efeitos, corpo);
  }
  return false;
}

/** Party Pokémon encostou no selvagem. */
function contatoParty(mon, wild, efeitos, corpo = null) {
  if (!vivo(mon) || !vivo(wild)) return false;
  if (mon.forcaCarregado || mon._forcaSendoLevantado) return false;
  if (mon.combatHold || mon._chronoHold) return false;
  if (wild.forcaCarregado || wild._forcaSendoLevantado) return false;
  if (!corposColidem(mon, wild)) return false;
  return tentarAbrir(wild, "party", efeitos, corpo);
}

/** Alvo de perseguição Chrono (não abre batalha). */
function alvoChrono(ator, partyMon, jogador) {
  if (!vivo(ator)) return null;
  if (ator.sonoNatural || (ator.dormindo || 0) > 0 || ator.status === "sleep") return null;
  const sticky = escolherAlvoWild(ator, partyMon, jogador);
  if (sticky) return sticky;
  if (!ator.hostil && ator.modo !== "agro") return null;

  const lim2 = CHRONO.RAIO_PERSEGUIR * CHRONO.RAIO_PERSEGUIR;
  const partyVivo = vivo(partyMon);
  if (partyVivo && dist2(ator, partyMon) <= lim2) return partyMon;
  const jogOk = jogador && !jogador.morto && (jogador.hp == null || jogador.hp > 0);
  const emGraca = (jogador?.gracaEncontro || 0) > 0;
  if (!partyVivo && jogOk && !emGraca && dist2(ator, jogador) <= lim2) return jogador;
  return null;
}

/** Wild hostil caminha até o foco; sem golpes realtime. */
function perseguirChrono(ator, alvo, dt) {
  if (!vivo(ator) || !alvo) return;
  const dx = alvo.x - ator.x;
  const dy = alvo.y - ator.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.2) {
    ator.vx = 0;
    ator.vy = 0;
    ator.andando = false;
    return;
  }
  ator.modo = "agro";
  ator.alvo = alvo;
  ator.correndo = true;
  andar(ator, dx, dy, velocidadeDe(ator, true), dt);
}

/**
 * Campo Chrono fora de sessão: chase hostil + engate só por contato.
 * @returns {boolean} true se abriu batalha
 */
export function tickContatoChrono(corpo, selvagens, mon, dt, efeitos = null) {
  if (!modoChronoCampo() || sessaoChronoAtiva() || !corpo) return false;
  if (cooldown > 0) {
    cooldown = Math.max(0, cooldown - dt);
    return false;
  }
  if (!selvagens || !selvagens.length) return false;

  for (let i = 0; i < selvagens.length; i++) {
    const w = selvagens[i];
    if (!vivo(w) || w._chronoHold || w.combatHold) continue;
    if (w.forcaCarregado || w._forcaSendoLevantado) continue;
    if (w.sonoNatural || (w.dormindo || 0) > 0 || w.status === "sleep") continue;

    if (!corpo.voando && !corpo.planando && !corpo.escalando && !corpo.nadando) {
      if (contatoPlayer(corpo, w, efeitos)) return true;
    }

    if (contatoParty(mon, w, efeitos, corpo)) return true;

    const alvo = alvoChrono(w, mon, corpo);
    if (!alvo) continue;
    perseguirChrono(w, alvo, dt);
  }
  return false;
}
