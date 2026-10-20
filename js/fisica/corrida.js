import {
  ACELERACAO_AR,
  ACELERACAO_CHAO,
  ATRITO_AR,
  ATRITO_CHAO,
  VELOCIDADE_MAX,
} from "../config.js";

/**
 * Acelera vx/vy na direção do input (chao ou ar).
 * Sem input: atrito. Retorna se há intenção de movimento.
 */
export function atualizarCorrida(corpo, dx, dy, dt, noChao, velMax = VELOCIDADE_MAX) {
  const acel = noChao ? ACELERACAO_CHAO : ACELERACAO_AR;
  const atrito = noChao ? ATRITO_CHAO : ATRITO_AR;
  const temInput = dx !== 0 || dy !== 0;
  const vmax = Math.max(0.1, velMax);

  if (temInput) {
    const alvoX = dx * vmax;
    const alvoY = dy * vmax;
    corpo.vx = aproximar(corpo.vx, alvoX, acel * dt);
    corpo.vy = aproximar(corpo.vy, alvoY, acel * dt);
  } else {
    corpo.vx = aproximar(corpo.vx, 0, atrito * dt);
    corpo.vy = aproximar(corpo.vy, 0, atrito * dt);
    if (Math.abs(corpo.vx) < 0.02) corpo.vx = 0;
    if (Math.abs(corpo.vy) < 0.02) corpo.vy = 0;
  }

  const sp = Math.hypot(corpo.vx, corpo.vy);
  if (sp > vmax) {
    const k = vmax / sp;
    corpo.vx *= k;
    corpo.vy *= k;
  }

  return temInput || sp > 0.05;
}

function aproximar(atual, alvo, maxDelta) {
  const d = alvo - atual;
  if (Math.abs(d) <= maxDelta) return alvo;
  return atual + Math.sign(d) * maxDelta;
}
