/**
 * Chrono no overworld: engate por proximidade (maior que range de golpe),
 * stomp na cabeça ou toque no chão. Wild hostil persegue até o RAIO_ENGATE.
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

function tentarAbrir(fonte, motivo, efeitos) {
  cooldown = CHRONO.CONTATO_COOLDOWN;
  return abrirSessaoChrono(fonte, { motivo, efeitos });
}

/** Player encostou / stompou um selvagem. */
function contatoPlayer(corpo, mon, efeitos) {
  if (!corpo || !vivo(mon)) return false;
  if (mon.forcaCarregado || mon._forcaSendoLevantado) return false;

  const elevP = corpo.elevacao ?? corpo.z ?? 0;
  const elevM = mon.elevacao ?? mon.z ?? 0;
  if (Math.abs(elevP - elevM) > FOLGA_PISO + CHRONO.ALTURA_MON) return false;

  const noChao = !!corpo.noChao && !corpo.pulando;
  const caindo = !noChao && (corpo.vz == null || corpo.vz <= 0.15);
  const rPlayer = corpo.raioCorpo > 0 ? corpo.raioCorpo : RAIO_CORPO;
  const rMon = mon.raioCorpo > 0 ? mon.raioCorpo : RAIO_POKEMON;
  const lim = rPlayer + rMon + 0.08;
  if (dist2(corpo, mon) > lim * lim) return false;

  if (caindo) {
    const topoMon = elevM + CHRONO.ALTURA_MON;
    if (elevP >= topoMon - CHRONO.STOMP_FOLGA_CABECA) {
      corpo.vz = Math.max(corpo.vz || 0, CHRONO.STOMP_BOUNCE_VZ);
      corpo.pulando = true;
      corpo.noChao = false;
      return tentarAbrir(mon, "stomp", efeitos);
    }
  }

  if (noChao && Math.abs(elevP - elevM) <= FOLGA_PISO) {
    return tentarAbrir(mon, "toque", efeitos);
  }
  return false;
}

/** Engate por distância (wild ↔ party/player) — maior que qualquer range de golpe. */
function engatePorDistancia(mon, foco, efeitos) {
  if (!vivo(mon) || !foco) return false;
  const lim = CHRONO.RAIO_ENGATE;
  if (dist2(mon, foco) > lim * lim) return false;
  const elevM = mon.elevacao ?? mon.z ?? 0;
  const elevF = foco.elevacao ?? foco.z ?? 0;
  if (Math.abs(elevM - elevF) > FOLGA_PISO + 1.2) return false;
  return tentarAbrir(mon, "proximidade", efeitos);
}

/** Alvo no raio de engate Chrono (maior que RAIO_AGRO / range de golpe). */
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
  if (!partyVivo && jogOk && dist2(ator, jogador) <= lim2) return jogador;
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
 * Campo Chrono fora de sessão: chase hostil + engate por raio / stomp / toque.
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

    // Player stomp / toque ainda inicia.
    if (!corpo.voando && !corpo.planando && !corpo.escalando && !corpo.nadando) {
      if (contatoPlayer(corpo, w, efeitos)) return true;
    }

    // Só quem tá a fim de lutar (hostil/agro) persegue e engaja por distância.
    const alvo = alvoChrono(w, mon, corpo);
    if (!alvo) continue;
    perseguirChrono(w, alvo, dt);
    if (engatePorDistancia(w, alvo, efeitos)) return true;
  }
  return false;
}
