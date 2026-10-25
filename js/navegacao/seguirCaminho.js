import {
  AGENTE_DIST_PARAR,
  AGENTE_GAP_ELEV_PARAR,
  PATH_RETRY_SEM_CAMINHO,
  PATH_STUCK_SEG,
} from "../config.js";
import { alturaSobPes } from "../fisica/colisao.js";
import { encontrarFacePerto } from "../mundo/facesCliff.js";
import {
  arestaCortaBase,
  resolverForaDeObstaculo,
} from "../fisica/obstaculos.js";
import {
  cancelarPath,
  limparCachePath,
  obterResultadoPath,
  solicitarPath,
} from "./filaPath.js";
import { TIPO_CLIMB, TIPO_GLIDE, TIPO_JUMP, TIPO_NADO, TIPO_VOO, TIPO_WALK, pisoMaisProximo } from "./navGrade.js";

const BLOQUEIO_WP_MS = 2800;

function marcarWpBloqueado(nav, cx, cy) {
  if (!nav.wpBloqueados) nav.wpBloqueados = new Map();
  nav.wpBloqueados.set(`${cx | 0},${cy | 0}`, performance.now() + BLOQUEIO_WP_MS);
}

function wpBloqueado(nav, cx, cy) {
  if (!nav.wpBloqueados) return false;
  const k = `${cx | 0},${cy | 0}`;
  const ate = nav.wpBloqueados.get(k);
  if (ate == null) return false;
  if (performance.now() > ate) {
    nav.wpBloqueados.delete(k);
    return false;
  }
  return true;
}

function lembrarRumo(nav, ix, iy) {
  if (!ix && !iy) return;
  nav.rumoX = ix;
  nav.rumoY = iy;
}

function miraAFrente(nav, idx, z) {
  let frente = idx;
  const limite = Math.min(nav.path.cells.length - 1, idx + 4);
  while (frente < limite) {
    const prox = nav.path.cells[frente + 1];
    if (prox.tipo !== TIPO_WALK) break;
    if (Math.abs((prox.z | 0) - (z | 0)) > 0) break;
    frente++;
  }
  const alvo = nav.path.cells[frente];
  return { x: alvo.cx + 0.5, y: alvo.cy + 0.5 };
}

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

function pedirPath(agente, nav, sx, sy, gx, gy, sz = null, gz = null) {
  nav.versao++;
  nav.goalCx = gx;
  nav.goalCy = gy;
  nav.goalZ = gz;
  solicitarPath(agente.id, agente.perfil, sx, sy, gx, gy, nav.versao, sz, gz);
  nav.estado = "buscando";
  nav.retryT = PATH_RETRY_SEM_CAMINHO;
}

function zDoWaypoint(wp, elevFallback) {
  if (wp?.z != null && wp.z > 0) return wp.z;
  return alturaSobPes(wp.cx + 0.5, wp.cy + 0.5, elevFallback);
}

/**
 * Perto no plano XY mas líder bem mais alto (mesma célula / tile ao lado do cliff).
 * Path 2D acha que já chegou — força climb ou voo vertical.
 */
function perseguirLiderAlto(agente, lider, liderZ, dist, nav, parar) {
  const perfil = agente.perfil;
  const elevAg = agente.elevacao ?? agente.z ?? 0;
  if (dist > parar * 1.55) return null;
  if (liderZ < elevAg + AGENTE_GAP_ELEV_PARAR) return null;
  if (agente.escalando || agente.mantle) return null;

  const dxL = lider.x - agente.x;
  const dyL = lider.y - agente.y;
  const dL = Math.hypot(dxL, dyL) || 1;

  // Degrau de 1 bloco é pulo. Escalar essa face gruda e recomeça no mesmo lugar.
  if (
    perfil.podePular &&
    liderZ >= elevAg + 0.5 &&
    liderZ <= elevAg + 1.05
  ) {
    nav.path = null;
    nav.climbAlvo = null;
    nav.vooAlvo = null;
    nav.planarAlvo = null;
    nav.puloAlvo = { x: lider.x, y: lider.y, z: liderZ };
    nav.estado = "seguindo";
    return {
      ix: dxL / dL,
      iy: dyL / dL,
      querPulo: true,
      querPlanar: false,
      querEscalar: false,
      querVoar: false,
      soltarAsa: false,
      soltarParede: false,
    };
  }

  if (perfil.podeEscalar || perfil.podeCachoeira) {
    const face = encontrarFacePerto(agente.x, agente.y, elevAg);
    const queda = !!face?.cachoeira;
    const facePermitida =
      !!face && (queda ? !!perfil.podeCachoeira : !!perfil.podeEscalar);
    // Só climb se a face chega perto do líder — face curta + asa = loop
    const faceAlcanca =
      facePermitida &&
      liderZ >= face.zBase + 0.2 &&
      elevAg <= face.zTopo + 0.4 &&
      face.zTopo >= liderZ - 0.85;
    if (faceAlcanca) {
      const ax = face.ancoraX - agente.x;
      const ay = face.ancoraY - agente.y;
      const ad = Math.hypot(ax, ay) || 1;
      nav.path = null;
      nav.vooAlvo = null;
      nav.planarAlvo = null;
      nav.climbAlvo = {
        x: face.ancoraX,
        y: face.ancoraY,
        cx: face.cx,
        cy: face.cy,
        z: Math.min(face.zTopo, Math.ceil(liderZ)),
      };
      nav.estado = "seguindo";
      return {
        ix: ax / ad,
        iy: ay / ad,
        querPulo: false,
        querPlanar: false,
        querEscalar: true,
        querVoar: false,
        soltarAsa: false,
        soltarParede: false,
      };
    }
  }

  if (perfil.podeVoar) {
    nav.path = null;
    nav.planarAlvo = null;
    nav.climbAlvo = null;
    nav.vooAlvo = {
      x: lider.x,
      y: lider.y,
      cx: Math.floor(lider.x),
      cy: Math.floor(lider.y),
      z: liderZ,
    };
    nav.estado = "seguindo";
    return {
      ix: dxL / dL,
      iy: dyL / dL,
      querPulo: false,
      querPlanar: false,
      querEscalar: false,
      querVoar: true,
      soltarAsa: false,
      soltarParede: false,
    };
  }

  return null;
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
  const queda = !!face.cachoeira;
  const perfil = agente.perfil;
  if (queda && !perfil?.podeCachoeira) return null;
  if (!queda && !perfil?.podeEscalar) return null;

  const nav = agente.nav;
  if (nav?.path?.cells && nav.idx < nav.path.cells.length) {
    const wp = nav.path.cells[nav.idx];
    const zWp = zDoWaypoint(wp, elevAg);
    // Path pedindo descer / walk / glide → não climb
    if (wp.tipo !== TIPO_CLIMB && zWp <= elevAg + 0.15) {
      return null;
    }
  }

  // Só sobe se líder está acima do agente (não “quase no topo da face”)
  const precisaSubir = liderZ >= elevAg + 1.15 || !!lider.escalando;
  if (!precisaSubir) {
    return null;
  }

  // Face curta demais pro líder → deixa o voo/chase resolver (evita grab↔asa)
  if (face.zTopo < liderZ - 0.85) {
    return null;
  }

  const ax = face.ancoraX - agente.x;
  const ay = face.ancoraY - agente.y;
  const ad = Math.hypot(ax, ay) || 1;
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
function indiceWaypointInicial(cells, ax, ay, elev = null, nav = null) {
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
    const mesmoPiso =
      elev == null || c.z == null || Math.abs(c.z - elev) < 1.1;
    const bloqueado =
      wpBloqueado(nav, c.cx, c.cy) ||
      arestaCortaBase(cx, cy, c.cx, c.cy, c.z ?? elev ?? 0);
    if (((naCelula || perto) && mesmoPiso) || bloqueado) {
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
export function atualizarSeguirCaminho(agente, lider, dt, distSeguir = 0) {
  const nav = garantirNav(agente);
  const perfil = agente.perfil;
  const dist = Math.hypot(lider.x - agente.x, lider.y - agente.y);
  const parar = distSeguir > 0 ? distSeguir : AGENTE_DIST_PARAR;
  const planando = !!agente.planando;
  const voando = !!agente.voando;
  const naParede = !!agente.escalando && !agente.mantle;
  const noMantle = !!agente.mantle;

  const liderZ = lider.elevacao ?? lider.z ?? 0;
  const gapElev = Math.abs((agente.elevacao ?? agente.z ?? 0) - liderZ);
  const naLamina = !!agente.nadando || !!agente.aguaCaindo;


  if (
    dist <= parar &&
    gapElev < AGENTE_GAP_ELEV_PARAR &&
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

  // Mesma célula / tile ao lado mas Δelev grande → sobe (path 2D acha que já chegou)
  if (!planando && !voando && !naParede && !noMantle && !naLamina) {
    const chaseAlto = perseguirLiderAlto(agente, lider, liderZ, dist, nav, parar);
    if (chaseAlto) return chaseAlto;
  }

  // Na parede com líder acima: NÃO soltar por path 2D (era grab↔asa em loop)
  if (naParede && liderZ >= (agente.elevacao ?? 0) + AGENTE_GAP_ELEV_PARAR) {
    const zTopoFace = agente.escalada?.zTopo ?? 0;
    const faceCurta = zTopoFace > 0 && zTopoFace < liderZ - 0.85;
    if (faceCurta && !!perfil.podeVoar) {
      nav.path = null;
      nav.climbAlvo = null;
      nav.vooAlvo = {
        x: lider.x,
        y: lider.y,
        cx: Math.floor(lider.x),
        cy: Math.floor(lider.y),
        z: liderZ,
      };
      return {
        ix: 0,
        iy: 0,
        querPulo: false,
        querPlanar: false,
        querEscalar: false,
        querVoar: true,
        soltarAsa: false,
        soltarParede: true,
      };
    }
    // Face ok / ainda subindo: segura a parede e sobe
    return {
      ix: 0,
      iy: -1,
      querPulo: false,
      querPlanar: false,
      querEscalar: true,
      querVoar: false,
      soltarAsa: false,
      soltarParede: false,
    };
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
      dist <= parar * 1.2 &&
      gapElev < AGENTE_GAP_ELEV_PARAR &&
      !lider.voando;
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
  const elevAgPath = agente.elevacao ?? agente.z ?? 0;
  const zGoal = pisoMaisProximo(goalCx, goalCy, liderZ, perfil);
  const goalMudou =
    goalCx !== nav.goalCx ||
    goalCy !== nav.goalCy ||
    nav.goalZ !== zGoal;
  const ocupadoAr =
    planando || voando || naParede || noMantle || (!agente.noChao && !naLamina);

  // Voo: segue líder em 3D (retarget ao vivo)
  if (voando || (!naLamina && nav.vooAlvo && !agente.noChao && !!perfil.podeVoar && !naParede)) {
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
      dist <= parar * 1.4 &&
      Math.abs((agente.elevacao ?? 0) - liderZ) < AGENTE_GAP_ELEV_PARAR &&
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
    (!!perfil.podeEscalar || !!perfil.podeCachoeira) &&
    !naParede &&
    !noMantle &&
    !voando &&
    !agente.noChao &&
    !naLamina
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
    !naLamina &&
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
    const zChaoAr = alturaSobPes(agente.x, agente.y, agente.elevacao);
    const folgaAr = agente.elevacao - (zChaoAr > 0 ? zChaoAr : 0);
    // Fecha asa só perto do líder e quase no chão; senão pousa natural com a asa
    const soltarAsa =
      planando && dist <= parar * 1.35 && folgaAr <= 1.15;
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
      pedirPath(
        agente,
        nav,
        startCx,
        startCy,
        goalCx,
        goalCy,
        elevAgPath,
        zGoal,
      );
    } else if (nav.estado === "semCaminho") {
      nav.retryT -= dt;
      if (nav.retryT <= 0) {
        pedirPath(
          agente,
          nav,
          startCx,
          startCy,
          goalCx,
          goalCy,
        elevAgPath,
        zGoal,
      );
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
    const cellsPath = res.path.cells || [];
    const fim = cellsPath[cellsPath.length - 1];
    const startCx = agente.x | 0;
    const startCy = agente.y | 0;
    const gCx = nav.goalCx | 0;
    const gCy = nav.goalCy | 0;
    const d0 = Math.hypot(startCx - gCx, startCy - gCy);
    const d1 = fim ? Math.hypot((fim.cx | 0) - gCx, (fim.cy | 0) - gCy) : d0;
    const quaseNoGoal =
      !!res.path.achou ||
      (fim && Math.abs((fim.cx | 0) - gCx) <= 1 && Math.abs((fim.cy | 0) - gCy) <= 1);
    // Parcial só é útil se avança de verdade (não o stub n=1 no peito).
    const parcialUtil =
      !quaseNoGoal && cellsPath.length >= 2 && d1 < d0 - 1.5;
    // Path inútil (melhorKey sem progresso) — evita "vai pra estrada e volta".
    if (!quaseNoGoal && !parcialUtil) {
      nav.path = null;
      nav.estado = "semCaminho";
      nav.retryT = Math.min(PATH_RETRY_SEM_CAMINHO, 0.35);
      nav.pathAplicadoVersao = nav.versao;
      nav.stuckT = 0;
    } else {
      nav.path = res.path;
      nav.pathAplicadoVersao = nav.versao;
      nav.idx = indiceWaypointInicial(
        nav.path.cells,
        agente.x,
        agente.y,
        elevAgPath,
        nav,
      );
      // Parcial com progresso: segue e repatha ao esgotar waypoints (não marca semCaminho).
      nav.estado = res.path.achou || parcialUtil ? "seguindo" : "semCaminho";
      if (!res.path.achou && !parcialUtil) nav.retryT = PATH_RETRY_SEM_CAMINHO;
      // NÃO zerar stuckT: alvo em movimento repatha todo frame e o mon
      // ficava eternamente enfiado na árvore (stuckT nunca batia o limiar).
    }
  } else if (
    nav.estado === "buscando" &&
    !nav.path &&
    !planando &&
    !voando &&
    !naParede
  ) {
    // Não congelar enquanto A*/grade sobe — Electrike “agarrava” aqui.
    const dxB = lider.x - agente.x;
    const dyB = lider.y - agente.y;
    const dB = Math.hypot(dxB, dyB);
    if (dB > parar * 1.05) return idleNav({ ix: dxB / dB, iy: dyB / dB });
    if ((nav.rumoX || nav.rumoY) && nav.pathAplicadoVersao >= 0) {
      return idleNav({ ix: nav.rumoX, iy: nav.rumoY });
    }
    return idleNav();
  }

  if (nav.estado === "semCaminho") {
    if (!nav.path || nav.idx >= (nav.path.cells?.length ?? 0)) {
      // Enquanto repath: anda em linha pro líder (combate/item) em vez de girar parado.
      const dx = lider.x - agente.x;
      const dy = lider.y - agente.y;
      const d = Math.hypot(dx, dy);
      if (d > parar * 1.05) {
        return idleNav({ ix: dx / d, iy: dy / d });
      }
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
    const zWpHere = zDoWaypoint(wp, elevAgPath);
    const raio =
      wp.tipo === TIPO_GLIDE ||
      wp.tipo === TIPO_VOO ||
      wp.tipo === TIPO_NADO ||
      agente.nadando
        ? 0.55
        : 0.4;
    const folgaZ = Math.abs((agente.elevacao ?? agente.z ?? 0) - zWpHere);
    const noPiso = agente.nadando ? folgaZ < 1.2 : folgaZ < 0.85;
    const apoiado = !!agente.noChao || !!agente.nadando;
    let passouTrecho = false;
    if (wp.tipo === TIPO_WALK && nav.idx < nav.path.cells.length - 1) {
      const nxt = nav.path.cells[nav.idx + 1];
      const segX = nxt.cx + 0.5 - tx;
      const segY = nxt.cy + 0.5 - ty;
      const along = (agente.x - tx) * segX + (agente.y - ty) * segY;
      const seg2 = segX * segX + segY * segY;
      passouTrecho = seg2 > 1e-4 && along > seg2 * 0.45;
    }
    if ((Math.hypot(tx - agente.x, ty - agente.y) < raio && apoiado && noPiso) || passouTrecho) {
      nav.idx++;
      continue;
    }
    if (
      (wp.tipo === TIPO_GLIDE ||
        wp.tipo === TIPO_CLIMB ||
        wp.tipo === TIPO_VOO) &&
      agente.noChao &&
      Math.floor(agente.x) === wp.cx &&
      Math.floor(agente.y) === wp.cy &&
      noPiso
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
      const dxS = lider.x - agente.x;
      const dyS = lider.y - agente.y;
      const dS = Math.hypot(dxS, dyS);
      if (dS > parar * 1.05) return idleNav({ ix: dxS / dS, iy: dyS / dS });
      return idleNav();
    }
    if (!ocupadoAr) {
      pedirPath(
        agente,
        nav,
        startCx,
        startCy,
        goalCx,
        goalCy,
        elevAgPath,
        zGoal,
      );
    }
    // Repath enfileirado: continua em linha (senão fica parado no fim do path).
    const dxF = lider.x - agente.x;
    const dyF = lider.y - agente.y;
    const dF = Math.hypot(dxF, dyF);
    if (dF > parar * 1.05) return idleNav({ ix: dxF / dF, iy: dyF / dF });
    return idleNav();
  }

  const wp = nav.path.cells[nav.idx];
  const tx = wp.cx + 0.5;
  const ty = wp.cy + 0.5;
  const dx = tx - agente.x;
  const dy = ty - agente.y;
  const d = Math.hypot(dx, dy) || 1;
  const mira = wp.tipo === TIPO_WALK ? miraAFrente(nav, nav.idx, wp.z | 0) : { x: tx, y: ty };
  const ax = mira.x - agente.x;
  const ay = mira.y - agente.y;
  const ad = Math.hypot(ax, ay) || 1;

  const elevAg = agente.elevacao ?? agente.z;
  const zWp = zDoWaypoint(wp, elevAg);
  const zChaoPes = alturaSobPes(agente.x, agente.y, elevAg);
  const zRef = naParede ? elevAg : zChaoPes;
  const segmentoVoo = !!perfil.podeVoar && wp.tipo === TIPO_VOO;
  // Na parede: glide se o pouso está abaixo da elevação atual
  const segmentoGlide =
    !segmentoVoo && wp.tipo === TIPO_GLIDE && zWp <= zRef + 0.05;
  const segmentoClimb =
    (!!perfil.podeEscalar || !!perfil.podeCachoeira) &&
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
  const liderMaisAlto = liderZ >= agente.elevacao + AGENTE_GAP_ELEV_PARAR;
  // Não soltar por path “descendo” se o líder ainda está acima (loop grab↔asa)
  const pathQuerDescer =
    naParede &&
    !liderMaisAlto &&
    zWp < agente.elevacao - 0.35 &&
    wp.tipo !== TIPO_CLIMB;
  const soltarParede =
    naParede &&
    !querVoar &&
    (segmentoGlide ||
      pathQuerDescer ||
      (folgaParede >= 1.5 && liderMaisBaixo && dist > 1.5));

  if (soltarParede) {
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
  const caindoNaQueda =
    !agente.noChao &&
    !agente.nadando &&
    (!!agente.aguaCaindo || wp.tipo === TIPO_NADO);
  if (caindoNaQueda) {
    nav.stuckT = 0;
  } else if (
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
    const wpStuck = nav.path?.cells?.[nav.idx];
    if (wpStuck) marcarWpBloqueado(nav, wpStuck.cx, wpStuck.cy);
    // Sai do poste/pedra; cache antigo devolvia a mesma rota na hora.
    resolverForaDeObstaculo(agente);
    limparCachePath();
    cancelarPath(agente.id);
    nav.path = null;
    pedirPath(
      agente,
      nav,
      agente.x | 0,
      agente.y | 0,
      goalCx,
      goalCy,
      agente.elevacao ?? elevAg,
      zGoal,
    );
    // Desvia lateral se ainda empurrado pro obstáculo.
    const latX = -ay / ad;
    const latY = ax / ad;
    lembrarRumo(nav, latX, latY);
    return idleNav({ ix: latX, iy: latY });
  }

  let querPulo = false;
  if (
    agente.noChao &&
    !agente.nadando &&
    perfil.podePular &&
    !segmentoGlide &&
    !segmentoClimb &&
    !segmentoVoo &&
    wp.tipo !== TIPO_NADO &&
    !naParede
  ) {
    const precisaDegrau =
      zWp === zChaoPes + 1 ||
      (wp.tipo === TIPO_JUMP && zWp > zChaoPes && zWp <= zChaoPes + 1);
    if (precisaDegrau && Math.hypot(dx, dy) < 1.35) {
      querPulo = true;
      nav.puloAlvo = { x: tx, y: ty, z: zWp };
    }
  }

  lembrarRumo(nav, ax / ad, ay / ad);
  return {
    ix: ax / ad,
    iy: ay / ad,
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
