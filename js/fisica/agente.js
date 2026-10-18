import {
  AGENTE_GLIDE_HEUR_FOLGA,
  AGENTE_VEL_MUL,
  ASA_DELTA_ABRIR_APOS,
  GRAVIDADE,
  PATH_GLIDE_DIST_MIN,
  PATH_GLIDE_PULO_BONUS,
  VELOCIDADE_MAX,
  VELOCIDADE_SPRINT,
} from "../config.js";
import { aplicarEspacoSeguir } from "../navegacao/espacoSeguir.js";
import { pensarSeguir } from "../navegacao/ia/pensar.js";
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
import {
  aplicarCorrenteChao,
  atualizarNado,
  fimPassoChao,
  inicioPassoChao,
} from "./agua.js";
import { alturaSobPes, moverAereo, moverComColisao } from "./colisao.js";
import { atualizarCorrida } from "./corrida.js";
import { ritmoAndar } from "./ritmoAndar.js";
import {
  anexarEscalada,
  atualizarEscalada,
  atualizarMantle,
  soltarEscalada,
  tentarEscalar,
} from "./escalada.js";
import {
  atualizarAereo,
  iniciarPulo,
  iniciarQueda,
  podeIniciarPulo,
} from "./pulo.js";
import { iniciarStamina, regenerarStamina } from "./stamina.js";
import {
  atualizarVooAteAlvo,
  entrarVoo,
  estaVoando,
  sairVoo,
} from "./voo.js";

function degrauDeUm(agente, ix, iy) {
  if (!agente.noChao || !agente.perfil?.podePular) return false;
  if (agente.escalando || agente.voando || agente.planando) return false;
  const len = Math.hypot(ix, iy);
  if (len < 1e-4) return false;
  const nx = ix / len;
  const ny = iy / len;
  const base = Math.round(agente.z ?? agente.elevacao ?? 0);
  for (const dist of [0.5, 0.85]) {
    const zFrente = alturaSobPes(
      agente.x + nx * dist,
      agente.y + ny * dist,
      base + 1.6,
    );
    if (zFrente === base + 1) return true;
  }
  return false;
}

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
  const elev = agente.elevacao ?? agente.z;
  const zAqui = alturaSobPes(agente.x, agente.y, elev);
  const zAlvo = nav.planarAlvo.z;
  if (zAlvo > zAqui) return false;
  return distPlanar(agente, nav) >= PATH_GLIDE_DIST_MIN;
}

/** Abre asa só depois do ápice (senão corta o pulo de degrau/+1). */
function deveAbrirAsaAgora(agente, querAbrir) {
  if (!querAbrir || estaPlanando(agente) || !podeAbrirAsaDelta(agente)) {
    return false;
  }
  return (agente.vz ?? 0) <= 0.2;
}

/**
 * Fallback heurístico: queda longa sem path de glide (ex.: saiu da beirada).
 * Pathfinding continua mandando; isto só evita cair sem asa.
 */
function querAsaHeuristica(agente, querPlanar, querEscalar) {
  if (
    !agente.perfil?.podePlanar ||
    querEscalar ||
    agente.escalando ||
    agente.mantle ||
    agente.voando ||
    agente.nadando ||
    agente.aguaCaindo
  ) {
    return false;
  }
  if (querPlanar) return true;
  if (agente.noChao || estaPlanando(agente)) return false;
  const zChao = alturaSobPes(agente.x, agente.y, agente.elevacao);
  const folga = agente.elevacao - (zChao > 0 ? zChao : 0);
  return folga >= AGENTE_GLIDE_HEUR_FOLGA;
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
    voando: false,
    nadando: false,
    aguaSegura: null,
    afogandoT: 0,
    aguaProf: 0,
    aguaCaindo: 0,
    escalando: false,
    escalada: null,
    hopLift: 0,
    animT: 0,
    andando: false,
    acao: "agente",
    agente: true,
    correndo: false,
    coyoteT: 0,
    puloCortado: false,
    segurarPulo: false,
    puloBufferT: 0,
    tempoAr: 0,
    mantle: null,
    travaEscalada: null,
    travaPosMantle: null,
    _glideTempo: 0,
    _glideYaw: 0,
    _glideBank: 0,
    _climbInX: 0,
    _climbInY: -1,
  };
  iniciarStamina(agente);
  garantirNav(agente);
  return agente;
}

/** Completa campos de locomoção para um corpo que vai seguir como o companheiro. */
export function garantirCorpoLocomocao(corpo, perfil) {
  if (!corpo) return;
  if (perfil) corpo.perfil = perfil;
  if (corpo._loco) return;
  corpo._loco = true;
  if (corpo.vz == null) corpo.vz = 0;
  if (corpo.noChao == null) corpo.noChao = true;
  if (corpo.pulando == null) corpo.pulando = false;
  if (corpo.planando == null) corpo.planando = false;
  if (corpo.voando == null) corpo.voando = false;
  if (corpo.nadando == null) corpo.nadando = false;
  if (corpo.escalando == null) corpo.escalando = false;
  if (corpo.escalada == null) corpo.escalada = null;
  if (corpo.hopLift == null) corpo.hopLift = 0;
  if (corpo.coyoteT == null) corpo.coyoteT = 0;
  if (corpo.puloCortado == null) corpo.puloCortado = false;
  if (corpo.segurarPulo == null) corpo.segurarPulo = false;
  if (corpo.puloBufferT == null) corpo.puloBufferT = 0;
  if (corpo.tempoAr == null) corpo.tempoAr = 0;
  if (corpo.mantle == null) corpo.mantle = null;
  if (corpo.correndo == null) corpo.correndo = false;
  if (corpo.afogandoT == null) corpo.afogandoT = 0;
  if (corpo.aguaProf == null) corpo.aguaProf = 0;
  if (corpo.aguaCaindo == null) corpo.aguaCaindo = 0;
  if (corpo._climbInX == null) corpo._climbInX = 0;
  if (corpo._climbInY == null) corpo._climbInY = -1;
  if (corpo.stamina == null) iniciarStamina(corpo);
  garantirNav(corpo);
}

export { resetarNav };

/**
 * Segue o líder via pathfinding (sem teleporte).
 * Velocidade = AGENTE_VEL_MUL × walk/sprint do líder.
 */
export function atualizarAgente(agente, lider, dt, velPedido = 0, distSeguir = 0) {
  if (!agente || !lider) return;

  const podeCorrer = agente.perfil?.podeCorrer !== false;
  const velLider =
    podeCorrer && lider.correndo ? VELOCIDADE_SPRINT : VELOCIDADE_MAX;
  let velMax = velPedido > 0 ? velPedido : velLider * AGENTE_VEL_MUL;

  const redeCmd = pensarSeguir(agente, lider, dt, distSeguir);
  const navCmd = redeCmd || atualizarSeguirCaminho(agente, lider, dt, distSeguir);
  let ix = navCmd.ix;
  let iy = navCmd.iy;
  const querPulo = navCmd.querPulo;
  const querPlanar = navCmd.querPlanar;
  const querEscalar = navCmd.querEscalar;
  const querVoar = navCmd.querVoar;
  const soltarAsa = navCmd.soltarAsa;
  const soltarParede = navCmd.soltarParede;
  const nav = agente.nav;
  const passo = aplicarEspacoSeguir(agente, lider, ix, iy, velMax, distSeguir);
  ix = passo.ix;
  iy = passo.iy;
  velMax = passo.velMax;

  if (soltarAsa && estaPlanando(agente)) {
    fecharAsaDelta(agente);
    nav.planarAlvo = null;
  }

  // —— Mantle ——
  if (agente.mantle) {
    const ainda = atualizarMantle(agente, dt);
    agente.andando = false;
    if (ainda) return;
  }

  // —— Escalando: sobe, ou solta a parede pra asa/voo ——
  let soltouPraAsa = false;
  if (agente.escalando && agente.escalada) {
    if (soltarParede || querVoar || (querPlanar && !querEscalar)) {
      soltarEscalada(agente, {
        impulso: true,
        motivo: querVoar ? "voo" : "asa-delta",
      });
      soltouPraAsa = !querVoar;
      if (!querVoar) {
        agente.tempoAr = Math.max(agente.tempoAr ?? 0, ASA_DELTA_ABRIR_APOS);
      }
    } else {
      const cinX = agente._climbInX || 0;
      const cinY = agente._climbInY || -1;
      agente.hopLift = atualizarEscalada(agente, dt, cinX, cinY);
      agente.andando = false;
      agente.vx = 0;
      agente.vy = 0;
      agente.animT += dt;
      if (agente.escalando || agente.mantle) return;
    }
  }

  if (ix !== 0 || iy !== 0) {
    const rumo = Math.hypot(ix, iy) || 1;
    agente.dirX = ix / rumo;
    agente.dirY = iy / rumo;
    agente.facing = facingDeDir(ix, iy);
  }

  // —— Voo livre (path TIPO_VOO / seguir líder) ——
  if (agente.perfil?.podeVoar && (querVoar || estaVoando(agente))) {
    if (querVoar && !estaVoando(agente)) entrarVoo(agente);
    if (estaVoando(agente)) {
      if (!querVoar) {
        sairVoo(agente, { pousar: true });
        regenerarStamina(agente, dt);
        return;
      }
      const alvo = nav?.vooAlvo || {
        x: lider.x,
        y: lider.y,
        z: lider.elevacao ?? lider.z,
      };
      atualizarVooAteAlvo(agente, alvo, dt, velMax);
      regenerarStamina(agente, dt);
      return;
    }
  } else if (estaVoando(agente)) {
    sairVoo(agente, { pousar: false });
  }

  // Path/heurística pediu climb — inclusive saindo da asa-delta no ar
  if (
    querEscalar &&
    !soltouPraAsa &&
    !querVoar &&
    !agente.escalando &&
    !agente.mantle &&
    !estaVoando(agente) &&
    (agente.perfil?.podeEscalar || agente.perfil?.podeCachoeira)
  ) {
    if (estaPlanando(agente)) fecharAsaDelta(agente);
    if (tentarGrudarClimb(agente, ix, iy)) return;
  }

  const lancarGlide =
    deveLancarGlide(agente, nav, querPlanar) &&
    !querEscalar &&
    !querVoar &&
    !agente.escalando;
  // Após soltar parede, querPlanar/heurística abrem asa no ar
  const abrirAsa =
    !querEscalar &&
    !querVoar &&
    !agente.escalando &&
    !estaVoando(agente) &&
    querAsaHeuristica(agente, querPlanar || soltouPraAsa || !!soltarParede, false);

  const lip = degrauDeUm(agente, ix, iy);
  if (
    (querPulo || lip) &&
    !lancarGlide &&
    !querEscalar &&
    !querVoar &&
    podeIniciarPulo(agente)
  ) {
    iniciarPulo(agente);
    // Segura o pulo (como Space) pra limpar degrau de 1 bloco
    agente.segurarPulo = true;
    agente.puloCortado = false;
  }

  if (lancarGlide && agente.noChao && podeIniciarPulo(agente)) {
    const zAqui = alturaSobPes(agente.x, agente.y, agente.z);
    const sx = Math.sign(ix || agente.dirX) || 0;
    const sy = Math.sign(iy || agente.dirY) || 0;
    let naBeirada = false;
    for (const dist of [0.45, 0.7, 1.05]) {
      const zFrente = alturaSobPes(
        agente.x + sx * dist,
        agente.y + sy * dist,
        agente.z,
      );
      if (zFrente <= 0 || zFrente <= zAqui - 2) {
        naBeirada = true;
        break;
      }
    }
    if (naBeirada) {
      iniciarPulo(agente);
      agente.segurarPulo = false;
      agente.puloCortado = true;
      agente.vz = Math.sqrt(2 * GRAVIDADE * PATH_GLIDE_PULO_BONUS);
    }
  }

  if (agente.nadando && !agente.escalando && !estaVoando(agente)) {
    atualizarNado(agente, ix, iy, dt);
    return;
  }

  if (agente.noChao) {
    if (estaPlanando(agente)) fecharAsaDelta(agente);

    const fase = inicioPassoChao(agente, velMax);
    if (fase === "nado") {
      atualizarNado(agente, ix, iy, dt);
      return;
    }
    if (fase === "queda") {
      iniciarQueda(agente);
      agente.elevacao = agente.z;
      atualizarAereo(agente, dt);
      agente.andando = false;
      return;
    }

    const vel = agente._velAgua ?? velMax;
    const comCorrente = aplicarCorrenteChao(agente, ix, iy, dt);
    const movendo =
      comCorrente == null
        ? atualizarCorrida(agente, ix, iy, dt, true, vel)
        : comCorrente;
    const novo = moverComColisao(agente, agente.vx * dt, agente.vy * dt, "andar");
    if (novo.bloqueouX) agente.vx = 0;
    if (novo.bloqueouY) agente.vy = 0;
    agente.x = novo.x;
    agente.y = novo.y;

    const depois = fimPassoChao(agente);
    if (depois === "nado") {
      atualizarNado(agente, ix, iy, dt);
      return;
    }

    const zChao = alturaSobPes(agente.x, agente.y, agente.z);
    if (zChao <= 0 || zChao < agente.z) {
      iniciarQueda(agente);
      agente.elevacao = agente.z;
      if (deveAbrirAsaAgora(agente, abrirAsa || lancarGlide)) abrirAsaDelta(agente);
      if (estaPlanando(agente)) {
        atualizarNoArPlanando(agente, ix, iy, dt);
      } else {
        atualizarAereo(agente, dt);
        if (deveAbrirAsaAgora(agente, abrirAsa || lancarGlide)) abrirAsaDelta(agente);
      }
      agente.andando = false;
      regenerarStamina(agente, dt);
      return;
    }

    if (!agente.pulando) {
      agente.z = zChao;
      agente.elevacao = zChao;
      agente.hopLift = 0;
      agente.vz = 0;
    }

    if (querEscalar && !agente.escalando && tentarGrudarClimb(agente, ix, iy)) {
      return;
    }

    agente.correndo = velMax >= VELOCIDADE_SPRINT - 0.05;
    agente.andando = Math.hypot(agente.vx, agente.vy) > 0.45;
    if (agente.andando) {
      agente.animT += dt * ritmoAndar(Math.hypot(agente.vx, agente.vy), VELOCIDADE_MAX);
    }

    if (nav?.estado === "semCaminho") agente.acao = "sem-caminho";
    else if (nav?.estado === "buscando") agente.acao = "buscando-path";
    else if (querVoar) agente.acao = "indo-voar";
    else if (querEscalar) agente.acao = "indo-escalar";
    else if (agente.aguaProf > 0.2) agente.acao = agente.andando ? "vadeando" : "vado";
    else if (agente.andando) agente.acao = "seguindo";
    else agente.acao = "parado";

    regenerarStamina(agente, dt);
  } else {
    const zAlvo = nav?.planarAlvo?.z;
    const glidePath =
      !soltarAsa &&
      !querEscalar &&
      querPlanar &&
      (zAlvo == null || zAlvo <= agente.z + 0.1);
    const querAbrir =
      glidePath ||
      soltouPraAsa ||
      (!soltarAsa && querAsaHeuristica(agente, querPlanar || soltouPraAsa, querEscalar));
    if (deveAbrirAsaAgora(agente, querAbrir && !querEscalar)) abrirAsaDelta(agente);

    // Prioridade: grudar na parede (fecha asa se estiver planando)
    if (querEscalar && !soltouPraAsa && !querVoar) {
      if (estaPlanando(agente)) fecharAsaDelta(agente);
      if (tentarGrudarClimb(agente, ix, iy)) return;
    }

    if (estaPlanando(agente) && !soltarAsa && !querEscalar) {
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
      if (deveAbrirAsaAgora(agente, querAbrir && !querEscalar)) {
        abrirAsaDelta(agente);
      }
      if (estaPlanando(agente) && !soltarAsa && !querEscalar) {
        atualizarNoArPlanando(agente, ix, iy, dt);
      } else if (!agente.escalando && !agente.noChao) {
        agente.acao = agente.vz > 0.4 ? "pulando" : "caindo";
      }
    }
    agente.andando = false;
  }
}

function tentarGrudarClimb(agente, ix, iy) {
  const perfil = agente.perfil || {};
  if (!perfil.podeEscalar && !perfil.podeCachoeira) return false;
  const res = tentarEscalar(agente);
  if (!res?.ok) return false;
  const queda = !!res.escalada?.cachoeira;
  if (queda && !perfil.podeCachoeira) return false;
  if (!queda && !perfil.podeEscalar) return false;
  const cinX = ix;
  const cinY = iy;
  agente._climbInX = cinX;
  agente._climbInY = cinY;
  anexarEscalada(agente, res, cinX, cinY);
  agente.hopLift = atualizarEscalada(agente, 0, cinX, cinY);
  agente.andando = false;
  agente.acao = "escalando";
  return true;
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
