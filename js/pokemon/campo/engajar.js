import { sincronizarFacingParede } from "../../fisica/escalada.js";
import { velocidadeDe } from "../ator.js";
import { irPara, zDePerseguicao } from "../ia/locomocaoCampo.js";
import {
  aiShouldKeepClosing,
  combatEngageSteer,
  meleeContactStopDistance,
} from "../combate/meleeApproach.js";

/** Parada curta no strafe / meta local — NÃO empilhar com o anel de melee. */
const DIST_PARAR_CURTO = 0.28;

function encararAlvo(ator, alvo) {
  if (ator.escalando && ator.escalada) {
    sincronizarFacingParede(ator, ator.escalada);
    return;
  }
  const dx = alvo.x - ator.x;
  const dy = alvo.y - ator.y;
  const d = Math.hypot(dx, dy) || 1;
  ator.dirX = dx / d;
  ator.dirY = dy / d;
}

/**
 * Move até o anel de engajamento (path 3D) ou strafe no bolso.
 * Chase: meta = pé do alvo + distParar = anel (como Pokemon AI / ordem.js).
 * Evita pathar até o anel E ainda frear 1.05 — isso plantava o mon longe do hit.
 */
export function integrarEngajar(ator, alvo, dt) {
  if (!ator || !alvo) return;

  const z = zDePerseguicao(ator, alvo);
  // Sempre sprint no chase (igual follow com Shift) — não herdar walk do alvo.
  const vel = velocidadeDe(ator, true);
  const stop = meleeContactStopDistance(ator, alvo);
  ator.correndo = true;

  if (aiShouldKeepClosing(ator, alvo)) {
    // Meta = alvo; freio = anel de contato (uma só distância).
    irPara(ator, alvo.x, alvo.y, z, vel, dt, stop);
    encararAlvo(ator, alvo);
    return;
  }

  // No anel: strafe leve (Pokemon AI combatEngageSteer).
  const steer = combatEngageSteer(ator, alvo, dt);
  const mag = Math.hypot(steer.x, steer.y);
  if (mag < 0.04) {
    ator.vx = 0;
    ator.vy = 0;
    ator.andando = false;
    ator.correndo = false;
    encararAlvo(ator, alvo);
    return;
  }
  const gx = ator.x + (steer.x / mag) * 1.6;
  const gy = ator.y + (steer.y / mag) * 1.6;
  irPara(ator, gx, gy, z, vel * 0.85, dt, DIST_PARAR_CURTO);
  encararAlvo(ator, alvo);
}
