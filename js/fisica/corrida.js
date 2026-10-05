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
export function atualizarCorrida(corpo, dx, dy, dt, noChao) {
  const acel = noChao ? ACELERACAO_CHAO : ACELERACAO_AR;
  const atrito = noChao ? ATRITO_CHAO : ATRITO_AR;
  const temInput = dx !== 0 || dy !== 0;

  if (temInput) {
    const alvoX = dx * VELOCIDADE_MAX;
    const alvoY = dy * VELOCIDADE_MAX;
    corpo.vx = aproximar(corpo.vx, alvoX, acel * dt);
    corpo.vy = aproximar(corpo.vy, alvoY, acel * dt);
  } else {
    corpo.vx = aproximar(corpo.vx, 0, atrito * dt);
    corpo.vy = aproximar(corpo.vy, 0, atrito * dt);
    // zera residual pra não “rastejar”
    if (Math.abs(corpo.vx) < 0.02) corpo.vx = 0;
    if (Math.abs(corpo.vy) < 0.02) corpo.vy = 0;
  }

  const sp = Math.hypot(corpo.vx, corpo.vy);
  if (sp > VELOCIDADE_MAX) {
    const k = VELOCIDADE_MAX / sp;
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
