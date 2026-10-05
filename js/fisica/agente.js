import {
  AGENTE_DIST_PARAR,
  AGENTE_GLIDE_HEUR_FOLGA,
  AGENTE_VEL_MUL,
  ASA_DELTA_ABRIR_APOS,
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
  anexarEscalada,
  atualizarEscalada,
  atualizarMantle,
  soltarEscalada,
  tentarEscalar,
} from "./escalada.js";
import {
  atualizarAereo,
  empurrarForaDeCliff,
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
    agente.voando
  ) {
    return false;
  }
  if (querPlanar) return true;
  if (agente.noChao || estaPlanando(agente)) return false;
  const zChao = alturaSobPes(agente.x, agente.y);
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

export { resetarNav };

/**
 * Segue o líder via pathfinding (sem teleporte).
 * Velocidade = AGENTE_VEL_MUL × walk/sprint do líder.
 */
export function atualizarAgente(agente, lider, dt) {
  if (!agente || !lider) return;

  const podeCorrer = agente.perfil?.podeCorrer !== false;
  const velLider =
    podeCorrer && lider.correndo ? VELOCIDADE_SPRINT : VELOCIDADE_MAX;
  const velMax = velLider * AGENTE_VEL_MUL;

  const {
    ix,
    iy,
    querPulo,
    querPlanar,
    querEscalar,
    querVoar,
    soltarAsa,
    soltarParede,
  } = atualizarSeguirCaminho(agente, lider, dt);
  const nav = agente.nav;

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
    // 8 dirs: ambos os eixos podem ficar ativos (igual WASD diagonal)
    agente.dirX = Math.sign(ix);
    agente.dirY = Math.sign(iy);
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

  // Path pediu climb: gruda na face (nunca reagarra se acabou de soltar pra asa)
  if (
    querEscalar &&
    !soltouPraAsa &&
    !querPlanar &&
    !querVoar &&
    !agente.escalando &&
    !agente.mantle &&
    !estaPlanando(agente) &&
    !estaVoando(agente) &&
    agente.perfil?.podeEscalar
  ) {
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

  if (
    querPulo &&
    !lancarGlide &&
    !querEscalar &&
    !querVoar &&
    podeIniciarPulo(agente)
  ) {
    iniciarPulo(agente);
    agente.puloCortado = true;
  }

  if (lancarGlide && agente.noChao && podeIniciarPulo(agente)) {
    const zAqui = alturaSobPes(agente.x, agente.y);
    const sx = Math.sign(ix || agente.dirX) || 0;
    const sy = Math.sign(iy || agente.dirY) || 0;
    let naBeirada = false;
    for (const dist of [0.45, 0.7, 1.05]) {
      const zFrente = alturaSobPes(agente.x + sx * dist, agente.y + sy * dist);
      if (zFrente <= 0 || zFrente <= zAqui - 2) {
        naBeirada = true;
        break;
      }
    }
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

    // Em climb, não empurra pra longe da parede
    if (!querEscalar && cantoEmCliffAlto(agente)) empurrarForaDeCliff(agente);

    if (querEscalar && !agente.escalando && tentarGrudarClimb(agente, ix, iy)) {
      return;
    }

    const dist = Math.hypot(lider.x - agente.x, lider.y - agente.y);
    agente.andando = movendo && dist > AGENTE_DIST_PARAR;
    if (agente.andando) agente.animT += dt;

    if (nav?.estado === "semCaminho") agente.acao = "sem-caminho";
    else if (nav?.estado === "buscando") agente.acao = "buscando-path";
    else if (querVoar) agente.acao = "indo-voar";
    else if (querEscalar) agente.acao = "indo-escalar";
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
    if (deveAbrirAsaAgora(agente, querAbrir)) abrirAsaDelta(agente);

    if (estaPlanando(agente) && !soltarAsa) {
      atualizarNoArPlanando(agente, ix, iy, dt);
    } else {
      if (
        querEscalar &&
        !querPlanar &&
        !soltouPraAsa &&
        tentarGrudarClimb(agente, ix, iy)
      ) {
        return;
      }

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
      if (deveAbrirAsaAgora(agente, querAbrir)) abrirAsaDelta(agente);
      if (estaPlanando(agente) && !soltarAsa) {
        atualizarNoArPlanando(agente, ix, iy, dt);
      } else {
        agente.acao = agente.vz > 0.4 ? "pulando" : "caindo";
      }
    }
    agente.andando = false;
  }
}

function tentarGrudarClimb(agente, ix, iy) {
  if (!agente.perfil?.podeEscalar) return false;
  const res = tentarEscalar(agente);
  if (!res?.ok) return false;
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
