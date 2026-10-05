import {
  VELOCIDADE_MAX,
  VOO_POUSO_EPS,
  VOO_VEL_HORIZ_MUL,
  VOO_VEL_VERT,
} from "../config.js";
import { alturaSobPes, moverAereo } from "./colisao.js";
import { atualizarCorrida } from "./corrida.js";
import { fecharAsaDelta } from "./asaDelta.js";
import { limparTravaEscalada, limparTravaPosMantle } from "./travaInputEscalada.js";
import { pousarNoChao } from "./pulo.js";

export function estaVoando(corpo) {
  return corpo?.voando === true;
}

export function entrarVoo(corpo) {
  if (!corpo || corpo.voando) return false;
  if (corpo.escalando || corpo.escalada) {
    corpo.escalando = false;
    corpo.escalada = null;
  }
  if (corpo.mantle) corpo.mantle = null;
  limparTravaEscalada(corpo);
  limparTravaPosMantle(corpo);
  fecharAsaDelta(corpo);
  corpo.voando = true;
  corpo.noChao = false;
  corpo.pulando = true;
  corpo.planando = false;
  corpo.vz = 0;
  corpo.hopLift = (corpo.elevacao ?? corpo.z) - (corpo.z ?? 0);
  corpo.acao = "voando";
  return true;
}

export function sairVoo(corpo, { pousar = false } = {}) {
  if (!estaVoando(corpo)) return false;
  corpo.voando = false;
  if (pousar) {
    const zChao = alturaSobPes(corpo.x, corpo.y);
    if (zChao > 0) {
      pousarNoChao(corpo, zChao);
      return true;
    }
  }
  corpo.pulando = true;
  corpo.noChao = false;
  corpo.vz = Math.min(corpo.vz, 0);
  corpo.acao = "caindo";
  return true;
}

/**
 * Voo livre: WASD horizontal, sobe/desce verticais, sem gravidade.
 * Retorna true se ainda voando.
 */
export function atualizarVoo(corpo, dx, dy, sobe, desce, dt, velMax = VELOCIDADE_MAX) {
  if (!estaVoando(corpo)) return false;

  const vmax = velMax * VOO_VEL_HORIZ_MUL;
  atualizarCorrida(corpo, dx, dy, dt, false, vmax);

  let vzAlvo = 0;
  if (sobe) vzAlvo += VOO_VEL_VERT;
  if (desce) vzAlvo -= VOO_VEL_VERT;
  corpo.vz = aproximar(corpo.vz, vzAlvo, VOO_VEL_VERT * 4 * dt);

  const pos = moverAereo(corpo, corpo.vx * dt, corpo.vy * dt, corpo.elevacao);
  if (pos.bloqueouX) corpo.vx = 0;
  if (pos.bloqueouY) corpo.vy = 0;
  corpo.x = pos.x;
  corpo.y = pos.y;

  corpo.elevacao += corpo.vz * dt;
  const zChao = alturaSobPes(corpo.x, corpo.y);
  const chao = zChao > 0 ? zChao : 0;

  if (corpo.elevacao < chao + 0.05) {
    corpo.elevacao = chao + 0.05;
    if (corpo.vz < 0) corpo.vz = 0;
  }

  // Pouso automático se pediu descer colado no chão
  if (
    desce &&
    !sobe &&
    zChao > 0 &&
    corpo.elevacao <= zChao + VOO_POUSO_EPS
  ) {
    sairVoo(corpo, { pousar: true });
    return false;
  }

  corpo.z = zChao > 0 ? zChao : Math.floor(corpo.elevacao);
  corpo.hopLift = corpo.elevacao - corpo.z;
  corpo.noChao = false;
  corpo.pulando = true;
  corpo.andando = Math.hypot(corpo.vx, corpo.vy) > 0.3 || Math.abs(corpo.vz) > 0.2;
  if (corpo.andando) corpo.animT += dt;
  corpo.acao = "voando";
  return true;
}

/**
 * Voo do companheiro em direção a um alvo 3D (x,y,elev).
 */
export function atualizarVooAteAlvo(corpo, alvo, dt, velMax = VELOCIDADE_MAX) {
  if (!alvo) return atualizarVoo(corpo, 0, 0, false, false, dt, velMax);

  const dx = alvo.x - corpo.x;
  const dy = alvo.y - corpo.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ix = dx / dist;
  const iy = dy / dist;
  const elevAlvo = alvo.z ?? alvo.elevacao ?? corpo.elevacao;
  const dz = elevAlvo - corpo.elevacao;
  const sobe = dz > 0.35;
  const desce = dz < -0.35;
  return atualizarVoo(corpo, ix, iy, sobe, desce, dt, velMax);
}

function aproximar(atual, alvo, maxDelta) {
  const d = alvo - atual;
  if (Math.abs(d) <= maxDelta) return alvo;
  return atual + Math.sign(d) * maxDelta;
}
