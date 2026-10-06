import {
  AGENTE_DIST_PARAR,
  PATH_RETRY_SEM_CAMINHO,
  PATH_STUCK_SEG,
} from "../config.js";
import { alturaEm } from "../mundo/altura.js";
import { alturaSobPes } from "../fisica/colisao.js";
import { encontrarFacePerto } from "../mundo/facesCliff.js";
import {
  cancelarPath,
  obterResultadoPath,
  solicitarPath,
} from "./filaPath.js";
import { TIPO_CLIMB, TIPO_GLIDE, TIPO_VOO } from "./navGrade.js";

function idleNav(extras = {}) {
  return {
    ix: 0,
    iy: 0,
    querPulo: false,
    querPlanar: false,
    querEscalar: false,
    querVoar: false,
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
    vooAlvo: null,
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

/**
 * No ar: gruda só se o líder está claramente ACIMA.
 * Nunca se o path pede descer — senão loop descer→escalar→descer.
 */
function decidirClimbNoAr(agente, lider, liderZ) {
  const elevAg = agente.elevacao ?? agente.z ?? 0;
  const face = encontrarFacePerto(agente.x, agente.y, elevAg);
  if (!face) return null;

  const naFaixa = elevAg >= face.zBase + 0.05 && elevAg <= face.zTopo + 0.35;
  if (!naFaixa) return null;

  const nav = agente.nav;
  if (nav?.path?.cells && nav.idx < nav.path.cells.length) {
    const wp = nav.path.cells[nav.idx];
    const zWp = alturaEm(wp.cx, wp.cy);
    // Path pedindo descer / walk / glide → não climb
    if (wp.tipo !== TIPO_CLIMB && zWp <= elevAg + 0.15) {
      // #region agent log
      if (!decidirClimbNoAr.__last || performance.now() - decidirClimbNoAr.__last > 500) {
        fetch('http://127.0.0.1:7578/ingest/2d17c26e-34d3-4e31-ad4f-513a36a051d1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ac17a'},body:JSON.stringify({sessionId:'8ac17a',runId:'post-fix4',hypothesisId:'ClimbLoop',location:'seguirCaminho.js:decidirClimbNoAr',message:'climb_skip_path_down',data:{elevAg:+elevAg.toFixed(2),liderZ:+liderZ.toFixed(2),zWp,tipo:wp.tipo,cx:wp.cx,cy:wp.cy},timestamp:Date.now()})}).catch(()=>{});
        decidirClimbNoAr.__last = performance.now();
      }
      // #endregion
      return null;
    }
  }

  // Só sobe se líder está acima do agente (não “quase no topo da face”)
  const precisaSubir = liderZ >= elevAg + 1.15 || !!lider.escalando;
  if (!precisaSubir) {
    // #region agent log
    if (!decidirClimbNoAr.__last2 || performance.now() - decidirClimbNoAr.__last2 > 500) {
      fetch('http://127.0.0.1:7578/ingest/2d17c26e-34d3-4e31-ad4f-513a36a051d1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ac17a'},body:JSON.stringify({sessionId:'8ac17a',runId:'post-fix4',hypothesisId:'ClimbLoop',location:'seguirCaminho.js:decidirClimbNoAr',message:'climb_skip_leader_not_above',data:{elevAg:+elevAg.toFixed(2),liderZ:+liderZ.toFixed(2),zTopo:face.zTopo},timestamp:Date.now()})}).catch(()=>{});
      decidirClimbNoAr.__last2 = performance.now();
    }
    // #endregion
    return null;
  }

  const ax = face.ancoraX - agente.x;
  const ay = face.ancoraY - agente.y;
  const ad = Math.hypot(ax, ay) || 1;
  // #region agent log
  fetch('http://127.0.0.1:7578/ingest/2d17c26e-34d3-4e31-ad4f-513a36a051d1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ac17a'},body:JSON.stringify({sessionId:'8ac17a',runId:'post-fix4',hypothesisId:'ClimbLoop',location:'seguirCaminho.js:decidirClimbNoAr',message:'climb_air_grab',data:{elevAg:+elevAg.toFixed(2),liderZ:+liderZ.toFixed(2),zTopo:face.zTopo},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return {
    ix: ax / ad,
    iy: ay / ad,
    climbAlvo: {
      x: face.ancoraX,
      y: face.ancoraY,
      cx: face.cx,
      cy: face.cy,
      z: face.zTopo,
    },
  };
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
  const voando = !!agente.voando;
  const naParede = !!agente.escalando && !agente.mantle;
  const noMantle = !!agente.mantle;

  const liderZ = lider.elevacao ?? lider.z ?? 0;
  const gapElev = Math.abs((agente.elevacao ?? agente.z ?? 0) - liderZ);

  // #region agent log
  if (!atualizarSeguirCaminho.__lastProc || performance.now() - atualizarSeguirCaminho.__lastProc > 400) {
    const ax = agente.x | 0, ay = agente.y | 0, lx = lider.x | 0, ly = lider.y | 0;
    const zAg = alturaEm(ax, ay);
    const zLid = alturaEm(lx, ly);
    fetch('http://127.0.0.1:7578/ingest/2d17c26e-34d3-4e31-ad4f-513a36a051d1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ac17a'},body:JSON.stringify({sessionId:'8ac17a',runId:'proc-follow',hypothesisId:'H-Unload,H-NavFar,H-ModeOsc',location:'seguirCaminho.js:atualizarSeguirCaminho',message:'comp_follow_tick',data:{dist:+dist.toFixed(1),gapElev:+gapElev.toFixed(2),estado:nav.estado,ax,ay,lx,ly,zAg,zLid,chunkAg:zAg>0,chunkLid:zLid>0,voando,planando,liderVoando:!!lider.voando,noChao:!!agente.noChao,elev:+(agente.elevacao??0).toFixed(2),liderZ:+liderZ.toFixed(2),goalCx:nav.goalCx,goalCy:nav.goalCy,pathLen:nav.path?.cells?.length??0,idx:nav.idx|0},timestamp:Date.now()})}).catch(()=>{});
    atualizarSeguirCaminho.__lastProc = performance.now();
  }
  // #endregion

  if (
    dist <= AGENTE_DIST_PARAR &&
    gapElev < 1.5 &&
    !planando &&
    !voando &&
    !naParede &&
    !noMantle
  ) {
    nav.estado = "idle";
    nav.path = null;
    nav.idx = 0;
    nav.puloAlvo = null;
    nav.planarAlvo = null;
    nav.climbAlvo = null;
    nav.vooAlvo = null;
    nav.stuckT = 0;
    cancelarPath(agente.id);
    return idleNav();
  }

  // Já voando ou líder em fly: retarget 3D (arestas TIPO_VOO cobrem o resto)
  if (!!perfil.podeVoar && !naParede && !noMantle && (voando || lider.voando)) {
    const goalCxL = Math.floor(lider.x);
    const goalCyL = Math.floor(lider.y);
    nav.vooAlvo = {
      x: lider.x,
      y: lider.y,
      cx: goalCxL,
      cy: goalCyL,
      z: liderZ,
    };
    nav.path = null;
    nav.planarAlvo = null;
    nav.climbAlvo = null;
    nav.stuckT = 0;
    nav.lastX = agente.x;
    nav.lastY = agente.y;
    const dxL = lider.x - agente.x;
    const dyL = lider.y - agente.y;
    const dL = Math.hypot(dxL, dyL) || 1;
    const chegou =
      dist <= AGENTE_DIST_PARAR * 1.2 && gapElev < 1.1 && !lider.voando;
    return {
      ix: dxL / dL,
      iy: dyL / dL,
      querPulo: false,
      querPlanar: false,
      querEscalar: false,
      querVoar: !chegou,
      soltarAsa: false,
      soltarParede: false,
    };
  }

  const goalCx = Math.floor(lider.x);
  const goalCy = Math.floor(lider.y);
  const startCx = Math.floor(agente.x);
  const startCy = Math.floor(agente.y);
  const goalMudou = goalCx !== nav.goalCx || goalCy !== nav.goalCy;
  const ocupadoAr = planando || voando || naParede || noMantle || !agente.noChao;

  // Voo: segue líder em 3D (retarget ao vivo)
  if (voando || (nav.vooAlvo && !agente.noChao && !!perfil.podeVoar && !naParede)) {
    nav.vooAlvo = {
      x: lider.x,
      y: lider.y,
      cx: goalCx,
      cy: goalCy,
      z: liderZ,
    };
    nav.planarAlvo = null;
    nav.climbAlvo = null;
    nav.path = null;
    nav.stuckT = 0;
    nav.lastX = agente.x;
    nav.lastY = agente.y;
    const dxL = lider.x - agente.x;
    const dyL = lider.y - agente.y;
    const dL = Math.hypot(dxL, dyL) || 1;
    const pertoEBaixo =
      dist <= AGENTE_DIST_PARAR * 1.4 &&
      Math.abs((agente.elevacao ?? 0) - liderZ) < 1.2 &&
      !lider.voando;
    return {
      ix: dxL / dL,
      iy: dyL / dL,
      querPulo: false,
      querPlanar: false,
      querEscalar: false,
      querVoar: !pertoEBaixo,
      soltarAsa: false,
      soltarParede: false,
    };
  }

  // No ar: prioridade grudar na face (asa-delta ou queda) se o líder está acima
  if (
    !!perfil.podeEscalar &&
    !naParede &&
    !noMantle &&
    !voando &&
    !agente.noChao
  ) {
    const climbAr = decidirClimbNoAr(agente, lider, liderZ);
    if (climbAr) {
      nav.planarAlvo = null;
      nav.vooAlvo = null;
      nav.climbAlvo = climbAr.climbAlvo;
      nav.stuckT = 0;
      nav.lastX = agente.x;
      nav.lastY = agente.y;
      return {
        ix: climbAr.ix,
        iy: climbAr.iy,
        querPulo: false,
        querPlanar: false,
        querEscalar: true,
        querVoar: false,
        soltarAsa: !!planando,
        soltarParede: false,
      };
    }
  }

  // No ar com asa (ou caindo pra abrir): segue o líder ao vivo — não o pouso antigo do A*
  if (
    !!perfil.podePlanar &&
    !naParede &&
    !noMantle &&
    !voando &&
    !agente.noChao &&
    (planando || nav.planarAlvo)
  ) {
    nav.planarAlvo = {
      x: lider.x,
      y: lider.y,
      cx: goalCx,
      cy: goalCy,
      z: Math.floor(liderZ || 1),
    };
    nav.climbAlvo = null;
    nav.vooAlvo = null;
    // Path do chão fica obsoleto no ar — ao pousar pede rota nova daqui
    nav.path = null;
    nav.stuckT = 0;
    nav.lastX = agente.x;
    nav.lastY = agente.y;
    const dxL = lider.x - agente.x;
    const dyL = lider.y - agente.y;
    const dL = Math.hypot(dxL, dyL) || 1;
    const zChaoAr = alturaSobPes(agente.x, agente.y);
    const folgaAr = agente.elevacao - (zChaoAr > 0 ? zChaoAr : 0);
    // Fecha asa só perto do líder e quase no chão; senão pousa natural com a asa
    const soltarAsa =
      planando && dist <= AGENTE_DIST_PARAR * 1.35 && folgaAr <= 1.15;
    return {
      ix: dxL / dL,
      iy: dyL / dL,
      querPulo: false,
      querPlanar: !soltarAsa,
      querEscalar: false,
      querVoar: false,
      soltarAsa,
      soltarParede: false,
    };
  }

  // Mid-glide/voo: não repath. No chão/climb: repath se o líder mudou de célula
  if (!planando && !voando) {
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
    !voando &&
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
  } else if (
    nav.estado === "buscando" &&
    !nav.path &&
    !planando &&
    !voando &&
    !naParede
  ) {
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
    const raio =
      wp.tipo === TIPO_GLIDE || wp.tipo === TIPO_VOO ? 0.55 : 0.4;
    if (Math.hypot(tx - agente.x, ty - agente.y) < raio && agente.noChao) {
      nav.idx++;
      continue;
    }
    if (
      (wp.tipo === TIPO_GLIDE ||
        wp.tipo === TIPO_CLIMB ||
        wp.tipo === TIPO_VOO) &&
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
    nav.vooAlvo = null;
    if (nav.estado === "semCaminho") {
      return idleNav();
    }
    if (!ocupadoAr) pedirPath(agente, nav, startCx, startCy, goalCx, goalCy);
    return idleNav();
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
  const segmentoVoo = !!perfil.podeVoar && wp.tipo === TIPO_VOO;
  // Na parede: glide se o pouso está abaixo da elevação atual
  const segmentoGlide =
    !segmentoVoo && wp.tipo === TIPO_GLIDE && zWp <= zRef + 0.05;
  const segmentoClimb =
    !!perfil.podeEscalar &&
    wp.tipo === TIPO_CLIMB &&
    zWp > zChaoPes &&
    !segmentoGlide &&
    !segmentoVoo;

  if (segmentoVoo) {
    nav.vooAlvo = { x: tx, y: ty, cx: wp.cx, cy: wp.cy, z: zWp };
  } else if (!voando) {
    nav.vooAlvo = null;
  }

  if (segmentoGlide) {
    nav.planarAlvo = { x: tx, y: ty, cx: wp.cx, cy: wp.cy, z: zWp };
  } else if (!naParede) {
    nav.planarAlvo = null;
  }

  if (segmentoClimb) {
    nav.climbAlvo = { x: tx, y: ty, cx: wp.cx, cy: wp.cy, z: zWp };
  } else if (!naParede && !noMantle) {
    nav.climbAlvo = null;
  }

  let querPlanar = !!perfil.podePlanar && segmentoGlide;
  let querVoar = segmentoVoo;

  // Soltar parede → asa / queda se path desce ou líder está abaixo
  const folgaParede = naParede
    ? agente.elevacao - (agente.escalada?.zBase ?? zChaoPes)
    : 0;
  const liderMaisBaixo = liderZ <= agente.elevacao - 1.2;
  const pathQuerDescer =
    naParede &&
    zWp < agente.elevacao - 0.35 &&
    wp.tipo !== TIPO_CLIMB;
  const soltarParede =
    naParede &&
    !querVoar &&
    (segmentoGlide ||
      pathQuerDescer ||
      (folgaParede >= 1.5 && liderMaisBaixo && dist > 1.5));

  if (soltarParede) {
    // #region agent log
    fetch('http://127.0.0.1:7578/ingest/2d17c26e-34d3-4e31-ad4f-513a36a051d1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ac17a'},body:JSON.stringify({sessionId:'8ac17a',runId:'post-fix4',hypothesisId:'ClimbLoop',location:'seguirCaminho.js:soltarParede',message:'climb_release',data:{pathQuerDescer,liderMaisBaixo,segmentoGlide,elev:+(agente.elevacao??0).toFixed(2),liderZ:+liderZ.toFixed(2),zWp,tipo:wp.tipo},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    nav.climbAlvo = null;
    nav.planarAlvo = {
      x: lider.x,
      y: lider.y,
      cx: goalCx,
      cy: goalCy,
      z: Math.floor(liderZ || 1),
    };
    querPlanar = !!perfil.podePlanar && (segmentoGlide || liderMaisBaixo);
  }

  // Na parede com path de voo: solta e voa
  if (naParede && querVoar) {
    return {
      ix: dx / d,
      iy: dy / d,
      querPulo: false,
      querPlanar: false,
      querEscalar: false,
      querVoar: true,
      soltarAsa: false,
      soltarParede: true,
    };
  }

  // querEscalar = path ainda quer subir; não “prende” só porque já está na parede
  const querEscalar =
    (segmentoClimb || noMantle) &&
    !soltarParede &&
    !querPlanar &&
    !querVoar;

  const prog = Math.hypot(agente.x - nav.lastX, agente.y - nav.lastY);
  if (
    !planando &&
    !voando &&
    !naParede &&
    !noMantle &&
    !segmentoClimb &&
    !segmentoVoo
  ) {
    if (prog < 0.03) nav.stuckT += dt;
    else nav.stuckT = 0;
  } else {
    nav.stuckT = 0;
  }
  nav.lastX = agente.x;
  nav.lastY = agente.y;

  if (
    !planando &&
    !voando &&
    !naParede &&
    !noMantle &&
    !segmentoClimb &&
    !segmentoVoo &&
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
    !segmentoVoo &&
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
    querVoar,
    soltarAsa: false,
    soltarParede,
  };
}

/** Células do path atual (debug). */
export function obterPathDebug(agente) {
  const nav = agente?.nav;
  if (!nav?.path?.cells) return null;
  return nav.path;
}
