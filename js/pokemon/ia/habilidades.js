import { comecarEsquiva, emAvanco, emEsquiva, emRecuo, velocidadeDe } from "../ator.js";
import { LEAD_MAX } from "./constantes.js";
import { limitarArena, regua, sentidoParada } from "./espaco.js";
import { entrada, quadroDe, saida } from "./observacao.js";
import { FATIA, PESOS } from "./pesos.js";
import { propagar } from "./rede.js";

function aplicarEsquiva(ator, alvo) {
  let k = 0;
  if (saida[1] > saida[k]) k = 1;
  if (saida[2] > saida[k]) k = 2;
  const q = quadroDe(ator, alvo);
  let sx = q.lx;
  let sy = q.ly;
  if (k === 1) {
    sx = -q.lx;
    sy = -q.ly;
  } else if (k === 2) {
    sx = -q.fx;
    sy = -q.fy;
  }
  comecarEsquiva(ator, sx, sy);
}

function gravarComando(ator, alvo, comMira) {
  const q = quadroDe(ator, alvo);
  ator.dirX = q.fx;
  ator.dirY = q.fy;
  let ax = Math.tanh(saida[0]);
  let ay = Math.tanh(saida[1]);
  if (Math.abs(ax) < 0.2) ax = 0;
  if (Math.abs(ay) < 0.2) ay = 0;
  const gate = Math.tanh(saida[2]);
  if (gate < 0 || ax * ax + ay * ay < 0.04) {
    ator.cmdX = 0;
    ator.cmdY = 0;
  } else {
    const wx = ax * q.fx + ay * q.lx;
    const wy = ax * q.fy + ay * q.ly;
    const m = Math.hypot(wx, wy) || 1;
    ator.cmdX = wx / m;
    ator.cmdY = wy / m;
  }
  if (!comMira) {
    ator.miraX = NaN;
    ator.miraY = NaN;
    return;
  }
  const ox = Math.tanh(saida[3]) * LEAD_MAX;
  const oy = Math.tanh(saida[4]) * LEAD_MAX;
  ator.miraX = alvo.x + ox * q.fx + oy * q.lx;
  ator.miraY = alvo.y + ox * q.fy + oy * q.ly;
}

export function calcularHabilidade(nome) {
  propagar(PESOS, FATIA[nome], entrada, saida);
  return saida;
}

export function aplicarHabilidade(nome, ator, alvo) {
  ator.hab = nome;
  if (nome === "esquivar") {
    aplicarEsquiva(ator, alvo);
    return;
  }
  gravarComando(ator, alvo, nome === "atirar");
}

/** Integra o último comando. Perseguir e atirar não atravessam a parada. */
export function integrarComando(ator, alvo, dt) {
  if (!ator || ator.morto || ator.capturado) {
    if (ator) {
      ator.vx = 0;
      ator.vy = 0;
      ator.andando = false;
    }
    return;
  }
  const q = alvo ? quadroDe(ator, alvo) : null;
  if (q) {
    ator.dirX = q.fx;
    ator.dirY = q.fy;
  }
  if ((ator.conjuroRestante || 0) > 0) {
    ator.vx = 0;
    ator.vy = 0;
    ator.andando = false;
    return;
  }
  if (emRecuo(ator) || emAvanco(ator) || emEsquiva(ator)) {
    ator.andando = false;
    return;
  }
  const cx = ator.cmdX || 0;
  const cy = ator.cmdY || 0;
  const m = Math.hypot(cx, cy);
  if (!q) {
    ator.vx = 0;
    ator.vy = 0;
    ator.andando = false;
    return;
  }
  const hab = ator.hab;
  const vel = velocidadeDe(ator, true);
  let passo = vel * dt;
  let dirX = cx;
  let dirY = cy;
  let mag = m;
  if (hab === "perseguir" || hab === "atirar") {
    const faixa = regua(ator, hab);
    const sentido = sentidoParada(q.d, faixa.parada, faixa.forma);
    if (sentido === 0) {
      ator.vx = 0;
      ator.vy = 0;
      ator.andando = false;
      return;
    }
    const aoLongo = mag > 0.2 ? (cx * q.fx + cy * q.fy) / mag : 0;
    const concorda = sentido > 0 ? aoLongo > 0.15 : aoLongo < -0.15;
    if (!concorda) {
      dirX = q.fx * sentido;
      dirY = q.fy * sentido;
      mag = 1;
    }
    if (sentido > 0) passo = Math.min(passo, Math.max(0, q.d - faixa.parada));
    else passo = Math.min(passo, Math.max(0, faixa.parada - q.d));
  } else if (mag < 0.2) {
    ator.vx = 0;
    ator.vy = 0;
    ator.andando = false;
    return;
  }
  if (passo <= 0.0001 || mag < 0.2) {
    ator.vx = 0;
    ator.vy = 0;
    ator.andando = false;
    return;
  }
  const inv = 1 / mag;
  ator.x += dirX * inv * passo;
  ator.y += dirY * inv * passo;
  ator.vx = dirX * inv * vel;
  ator.vy = dirY * inv * vel;
  ator.andando = true;
  limitarArena(ator);
}
