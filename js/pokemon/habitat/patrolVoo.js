/**
 * Patrol vertical no ninho HIGH: sobe/desce entre solo e mesa via fisica/voo.
 */
import { POKEMON } from "../../config.js";
import { alturaSobPes } from "../../fisica/colisao.js";
import { atualizarVoo, entrarVoo, estaVoando, sairVoo } from "../../fisica/voo.js";
import { HABITAT } from "./kinds.js";

const INTERVALO_MIN = 2.8;
const INTERVALO_MAX = 6.5;

/**
 * @param {object} ator
 * @param {number} dt
 * @param {number} agora
 */
export function tickPatrolVooLar(ator, dt, agora = 0) {
  if (!ator || ator.morto || ator.capturado || ator.preso) return;
  if (ator.habitatKind !== HABITAT.HIGH) return;
  if (ator.modo === "agro" || ator.alvo) return;
  if ((ator.conjuroRestante || 0) > 0) return;

  const casaZ = Number(ator.casaZ);
  if (!Number.isFinite(casaZ)) return;

  const chao = alturaSobPes(ator.x, ator.y, (ator.elevacao ?? ator.z ?? 0) + 8);
  const solo = chao > 0 ? chao : Math.max(0, casaZ - 12);
  const mesa = casaZ;

  if (ator._vooPatrolAte == null || agora >= ator._vooPatrolAte) {
    const u = Math.random();
    ator._vooPatrolAlvo = u < 0.45 ? mesa : u < 0.75 ? solo + 1.2 : (mesa + solo) * 0.5;
    ator._vooPatrolAte = agora + INTERVALO_MIN + Math.random() * (INTERVALO_MAX - INTERVALO_MIN);
  }

  const alvoZ = ator._vooPatrolAlvo ?? mesa;
  const elev = ator.elevacao ?? ator.z ?? 0;
  const dz = alvoZ - elev;

  // Longe do território horizontal: volta voando pra casa.
  const dx = (ator.casaX ?? ator.x) - ator.x;
  const dy = (ator.casaY ?? ator.y) - ator.y;
  const raio = POKEMON.RAIO_TERRITORIO || 10;
  const fora = dx * dx + dy * dy > raio * raio * 0.85;

  if (!estaVoando(ator)) {
    if (Math.abs(dz) > 0.55 || fora) entrarVoo(ator);
    else return;
  }

  let mx = 0;
  let my = 0;
  if (fora) {
    const d = Math.hypot(dx, dy) || 1;
    mx = dx / d;
    my = dy / d;
  } else if (ator.andando) {
    mx = ator.dirX || 0;
    my = ator.dirY || 0;
  }

  const sobe = dz > 0.25;
  const desce = dz < -0.25;
  atualizarVoo(ator, mx, my, sobe, desce, dt);

  if (!sobe && !desce && !fora && Math.abs(dz) < 0.2) {
    if (elev <= solo + 0.4) sairVoo(ator, { pousar: true });
  }
}
