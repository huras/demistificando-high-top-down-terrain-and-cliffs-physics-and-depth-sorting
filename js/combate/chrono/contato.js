/**
 * Iniciação Paper Mario / Mario 64: stomp na cabeça ou toque no chão.
 */
import { CHRONO, RAIO_CORPO, RAIO_POKEMON } from "../../config.js";
import { modoChronoCampo } from "./modo.js";
import { abrirSessaoChrono, sessaoChronoAtiva } from "./sessao.js";

const FOLGA_PISO = 1.05;

let cooldown = 0;

export function tickContatoChrono(corpo, selvagens, dt, efeitos = null) {
  if (!modoChronoCampo() || sessaoChronoAtiva() || !corpo) return false;
  if (cooldown > 0) {
    cooldown = Math.max(0, cooldown - dt);
    return false;
  }
  if (!selvagens || !selvagens.length) return false;
  if (corpo.voando || corpo.planando || corpo.escalando || corpo.nadando) return false;

  const elevP = corpo.elevacao ?? corpo.z ?? 0;
  const noChao = !!corpo.noChao && !corpo.pulando;
  const caindo = !noChao && (corpo.vz == null || corpo.vz <= 0.15);

  const rPlayer = corpo.raioCorpo > 0 ? corpo.raioCorpo : RAIO_CORPO;

  for (let i = 0; i < selvagens.length; i++) {
    const mon = selvagens[i];
    if (!mon || mon.morto || mon.capturado || mon.hp <= 0) continue;
    if (mon.forcaCarregado || mon._forcaSendoLevantado) continue;

    const elevM = mon.elevacao ?? mon.z ?? 0;
    if (Math.abs(elevP - elevM) > FOLGA_PISO + CHRONO.ALTURA_MON) continue;

    const rMon = mon.raioCorpo > 0 ? mon.raioCorpo : RAIO_POKEMON;
    const dx = mon.x - corpo.x;
    const dy = mon.y - corpo.y;
    const lim = rPlayer + rMon + 0.08;
    if (dx * dx + dy * dy > lim * lim) continue;

    if (caindo) {
      const topoMon = elevM + CHRONO.ALTURA_MON;
      if (elevP >= topoMon - CHRONO.STOMP_FOLGA_CABECA) {
        corpo.vz = Math.max(corpo.vz || 0, CHRONO.STOMP_BOUNCE_VZ);
        corpo.pulando = true;
        corpo.noChao = false;
        cooldown = CHRONO.CONTATO_COOLDOWN;
        return abrirSessaoChrono(mon, { motivo: "stomp", efeitos });
      }
    }

    if (noChao && Math.abs(elevP - elevM) <= FOLGA_PISO) {
      cooldown = CHRONO.CONTATO_COOLDOWN;
      return abrirSessaoChrono(mon, { motivo: "toque", efeitos });
    }
  }
  return false;
}
