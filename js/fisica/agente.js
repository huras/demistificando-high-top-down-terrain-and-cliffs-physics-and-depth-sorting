import {
  AGENTE_DIST_PARAR,
  AGENTE_DIST_TELEPORTE,
  AGENTE_VEL_MUL,
  RAIO_CORPO,
  VELOCIDADE_MAX,
  VELOCIDADE_SPRINT,
} from "../config.js";
import { alturaEm } from "../mundo/altura.js";
import { alturaSobPes, moverAereo, moverComColisao } from "./colisao.js";
import { atualizarCorrida } from "./corrida.js";
import { atualizarAereo, empurrarForaDeCliff, iniciarQueda } from "./pulo.js";

export function criarAgente(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    elevacao: spawn.z,
    vx: 0,
    vy: 0,
    vz: 0,
    dirX: 0,
    dirY: 1,
    facing: 0,
    noChao: true,
    pulando: false,
    planando: false,
    escalando: false,
    hopLift: 0,
    animT: 0,
    andando: false,
    acao: "agente",
    agente: true,
  };
}

/**
 * Segue o líder a 60% da velocidade atual dele (walk/sprint).
 */
export function atualizarAgente(agente, lider, dt) {
  if (!agente || !lider) return;

  const dxL = lider.x - agente.x;
  const dyL = lider.y - agente.y;
  const dist = Math.hypot(dxL, dyL);

  if (dist > AGENTE_DIST_TELEPORTE) {
    puxarPertoDoLider(agente, lider);
    return;
  }

  const velLider = lider.correndo ? VELOCIDADE_SPRINT : VELOCIDADE_MAX;
  const velMax = velLider * AGENTE_VEL_MUL;

  let ix = 0;
  let iy = 0;
  if (dist > AGENTE_DIST_PARAR) {
    ix = dxL / dist;
    iy = dyL / dist;
  }

  if (ix !== 0 || iy !== 0) {
    agente.dirX = Math.abs(ix) >= Math.abs(iy) ? Math.sign(ix) : 0;
    agente.dirY = Math.abs(iy) > Math.abs(ix) ? Math.sign(iy) : 0;
    if (agente.dirX === 0 && agente.dirY === 0) {
      agente.dirX = Math.sign(ix) || 0;
      agente.dirY = Math.sign(iy) || 1;
    }
    agente.facing = facingDeDir(agente.dirX || ix, agente.dirY || iy);
  }

  if (agente.noChao) {
    const movendo = atualizarCorrida(agente, ix, iy, dt, true, velMax);
    const novo = moverComColisao(agente, agente.vx * dt, agente.vy * dt, "andar");
    if (novo.bloqueouX) agente.vx = 0;
    if (novo.bloqueouY) agente.vy = 0;
    agente.x = novo.x;
    agente.y = novo.y;

    const zChao = alturaSobPes(agente.x, agente.y);
    if (zChao <= 0 || zChao < agente.z) {
      iniciarQueda(agente);
      agente.elevacao = agente.z;
      atualizarAereo(agente, dt);
      agente.andando = false;
      return;
    }

    agente.z = zChao;
    agente.elevacao = zChao;
    agente.hopLift = 0;
    agente.vz = 0;
    if (cantoEmCliffAlto(agente)) empurrarForaDeCliff(agente);

    agente.andando = movendo && dist > AGENTE_DIST_PARAR;
    if (agente.andando) {
      agente.animT += dt;
      agente.acao = "seguindo";
    } else {
      agente.acao = "parado";
    }
  } else {
    atualizarCorrida(agente, ix, iy, dt, false, velMax * 0.85);
    const pos = moverAereo(agente, agente.vx * dt, agente.vy * dt, agente.elevacao);
    if (pos.bloqueouX) agente.vx = 0;
    if (pos.bloqueouY) agente.vy = 0;
    agente.x = pos.x;
    agente.y = pos.y;
    atualizarAereo(agente, dt);
    agente.andando = false;
    agente.acao = "caindo";
  }
}

function puxarPertoDoLider(agente, lider) {
  const fx = lider.dirX || 0;
  const fy = lider.dirY || 1;
  const len = Math.hypot(fx, fy) || 1;
  agente.x = lider.x - (fx / len) * 1.2;
  agente.y = lider.y - (fy / len) * 1.2;
  agente.z = lider.z;
  agente.elevacao = lider.z;
  agente.hopLift = 0;
  agente.vx = 0;
  agente.vy = 0;
  agente.vz = 0;
  agente.noChao = true;
  agente.pulando = false;
  agente.andando = false;
  agente.acao = "alcançou";
}

function facingDeDir(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 1 : 2;
  return dy < 0 ? 3 : 0;
}

function cantoEmCliffAlto(corpo) {
  const r = RAIO_CORPO;
  for (const [px, py] of [
    [corpo.x - r, corpo.y - r],
    [corpo.x + r, corpo.y - r],
    [corpo.x - r, corpo.y + r],
    [corpo.x + r, corpo.y + r],
  ]) {
    if (alturaEm(Math.floor(px), Math.floor(py)) > corpo.z) return true;
  }
  return false;
}
