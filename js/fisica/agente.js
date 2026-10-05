import {
  AGENTE_DIST_PARAR,
  AGENTE_VEL_MUL,
  GRAVIDADE,
  PATH_GLIDE_DIST_MIN,
  PATH_GLIDE_PULO_BONUS,
  RAIO_CORPO,
  VELOCIDADE_MAX,
  VELOCIDADE_SPRINT,
} from "../config.js";
import { alturaEm } from "../mundo/altura.js";
import { PERFIL_COMPANHEIRO } from "../navegacao/perfilMovimento.js";
import {
  atualizarSeguirCaminho,
  garantirNav,
  resetarNav,
} from "../navegacao/seguirCaminho.js";
import {
  abrirAsaDelta,
  atualizarAsaDelta,
  atualizarCorridaAsaDelta,
  estaPlanando,
  fecharAsaDelta,
  podeAbrirAsaDelta,
} from "./asaDelta.js";
import { alturaSobPes, moverAereo, moverComColisao } from "./colisao.js";
import { atualizarCorrida } from "./corrida.js";
import {
  atualizarAereo,
  empurrarForaDeCliff,
  iniciarPulo,
  iniciarQueda,
  podeIniciarPulo,
} from "./pulo.js";

function distPlanar(agente, nav) {
  if (!nav?.planarAlvo) return 0;
  return Math.hypot(
    nav.planarAlvo.cx + 0.5 - agente.x,
    nav.planarAlvo.cy + 0.5 - agente.y,
  );
}

/** Só lança asa em glide longo pra baixo/mesmo nível — nunca contra cliff pra cima. */
function deveLancarGlide(agente, nav, querPlanar) {
  if (!querPlanar || !nav?.planarAlvo || !agente.perfil?.podePlanar) return false;
  const zAqui = alturaSobPes(agente.x, agente.y);
  const zAlvo = nav.planarAlvo.z;
  if (zAlvo > zAqui) return false;
  return distPlanar(agente, nav) >= PATH_GLIDE_DIST_MIN;
}

/** Abre asa só depois do ápice (senão corta o pulo de degrau/+1). */
function deveAbrirAsaAgora(agente, querPlanar) {
  if (!querPlanar || estaPlanando(agente) || !podeAbrirAsaDelta(agente)) {
    return false;
  }
  return (agente.vz ?? 0) <= 0.2;
}

let _proxId = 1;

export function criarAgente(spawn, perfil = PERFIL_COMPANHEIRO) {
  const agente = {
    id: `agente-${_proxId++}`,
    perfil,
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
    correndo: false,
    coyoteT: 0,
    puloCortado: false,
    puloBufferT: 0,
    tempoAr: 0,
    mantle: null,
    _glideTempo: 0,
    _glideYaw: 0,
    _glideBank: 0,
  };
  garantirNav(agente);
  return agente;
}

export { resetarNav };

/**
 * Segue o líder via pathfinding (sem teleporte).
 * Velocidade = 60% da walk/sprint atual do líder.
 */
export function atualizarAgente(agente, lider, dt) {
  if (!agente || !lider) return;

  const velLider = lider.correndo ? VELOCIDADE_SPRINT : VELOCIDADE_MAX;
  const velMax = velLider * AGENTE_VEL_MUL;

  const { ix, iy, querPulo, querPlanar, soltarAsa } = atualizarSeguirCaminho(
    agente,
    lider,
    dt,
  );
  const nav = agente.nav;

  // Chegou na XY do pouso (ou path acabou no ar): solta asa e cai rápido
  if (soltarAsa && estaPlanando(agente)) {
    fecharAsaDelta(agente);
    nav.planarAlvo = null;
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

  const lancarGlide = deveLancarGlide(agente, nav, querPlanar);

  // Degrau +1: pulo normal (nunca misturar com asa)
  if (querPulo && !lancarGlide && podeIniciarPulo(agente)) {
    iniciarPulo(agente);
    agente.puloCortado = true;
  }

  // Glide longo: pulo de lançamento só na beirada (chão vai sumir / já caindo)
  if (lancarGlide && agente.noChao && podeIniciarPulo(agente)) {
    const zAqui = alturaSobPes(agente.x, agente.y);
    const frenteX = agente.x + Math.sign(ix || agente.dirX) * 0.55;
    const frenteY = agente.y + Math.sign(iy || agente.dirY) * 0.55;
    const zFrente = alturaSobPes(frenteX, frenteY);
    const naBeirada = zFrente <= 0 || zFrente < zAqui;
    if (naBeirada) {
      iniciarPulo(agente);
      agente.puloCortado = true;
      agente.vz = Math.sqrt(2 * GRAVIDADE * PATH_GLIDE_PULO_BONUS);
    }
  }

  if (agente.noChao) {
    if (estaPlanando(agente)) fecharAsaDelta(agente);

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
      if (deveAbrirAsaAgora(agente, lancarGlide)) abrirAsaDelta(agente);
      if (estaPlanando(agente)) {
        atualizarNoArPlanando(agente, ix, iy, dt);
      } else {
        atualizarAereo(agente, dt);
      }
      agente.andando = false;
      return;
    }

    if (!agente.pulando) {
      agente.z = zChao;
      agente.elevacao = zChao;
      agente.hopLift = 0;
      agente.vz = 0;
    }

    if (cantoEmCliffAlto(agente)) empurrarForaDeCliff(agente);

    const dist = Math.hypot(lider.x - agente.x, lider.y - agente.y);
    agente.andando = movendo && dist > AGENTE_DIST_PARAR;
    if (agente.andando) agente.animT += dt;

    if (nav?.estado === "semCaminho") agente.acao = "sem-caminho";
    else if (nav?.estado === "buscando") agente.acao = "buscando-path";
    else if (agente.andando) agente.acao = "seguindo";
    else agente.acao = "parado";
  } else {
    const zAlvo = nav?.planarAlvo?.z;
    const glideNoAr =
      !soltarAsa &&
      querPlanar &&
      distPlanar(agente, nav) >= PATH_GLIDE_DIST_MIN &&
      (zAlvo == null || zAlvo <= agente.z);
    if (deveAbrirAsaAgora(agente, glideNoAr)) abrirAsaDelta(agente);

    if (estaPlanando(agente) && !soltarAsa) {
      atualizarNoArPlanando(agente, ix, iy, dt);
    } else {
      atualizarCorrida(agente, ix, iy, dt, false, velMax * 0.9);
      const pos = moverAereo(
        agente,
        agente.vx * dt,
        agente.vy * dt,
        agente.elevacao,
      );
      if (pos.bloqueouX) agente.vx = 0;
      if (pos.bloqueouY) agente.vy = 0;
      agente.x = pos.x;
      agente.y = pos.y;
      atualizarAereo(agente, dt);
      agente.acao = agente.vz > 0.4 ? "pulando" : "caindo";
    }
    agente.andando = false;
  }
}

function atualizarNoArPlanando(agente, ix, iy, dt) {
  atualizarCorridaAsaDelta(agente, ix, iy, dt);
  const pos = moverAereo(
    agente,
    agente.vx * dt,
    agente.vy * dt,
    agente.elevacao,
  );
  if (pos.bloqueouX) agente.vx = 0;
  if (pos.bloqueouY) agente.vy = 0;
  agente.x = pos.x;
  agente.y = pos.y;
  atualizarAsaDelta(agente, dt);
  if (estaPlanando(agente)) agente.acao = "asa-delta";
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
