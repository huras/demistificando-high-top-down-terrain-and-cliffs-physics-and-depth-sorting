import { POKE_ANDAR_BOB, POKE_ANDAR_SQUASH } from "../config.js";

const SX_SY = { sx: 1, sy: 1 };

function arcoWalk(ator) {
  const v = ator?.visual;
  if (!v || v.anim !== "Walk" || !v.passo) return -1;
  if (ator.morto) return -1;
  if (ator.acao === "nadando") return -1;
  if ((ator.hopLift || 0) > 0.05) return -1;
  const elev = ator.elevacao ?? ator.z ?? 0;
  const z = ator.z ?? elev;
  if (elev > z + 0.05) return -1;
  const fase = v.fase || 0;
  const u = Math.sin(fase * Math.PI);
  return u * u;
}

function ampBob(ator) {
  const escala = Number(ator?.especie?.escala);
  const k = escala > 0 ? Math.min(1.35, Math.max(0.7, escala)) : 1;
  return POKE_ANDAR_BOB * k;
}

/** Offset vertical em blocos. Zero fora do Walk no chão. */
export function oscilacaoAndar(ator) {
  const arco = arcoWalk(ator);
  if (arco < 0) return 0;
  return ampBob(ator) * arco;
}

/**
 * Squash slime no pouso (scaleX↑ / scaleY↓). Reusa o mesmo objeto.
 * @returns {{ sx: number, sy: number }}
 */
export function squashAndar(ator) {
  SX_SY.sx = 1;
  SX_SY.sy = 1;
  const k = POKE_ANDAR_SQUASH;
  if (!(k > 0)) return SX_SY;
  const arco = arcoWalk(ator);
  if (arco < 0) return SX_SY;
  const pouso = 1 - arco;
  const w = pouso * pouso;
  SX_SY.sx = 1 + k * w;
  SX_SY.sy = 1 - k * w;
  return SX_SY;
}
