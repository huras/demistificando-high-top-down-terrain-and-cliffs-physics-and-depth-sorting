import {
  ESCALADA_IMPULSO_SOLTAR,
  ESCALADA_MANTLE_ARCO,
  ESCALADA_MANTLE_DUR,
  ESCALADA_MANTLE_EPS,
  ESCALADA_VEL,
  RAIO_CORPO,
} from "../config.js";
import {
  encontrarFacePerto,
  resolverFaceAposMovimento,
} from "../mundo/facesCliff.js";
import { drenarStaminaEscalada } from "./stamina.js";
import { iniciarQueda } from "./pulo.js";
import {
  capturarTravaNoAttach,
  capturarTravaPosMantle,
  limparTravaEscalada,
  limparTravaPosMantle,
  resolverInputEscaladaTravado,
} from "./travaInputEscalada.js";

/**
 * Gruda na face (BOTW) — não sobe sozinho pro topo.
 * WASD relativo à face com trava semântica (cantos não remapeiam tecla).
 */
export function tentarEscalar(corpo) {
  if (corpo.escalando || corpo.mantle) return { ok: false, motivo: "ja-escalando" };
  if ((corpo.stamina ?? 0) <= 1e-4) {
    return { ok: false, motivo: "sem-stamina" };
  }

  const zRef = corpo.noChao ? corpo.z : corpo.elevacao;
  const face = encontrarFacePerto(corpo.x, corpo.y, zRef);
  if (!face) return { ok: false, motivo: "sem-face" };

  const elev0 = Math.min(
    face.zTopo - ESCALADA_MANTLE_EPS - 0.02,
    Math.max(face.zBase + 0.08, zRef + 0.05),
  );

  return {
    ok: true,
    escalada: estadoDeFace(face),
    elev0,
  };
}

/** Aplica attach no corpo. `dx/dy` = teclas ainda seguradas na caminhada. */
export function anexarEscalada(corpo, res, dx = 0, dy = 0) {
  const e = res.escalada;
  corpo.escalada = e;
  corpo.escalando = true;
  corpo.noChao = false;
  corpo.pulando = false;
  corpo.planando = false;
  corpo.pulo = null;
  corpo.vx = 0;
  corpo.vy = 0;
  corpo.vz = 0;
  corpo.x = e.ancoraX;
  corpo.y = e.ancoraY;
  corpo.elevacao = res.elev0;
  corpo.z = e.zBase > 0 ? e.zBase : Math.floor(res.elev0);
  corpo.hopLift = corpo.elevacao - corpo.z;
  corpo.acao = "escalando";
  limparTravaPosMantle(corpo);
  capturarTravaNoAttach(corpo, e, dx, dy);
  sincronizarFacingParede(corpo, e);
}

/**
 * Tick: input (dx,dy) → subida/lateral travados; stamina só se movendo.
 */
export function atualizarEscalada(corpo, dt, dx = 0, dy = 0) {
  const e = corpo.escalada;
  if (!e || !corpo.escalando) return 0;

  const { subida, lateral } = resolverInputEscaladaTravado(corpo, e, dx, dy);
  const movendo = subida !== 0 || lateral !== 0;

  if (drenarStaminaEscalada(corpo, dt, movendo)) {
    soltarEscalada(corpo, { impulso: true, motivo: "stamina" });
    return corpo.hopLift;
  }

  if (subida !== 0) {
    corpo.elevacao += subida * ESCALADA_VEL * dt;
  }

  if (lateral !== 0) {
    moverAoLongoDaParede(corpo, e, lateral, dt);
  } else {
    colarEixoNormal(corpo, e);
  }

  if (corpo.elevacao >= e.elevMax - 0.01 && subida > 0.2) {
    iniciarMantle(corpo, e, dx, dy);
    return corpo.hopLift;
  }

  if (corpo.elevacao <= e.elevMin + 0.02 && subida < -0.2) {
    soltarEscalada(corpo, { impulso: false, motivo: "base", pousarBase: true });
    return 0;
  }

  corpo.elevacao = clamp(corpo.elevacao, e.elevMin, e.elevMax);
  corpo.z = e.zBase > 0 ? e.zBase : 0;
  corpo.hopLift = corpo.elevacao - corpo.z;
  corpo.escalando = true;
  corpo.noChao = false;
  corpo.acao = movendo ? "escalando" : "agarrado";
  sincronizarFacingParede(corpo, e);
  return corpo.hopLift;
}

/** Solta a parede (Space, E, stamina, base). */
export function soltarEscalada(corpo, opts = {}) {
  if (!corpo.escalando && !corpo.escalada) return false;
  const e = corpo.escalada;
  const impulso = opts.impulso !== false;
  const elev = corpo.elevacao;

  corpo.escalando = false;
  corpo.escalada = null;
  corpo.mantle = null;
  corpo.planando = false;
  limparTravaEscalada(corpo);
  limparTravaPosMantle(corpo);

  if (opts.pousarBase && e) {
    corpo.z = e.zBase > 0 ? e.zBase : 1;
    corpo.elevacao = corpo.z;
    corpo.hopLift = 0;
    corpo.vz = 0;
    corpo.noChao = true;
    corpo.pulando = false;
    corpo.x += e.normalX * 0.15;
    corpo.y += e.normalY * 0.15;
    corpo.acao = "desceu da parede";
    return true;
  }

  corpo.elevacao = elev;
  corpo.z = Math.max(0, Math.floor(elev));
  corpo.hopLift = corpo.elevacao - corpo.z;
  corpo.noChao = true;
  if (impulso && e) {
    corpo.vx = e.normalX * ESCALADA_IMPULSO_SOLTAR;
    corpo.vy = e.normalY * ESCALADA_IMPULSO_SOLTAR;
  }
  iniciarQueda(corpo);
  corpo.elevacao = elev;
  if (opts.motivo === "stamina") corpo.acao = "stamina esgotada";
  else if (opts.motivo === "e") corpo.acao = "soltou (E)";
  else corpo.acao = "soltou parede";
  return true;
}

function moverAoLongoDaParede(corpo, e, lateral, dt) {
  const passo = lateral * ESCALADA_VEL * dt;
  const nx = corpo.x + e.latX * passo;
  const ny = corpo.y + e.latY * passo;

  const proxima = resolverFaceAposMovimento(
    nx,
    ny,
    corpo.elevacao,
    e,
    lateral,
  );
  if (!proxima) {
    colarEixoNormal(corpo, e);
    return;
  }

  const ladoAntes = e.lado;
  const virouCanto = proxima.lado !== ladoAntes;
  aplicarFaceNoEstado(e, proxima, virouCanto);

  if (virouCanto) {
    // quina mais perto da posição (convex = mesma célula; côncavo = diagonal)
    if (proxima.lado === "s") {
      corpo.y = proxima.cy + 1.02;
      corpo.x = clamp(nx, proxima.cx + 0.05, proxima.cx + 0.95);
    } else if (proxima.lado === "n") {
      corpo.y = proxima.cy - 0.02;
      corpo.x = clamp(nx, proxima.cx + 0.05, proxima.cx + 0.95);
    } else if (proxima.lado === "e") {
      corpo.x = proxima.cx + 1.02;
      corpo.y = clamp(ny, proxima.cy + 0.05, proxima.cy + 0.95);
    } else if (proxima.lado === "w") {
      corpo.x = proxima.cx - 0.02;
      corpo.y = clamp(ny, proxima.cy + 0.05, proxima.cy + 0.95);
    }
  } else {
    corpo.x = nx;
    corpo.y = ny;
  }

  colarEixoNormal(corpo, e);
}

function estadoDeFace(face) {
  return {
    lado: face.lado,
    cx: face.cx,
    cy: face.cy,
    zBase: face.zBase,
    zTopo: face.zTopo,
    normalX: face.normalX,
    normalY: face.normalY,
    latX: face.lateralX,
    latY: face.lateralY,
    latSign: face.latSign,
    ancoraX: face.ancoraX,
    ancoraY: face.ancoraY,
    elevMin: face.zBase + 0.05,
    elevMax: face.zTopo - ESCALADA_MANTLE_EPS,
  };
}

function aplicarFaceNoEstado(e, viz, atualizarEixos) {
  e.cx = viz.cx;
  e.cy = viz.cy;
  e.zBase = viz.zBase;
  e.zTopo = viz.zTopo;
  e.elevMin = viz.zBase + 0.05;
  e.elevMax = viz.zTopo - ESCALADA_MANTLE_EPS;
  e.ancoraX = viz.ancoraX;
  e.ancoraY = viz.ancoraY;
  e.lado = viz.lado;
  if (atualizarEixos) {
    e.normalX = viz.normalX;
    e.normalY = viz.normalY;
    e.latX = viz.lateralX;
    e.latY = viz.lateralY;
  }
}

function colarEixoNormal(corpo, e) {
  if (e.lado === "s") corpo.y = e.cy + 1.02;
  else if (e.lado === "n") corpo.y = e.cy - 0.02;
  else if (e.lado === "w") corpo.x = e.cx - 0.02;
  else if (e.lado === "e") corpo.x = e.cx + 1.02;
}

/**
 * Mantle suave (arco) pro topo — mantém a lateral do climb, sem teleporte.
 */
function iniciarMantle(corpo, e, dx = 0, dy = 0) {
  const r = RAIO_CORPO;
  const dest = destinoMantle(corpo, e, r);

  capturarTravaPosMantle(corpo, e, dx, dy);
  limparTravaEscalada(corpo);
  sincronizarFacingParede(corpo, e);

  corpo.mantle = {
    t: 0,
    dur: ESCALADA_MANTLE_DUR,
    x0: corpo.x,
    y0: corpo.y,
    elev0: corpo.elevacao,
    x1: dest.x,
    y1: dest.y,
    elev1: e.zTopo,
    zTopo: e.zTopo,
    cx: e.cx,
    cy: e.cy,
  };

  corpo.escalando = false;
  corpo.escalada = null;
  corpo.noChao = false;
  corpo.pulando = true;
  corpo.planando = false;
  corpo.vx = 0;
  corpo.vy = 0;
  corpo.vz = 0;
  corpo.z = e.zTopo;
  corpo.hopLift = corpo.elevacao - corpo.z;
  corpo.acao = "mantling";
}

/** Pouso perto da beirada (não no centro do tile). */
function destinoMantle(corpo, e, r) {
  const margin = r + 0.06;
  let x = clamp(corpo.x, e.cx + margin, e.cx + 1 - margin);
  let y = clamp(corpo.y, e.cy + margin, e.cy + 1 - margin);

  if (e.lado === "s") y = e.cy + 1 - margin;
  else if (e.lado === "n") y = e.cy + margin;
  else if (e.lado === "e") x = e.cx + 1 - margin;
  else if (e.lado === "w") x = e.cx + margin;

  return { x, y };
}

/**
 * Tick do arco de mantle. true = ainda no ar; false = pousou / sem mantle.
 */
export function atualizarMantle(corpo, dt) {
  const m = corpo.mantle;
  if (!m) return false;

  m.t += dt;
  const u = Math.min(1, m.t / m.dur);
  // ease-out: chega rápido no começo, freia no topo
  const s = 1 - (1 - u) ** 3;
  const arco = Math.sin(Math.PI * u) * ESCALADA_MANTLE_ARCO;

  corpo.x = m.x0 + (m.x1 - m.x0) * s;
  corpo.y = m.y0 + (m.y1 - m.y0) * s;
  corpo.elevacao = m.elev0 + (m.elev1 - m.elev0) * s + arco;
  corpo.z = m.zTopo;
  corpo.hopLift = corpo.elevacao - corpo.z;
  corpo.noChao = false;
  corpo.pulando = true;
  corpo.vx = 0;
  corpo.vy = 0;
  corpo.vz = 0;
  corpo.acao = "mantling";

  if (u < 1) return true;

  corpo.x = m.x1;
  corpo.y = m.y1;
  corpo.z = m.zTopo;
  corpo.elevacao = m.zTopo;
  corpo.hopLift = 0;
  corpo.vz = 0;
  corpo.noChao = true;
  corpo.pulando = false;
  corpo.mantle = null;
  corpo.acao = `mantle → z=${m.zTopo}`;
  return false;
}

export function cancelarMantle(corpo) {
  if (!corpo.mantle) return;
  const m = corpo.mantle;
  corpo.x = m.x1;
  corpo.y = m.y1;
  corpo.z = m.zTopo;
  corpo.elevacao = m.zTopo;
  corpo.hopLift = 0;
  corpo.mantle = null;
  corpo.noChao = true;
  corpo.pulando = false;
}

function sincronizarFacingParede(corpo, e) {
  const fx = -e.normalX;
  const fy = -e.normalY;
  corpo.dirX = fx;
  corpo.dirY = fy;
  if (Math.abs(fx) > Math.abs(fy)) {
    corpo.facing = fx < 0 ? 1 : 2;
  } else {
    corpo.facing = fy < 0 ? 3 : 0;
  }
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
