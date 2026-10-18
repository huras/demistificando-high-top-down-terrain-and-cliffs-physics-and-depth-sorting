import { comecarEsquiva, emAvanco, emEsquiva, emRecuo, presoNoGolpe, velocidadeDe } from "../ator.js";
import { LEAD_MAX } from "./constantes.js";
import { limitarArena, regua, sentidoParada } from "./espaco.js";
import { entrada, quadroDe, saida } from "./observacao.js";
import { FATIA, PESOS } from "./pesos.js";
import { propagar } from "./rede.js";

const perfil = { portao: 0.05, mira: 1, passo: 0.1 };

export function definirPerfilIa(prox) {
  perfil.portao = prox.portao;
  perfil.mira = prox.mira;
  perfil.passo = prox.passo;
}

export function passoDecisaoIa() {
  return perfil.passo;
}

function aplicarEsquiva(ator, alvo) {
  if (Math.tanh(saida[2]) < perfil.portao) return false;
  const q = quadroDe(ator, alvo);
  const ax = Math.tanh(saida[0]);
  const ay = Math.tanh(saida[1]);
  if (ax * ax + ay * ay < 0.02) return false;
  const wx = ax * q.fx + ay * q.lx;
  const wy = ax * q.fy + ay * q.ly;
  const ok = comecarEsquiva(ator, wx, wy);
  if (ok) ator.hab = "esquivar";
  return ok;
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
    ator.leadX = 0;
    ator.leadY = 0;
    return;
  }
  const ox = Math.tanh(saida[3]) * LEAD_MAX * perfil.mira;
  const oy = Math.tanh(saida[4]) * LEAD_MAX * perfil.mira;
  ator.leadX = ox * q.fx + oy * q.lx;
  ator.leadY = ox * q.fy + oy * q.ly;
  ator.miraX = alvo.x + ator.leadX;
  ator.miraY = alvo.y + ator.leadY;
}

export function calcularHabilidade(nome) {
  propagar(PESOS, FATIA[nome], entrada, saida);
  return saida;
}

export function aplicarHabilidade(nome, ator, alvo) {
  if (nome === "esquivar") return aplicarEsquiva(ator, alvo);
  ator.hab = nome;
  gravarComando(ator, alvo, nome === "atirar");
  return false;
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
  if (presoNoGolpe(ator) && !emAvanco(ator)) {
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
      const lat = cx * q.lx + cy * q.ly;
      if (Math.abs(lat) < 0.2) {
        ator.vx = 0;
        ator.vy = 0;
        ator.andando = false;
        return;
      }
      dirX = q.lx * Math.sign(lat);
      dirY = q.ly * Math.sign(lat);
      mag = 1;
    } else {
      const aoLongo = mag > 0.2 ? (cx * q.fx + cy * q.fy) / mag : 0;
      const concorda = sentido > 0 ? aoLongo > 0.15 : aoLongo < -0.15;
      if (!concorda) {
        dirX = q.fx * sentido;
        dirY = q.fy * sentido;
        mag = 1;
      }
      if (sentido > 0) passo = Math.min(passo, Math.max(0, q.d - faixa.parada));
      else passo = Math.min(passo, Math.max(0, faixa.parada - q.d));
    }
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
