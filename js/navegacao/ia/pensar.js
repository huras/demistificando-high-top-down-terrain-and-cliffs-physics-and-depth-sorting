import { AGENTE_DIST_SEGUIR } from "../../config.js";
import { garantirNav } from "../seguirCaminho.js";
import { OFFSET_MON, OFFSET_NPC } from "../espacoSeguir.js";
import { resolverPisoInterior } from "../../jogo/pisoInterior.js";
import { HORIZONTE, PASSO_DECISAO, PRESO_CASTIGO, PRESO_FOLGA, PRESO_SEG } from "./constantes.js";
import { aplicarHabilidade, calcularHabilidade, comandoSeguir } from "./habilidades.js";
import { entrada, saida } from "./observacao.js";
import { REDE_ACEITA } from "./pesos.js";
import { escolherHabilidade } from "./seletor.js";
import { sondarMundo } from "./sonda.js";

let redeLigada = REDE_ACEITA;

export function definirRedeSeguir(ligada) {
  redeLigada = ligada !== false;
}

export function redeSeguirLigada() {
  return redeLigada;
}

function postoDe(agente, lider, posto) {
  const off = agente.faccao === "party" ? OFFSET_MON : OFFSET_NPC;
  let x = lider.x + off.x;
  let y = lider.y + off.y;
  const ok = resolverPisoInterior(x, y, lider.x, lider.y);
  if (ok) {
    x = ok.x;
    y = ok.y;
  }
  posto.x = x;
  posto.y = y;
  posto.z = lider.elevacao ?? lider.z ?? 0;
  return posto;
}

const posto = { x: 0, y: 0, z: 0 };

function apontar(agente, cmd) {
  const nav = garantirNav(agente);
  if (cmd.querVoar) {
    if (!nav.vooAlvo) nav.vooAlvo = { x: 0, y: 0, z: 0 };
    nav.vooAlvo.x = cmd.postoX;
    nav.vooAlvo.y = cmd.postoY;
    nav.vooAlvo.z = cmd.postoZ;
    nav.planarAlvo = null;
    nav.climbAlvo = null;
    return;
  }
  if (cmd.querPlanar) {
    if (!nav.planarAlvo) nav.planarAlvo = { x: 0, y: 0, cx: 0, cy: 0, z: 0 };
    nav.planarAlvo.x = cmd.postoX;
    nav.planarAlvo.y = cmd.postoY;
    nav.planarAlvo.cx = cmd.postoX;
    nav.planarAlvo.cy = cmd.postoY;
    nav.planarAlvo.z = cmd.postoZ;
    nav.vooAlvo = null;
    return;
  }
  nav.vooAlvo = null;
  nav.planarAlvo = null;
}

function repetir(agente, cmd) {
  cmd.ix = agente._six || 0;
  cmd.iy = agente._siy || 0;
  cmd.querPulo = false;
  cmd.querEscalar = false;
  cmd.soltarParede = false;
  cmd.querVoar = agente._svoar === 1;
  cmd.querPlanar = agente._splano === 1;
  cmd.soltarAsa = !cmd.querVoar && !cmd.querPlanar;
  return cmd;
}

function gravar(agente, cmd) {
  agente._six = cmd.ix;
  agente._siy = cmd.iy;
  agente._svoar = cmd.querVoar ? 1 : 0;
  agente._splano = cmd.querPlanar ? 1 : 0;
}

function vigiar(agente, dt, distPosto, distSeguir) {
  const andando = (agente._six || 0) !== 0 || (agente._siy || 0) !== 0;
  if (!andando || distPosto <= distSeguir + 0.5) {
    agente._seguirAx = agente.x;
    agente._seguirAy = agente.y;
    agente._seguirAt = 0;
    return false;
  }
  if (agente._seguirAx == null) {
    agente._seguirAx = agente.x;
    agente._seguirAy = agente.y;
    agente._seguirAt = 0;
  }
  const prog = Math.hypot(agente.x - agente._seguirAx, agente.y - agente._seguirAy);
  if (prog > PRESO_FOLGA) {
    agente._seguirAx = agente.x;
    agente._seguirAy = agente.y;
    agente._seguirAt = 0;
    return false;
  }
  agente._seguirAt += dt;
  if (agente._seguirAt <= PRESO_SEG) return false;
  agente._seguirPreso = PRESO_CASTIGO;
  agente._seguirAt = 0;
  agente._six = 0;
  agente._siy = 0;
  return true;
}

/**
 * Comando de seguir, ou null para o pathfinder.
 * Horizonte, escalada, mantle e travamento de 1,3 s devolvem null.
 */
export function pensarSeguir(agente, lider, dt, distSeguir) {
  if (!redeLigada || !(distSeguir >= 1)) return null;
  if (agente.escalando || agente.mantle) return null;
  if ((agente._seguirPreso || 0) > 0) {
    agente._seguirPreso -= dt;
    return null;
  }
  postoDe(agente, lider, posto);
  const dxL = lider.x - agente.x;
  const dyL = lider.y - agente.y;
  if (dxL * dxL + dyL * dyL > HORIZONTE * HORIZONTE) return null;

  const dx = posto.x - agente.x;
  const dy = posto.y - agente.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const parar = distSeguir > 0 ? distSeguir : AGENTE_DIST_SEGUIR;
  if (vigiar(agente, dt, dist, parar)) return null;

  const cmd = comandoSeguir();
  agente._seguirT = (agente._seguirT || 0) + dt;
  if (agente._sHab && agente._seguirT < PASSO_DECISAO) {
    repetir(agente, cmd);
  } else {
    agente._seguirT = 0;
    const fx = dx / dist;
    const fy = dy / dist;
    sondarMundo(agente, posto.x, posto.y, posto.z, fx, fy, dist, parar, entrada);
    const hab = escolherHabilidade(agente.perfil, entrada, !!agente.voando);
    agente._sHab = hab;
    calcularHabilidade(hab);
    aplicarHabilidade(hab, fx, fy);
    agente._slado = Math.tanh(saida[1]);
    gravar(agente, cmd);
  }
  cmd.postoX = posto.x;
  cmd.postoY = posto.y;
  cmd.postoZ = posto.z;
  apontar(agente, cmd);
  return cmd;
}
