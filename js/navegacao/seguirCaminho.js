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
 * Retorna { ix, iy, querPulo } pra física do agente.
 */
export function atualizarSeguirCaminho(agente, lider, dt) {
  const nav = garantirNav(agente);
  const perfil = agente.perfil;
  const dist = Math.hypot(lider.x - agente.x, lider.y - agente.y);

  if (dist <= AGENTE_DIST_PARAR) {
    nav.estado = "idle";
    nav.path = null;
    nav.idx = 0;
    nav.puloAlvo = null;
    nav.stuckT = 0;
    cancelarPath(agente.id);
    return { ix: 0, iy: 0, querPulo: false };
  }

  const goalCx = Math.floor(lider.x);
  const goalCy = Math.floor(lider.y);
  const startCx = Math.floor(agente.x);
  const startCy = Math.floor(agente.y);
  const goalMudou = goalCx !== nav.goalCx || goalCy !== nav.goalCy;

  if (goalMudou || (!nav.path && nav.estado !== "buscando")) {
    pedirPath(agente, nav, startCx, startCy, goalCx, goalCy);
  } else if (nav.estado === "semCaminho") {
    nav.retryT -= dt;
    if (nav.retryT <= 0) {
      pedirPath(agente, nav, startCx, startCy, goalCx, goalCy);
    }
  }

  const res = obterResultadoPath(agente.id);
  if (
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
  } else if (nav.estado === "buscando" && !nav.path) {
    const dx = lider.x - agente.x;
    const dy = lider.y - agente.y;
    const d = Math.hypot(dx, dy) || 1;
    return { ix: dx / d, iy: dy / d, querPulo: false };
  }

  if (nav.estado === "semCaminho") {
    if (!nav.path || nav.idx >= (nav.path.cells?.length ?? 0)) {
      return { ix: 0, iy: 0, querPulo: false };
    }
  }

  if (!nav.path?.cells?.length) {
    return { ix: 0, iy: 0, querPulo: false };
  }

  while (nav.idx < nav.path.cells.length) {
    const wp = nav.path.cells[nav.idx];
    const tx = wp.cx + 0.5;
    const ty = wp.cy + 0.5;
    if (Math.hypot(tx - agente.x, ty - agente.y) < 0.4) {
      nav.idx++;
      continue;
    }
    break;
  }

  if (nav.idx >= nav.path.cells.length) {
    nav.path = null;
    if (nav.estado === "semCaminho") {
      return { ix: 0, iy: 0, querPulo: false };
    }
    pedirPath(agente, nav, startCx, startCy, goalCx, goalCy);
    return { ix: 0, iy: 0, querPulo: false };
  }

  const wp = nav.path.cells[nav.idx];
  const tx = wp.cx + 0.5;
  const ty = wp.cy + 0.5;
  const dx = tx - agente.x;
  const dy = ty - agente.y;
  const d = Math.hypot(dx, dy) || 1;

  const prog = Math.hypot(agente.x - nav.lastX, agente.y - nav.lastY);
  if (prog < 0.03) nav.stuckT += dt;
  else nav.stuckT = 0;
  nav.lastX = agente.x;
  nav.lastY = agente.y;

  if (nav.stuckT >= PATH_STUCK_SEG) {
    nav.stuckT = 0;
    nav.path = null;
    pedirPath(agente, nav, startCx, startCy, goalCx, goalCy);
    return { ix: dx / d, iy: dy / d, querPulo: false };
  }

  let querPulo = false;
  if (agente.noChao && perfil.podePular) {
    const zAqui = alturaSobPes(agente.x, agente.y);
    const zWp = alturaEm(wp.cx, wp.cy);
    if (zWp === zAqui + 1 && Math.hypot(dx, dy) < 1.15) {
      querPulo = true;
      nav.puloAlvo = { x: tx, y: ty, z: zWp };
    }
  }

  return { ix: dx / d, iy: dy / d, querPulo };
}

/** Células do path atual (debug). */
export function obterPathDebug(agente) {
  const nav = agente?.nav;
  if (!nav?.path?.cells) return null;
  return nav.path;
}
