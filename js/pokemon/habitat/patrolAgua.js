/**
 * Roam aquático: superfície com metade do corpo fora; undersea entre fundo e superfície.
 */
import { colunaAgua } from "../../mundo/agua/fluxo.js";
import { imersaoNado } from "../../fisica/agua.js";
import { HABITAT } from "./kinds.js";

/**
 * @param {object} ator
 * @param {number} dt
 * @param {number} agora
 */
export function tickPatrolAguaLar(ator, dt, agora = 0) {
  if (!ator || ator.morto || ator.capturado || ator.preso) return;
  const kind = ator.habitatKind;
  if (kind !== HABITAT.SURFACE && kind !== HABITAT.UNDERSEA) return;
  if (ator.modo === "agro" || ator.alvo) return;

  const agua = colunaAgua(Math.floor(ator.x), Math.floor(ator.y));
  if (agua.profundidade < 0.5) return;

  const superficie = agua.superficie;
  const fundo = agua.fundo;
  const elev = ator.elevacao ?? ator.z ?? superficie;

  if (kind === HABITAT.SURFACE) {
    const alvo = Math.max(fundo + 0.4, superficie - imersaoNado(ator));
    ator.elevacao = elev + (alvo - elev) * Math.min(1, 4 * dt);
    ator.z = Math.floor(fundo);
    ator.hopLift = Math.max(0, ator.elevacao - ator.z);
    ator.nadando = true;
    return;
  }

  // Undersea: oscila entre fundo+0.5 e superficie-1.
  if (ator._aguaPatrolAte == null || agora >= ator._aguaPatrolAte) {
    const lo = fundo + 0.45;
    const hi = Math.max(lo + 0.5, superficie - 1);
    ator._aguaPatrolAlvo = lo + Math.random() * (hi - lo);
    ator._aguaPatrolAte = agora + 2.5 + Math.random() * 4;
  }
  const alvoZ = ator._aguaPatrolAlvo ?? fundo + 1;
  ator.elevacao = elev + (alvoZ - elev) * Math.min(1, 2.2 * dt);
  // Não furar a superfície.
  if (ator.elevacao > superficie - 0.35) ator.elevacao = superficie - 0.35;
  if (ator.elevacao < fundo + 0.3) ator.elevacao = fundo + 0.3;
  ator.z = Math.floor(fundo);
  ator.hopLift = Math.max(0, ator.elevacao - ator.z);
  ator.nadando = true;
}
