import {
  AGENTE_DIST_PARAR,
  PATH_RETRY_SEM_CAMINHO,
  PATH_STUCK_SEG,
} from "../config.js";
import { alturaEm } from "../mundo/altura.js";
import { alturaSobPes } from "../fisica/colisao.js";
import {
  cancelarPath,
  obterResultadoPath,
  solicitarPath,
} from "./filaPath.js";
import { TIPO_CLIMB, TIPO_GLIDE } from "./navGrade.js";

function idleNav(extras = {}) {
  return {
    ix: 0,
    iy: 0,
    querPulo: false,
    querPlanar: false,
    querEscalar: false,
    soltarAsa: false,
    soltarParede: false,
    ...extras,
  };
}

/**
 * Estado de navegação embutido no agente (cria se faltar).
 */
export function garantirNav(agente) {
  if (agente.nav) return agente.nav;
  agente.nav = {
    path: null,
    idx: 0,
    versao: 0,
    pathAplicadoVersao: -1,
    goalCx: -1,
    goalCy: -1,
    estado: "idle", // idle | buscando | seguindo | semCaminho
    stuckT: 0,
    lastX: agente.x,
    lastY: agente.y,
    retryT: 0,
    puloAlvo: null,
    planarAlvo: null,
    climbAlvo: null,
  };
  return agente.nav;
}

export function resetarNav(agente) {
  if (!agente) return;
  cancelarPath(agente.id);
  agente.nav = null;
  garantirNav(agente);
}

function pedirPath(agente, nav, sx, sy, gx, gy) {
  nav.versao++;
  nav.goalCx = gx;
  nav.goalCy = gy;
  solicitarPath(agente.id, agente.perfil, sx, sy, gx, gy, nav.versao);
  nav.estado = "buscando";
  nav.retryT = PATH_RETRY_SEM_CAMINHO;
}

/** Escolhe o 1º waypoint à frente (não atrás) do agente. */
function indiceWaypointInicial(cells, ax, ay) {
  if (!cells?.length) return 0;
  const cx = Math.floor(ax);
  const cy = Math.floor(ay);
  let idx = 0;
  while (idx < cells.length - 1) {
    const c = cells[idx];
    const tx = c.cx + 0.5;
    const ty = c.cy + 0.5;
    const naCelula = c.cx === cx && c.cy === cy;
    const perto = Math.hypot(tx - ax, ty - ay) < 0.55;
    if (naCelula || perto) {
      idx++;
      continue;
    }
    break;
  }
  return idx;
}

/**
 * Atualiza pedido de path / segue waypoints.
 * Retorna { ix, iy, querPulo, querPlanar }.
 */
export function atualizarSeguirCaminho(agente, lider, dt) {
  const nav = garantirNav(agente);
  const perfil = agente.perfil;
  const dist = Math.hypot(lider.x - agente.x, lider.y - agente.y);
  const planando = !!agente.planando;
  const naParede = !!agente.escalando && !agente.mantle;
  const noMantle = !!agente.mantle;

  if (dist <= AGENTE_DIST_PARAR && !planando && !naParede && !noMantle) {
    nav.estado = "idle";
    nav.path = null;
    nav.idx = 0;
    nav.puloAlvo = null;
    nav.planarAlvo = null;
    nav.climbAlvo = null;
    nav.stuckT = 0;
    cancelarPath(agente.id);
    return idleNav();
  }

  const goalCx = Math.floor(lider.x);
  const goalCy = Math.floor(lider.y);
  const startCx = Math.floor(agente.x);
  const startCy = Math.floor(agente.y);
  const goalMudou = goalCx !== nav.goalCx || goalCy !== nav.goalCy;

  // Mid-glide: não repath. Climb: repath se o líder mudou de célula (pode virar asa)
  if (!planando) {
    if (goalMudou || (!nav.path && nav.estado !== "buscando")) {
      pedirPath(agente, nav, startCx, startCy, goalCx, goalCy);
    } else if (nav.estado === "semCaminho") {
      nav.retryT -= dt;
      if (nav.retryT <= 0) {
        pedirPath(agente, nav, startCx, startCy, goalCx, goalCy);
      }
    }
  }

  const res = obterResultadoPath(agente.id);
  if (
    !planando &&
    !noMantle &&
    res?.estado === "pronto" &&
    res.path &&
    res.versao === nav.versao &&
    nav.pathAplicadoVersao !== nav.versao
  ) {
    nav.path = res.path;
    nav.pathAplicadoVersao = nav.versao;
    nav.idx = indiceWaypointInicial(nav.path.cells, agente.x, agente.y);
    nav.estado = res.path.achou ? "seguindo" : "semCaminho";
    if (!res.path.achou) nav.retryT = PATH_RETRY_SEM_CAMINHO;
    nav.stuckT = 0;
  } else if (nav.estado === "buscando" && !nav.path && !planando && !naParede) {
    const dx = lider.x - agente.x;
    const dy = lider.y - agente.y;
    const d = Math.hypot(dx, dy) || 1;
    return idleNav({ ix: dx / d, iy: dy / d });
  }

  if (nav.estado === "semCaminho") {
    if (!nav.path || nav.idx >= (nav.path.cells?.length ?? 0)) {
      return idleNav();
    }
  }

  if (!nav.path?.cells?.length) {
    return idleNav();
  }

  while (nav.idx < nav.path.cells.length) {
    const wp = nav.path.cells[nav.idx];
    const tx = wp.cx + 0.5;
    const ty = wp.cy + 0.5;
    const raio = wp.tipo === TIPO_GLIDE ? 0.55 : 0.4;
    if (Math.hypot(tx - agente.x, ty - agente.y) < raio && agente.noChao) {
      nav.idx++;
      continue;
    }
    if (
      (wp.tipo === TIPO_GLIDE || wp.tipo === TIPO_CLIMB) &&
      agente.noChao &&
      Math.floor(agente.x) === wp.cx &&
      Math.floor(agente.y) === wp.cy
    ) {
      nav.idx++;
      continue;
    }
    break;
  }

  if (nav.idx >= nav.path.cells.length) {
    nav.path = null;
    nav.planarAlvo = null;
    nav.climbAlvo = null;
    if (nav.estado === "semCaminho") {
      return idleNav({ soltarAsa: planando });
    }
    if (!ocupadoAr) pedirPath(agente, nav, startCx, startCy, goalCx, goalCy);
    return idleNav({ soltarAsa: planando });
  }

  const wp = nav.path.cells[nav.idx];
  const tx = wp.cx + 0.5;
  const ty = wp.cy + 0.5;
  const dx = tx - agente.x;
  const dy = ty - agente.y;
  const d = Math.hypot(dx, dy) || 1;

  const zWp = alturaEm(wp.cx, wp.cy);
  const zChaoPes = alturaSobPes(agente.x, agente.y);
  const zRef = naParede ? agente.elevacao : zChaoPes;
  // Na parede: glide se o pouso está abaixo da elevação atual
  const segmentoGlide =
    wp.tipo === TIPO_GLIDE && zWp <= zRef + 0.05;
  const segmentoClimb =
    !!perfil.podeEscalar &&
    wp.tipo === TIPO_CLIMB &&
    zWp > zChaoPes &&
    !segmentoGlide;

  if (segmentoGlide) {
    nav.planarAlvo = { x: tx, y: ty, cx: wp.cx, cy: wp.cy, z: zWp };
  } else if (!planando && !naParede) {
    nav.planarAlvo = null;
  }

  if (segmentoClimb) {
    nav.climbAlvo = { x: tx, y: ty, cx: wp.cx, cy: wp.cy, z: zWp };
  } else if (!naParede && !noMantle) {
    nav.climbAlvo = null;
  }

  const distPouso = nav.planarAlvo
    ? Math.hypot(nav.planarAlvo.x - agente.x, nav.planarAlvo.y - agente.y)
    : Infinity;
  const sobrePouso =
    planando &&
    nav.planarAlvo &&
    (distPouso < 0.75 ||
      (Math.floor(agente.x) === nav.planarAlvo.cx &&
        Math.floor(agente.y) === nav.planarAlvo.cy));

  let querPlanar = !!perfil.podePlanar && segmentoGlide && !sobrePouso;
  if (planando && !sobrePouso && nav.planarAlvo) querPlanar = true;

  // Soltar parede → asa (path pediu glide, ou líder bem mais baixo — mesmo com climb no path)
  const folgaParede = naParede
    ? agente.elevacao - (agente.escalada?.zBase ?? zChaoPes)
    : 0;
  const liderZ = lider.elevacao ?? lider.z ?? 0;
  const liderMaisBaixo = liderZ <= agente.elevacao - 2.5;
  const soltarParede =
    naParede &&
    !!perfil.podePlanar &&
    (segmentoGlide ||
      (folgaParede >= 2.2 && liderMaisBaixo && dist > 2.5));

  if (soltarParede) {
    nav.climbAlvo = null;
    if (!segmentoGlide || !nav.planarAlvo) {
      nav.planarAlvo = {
        x: lider.x,
        y: lider.y,
        cx: goalCx,
        cy: goalCy,
        z: Math.floor(liderZ || 1),
      };
    }
    querPlanar = true;
  }

  // No ar com alvo de pouso: mantém asa e não reagarra a parede
  const caindoPraAsa =
    !!perfil.podePlanar &&
    !!nav.planarAlvo &&
    !sobrePouso &&
    !agente.noChao &&
    !naParede &&
    !noMantle;
  if (caindoPraAsa) querPlanar = true;

  const soltarAsa = !!sobrePouso;
  // querEscalar = path ainda quer subir; não “prende” só porque já está na parede
  const querEscalar =
    (segmentoClimb || noMantle) &&
    !soltarParede &&
    !querPlanar &&
    !caindoPraAsa;

  const prog = Math.hypot(agente.x - nav.lastX, agente.y - nav.lastY);
  if (!planando && !naParede && !noMantle && !segmentoClimb) {
    if (prog < 0.03) nav.stuckT += dt;
    else nav.stuckT = 0;
  } else {
    nav.stuckT = 0;
  }
  nav.lastX = agente.x;
  nav.lastY = agente.y;

  if (
    !planando &&
    !naParede &&
    !noMantle &&
    !segmentoClimb &&
    nav.stuckT >= PATH_STUCK_SEG
  ) {
    nav.stuckT = 0;
    nav.path = null;
    pedirPath(agente, nav, startCx, startCy, goalCx, goalCy);
    return idleNav({ ix: dx / d, iy: dy / d });
  }

  let querPulo = false;
  if (
    agente.noChao &&
    perfil.podePular &&
    !segmentoGlide &&
    !segmentoClimb &&
    !naParede
  ) {
    if (zWp === zChaoPes + 1 && Math.hypot(dx, dy) < 1.15) {
      querPulo = true;
      nav.puloAlvo = { x: tx, y: ty, z: zWp };
    }
  }

  return {
    ix: dx / d,
    iy: dy / d,
    querPulo,
    querPlanar: querPlanar || soltarParede,
    querEscalar,
    soltarAsa,
    soltarParede,
  };
}

/** Células do path atual (debug). */
export function obterPathDebug(agente) {
  const nav = agente?.nav;
  if (!nav?.path?.cells) return null;
  return nav.path;
}
