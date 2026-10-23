/**
 * Física compartilhada do ranged (arco / pokébola).
 *
 * Top-down: força resolvida pra cair no cursor; fora do alcance → máximo + feedback vermelho.
 * Mira ombro (RMB): direcaoTiro + velocidade por carga.
 */
import {
  ALTURA_BLOCO,
  BOLA_ALCANCE_MIN,
  BOLA_ARCO_AMOSTRAS,
  BOLA_GRAVIDADE,
  BOLA_LOFT_TOPDOWN,
  BOLA_PICKUP_RAIO,
  BOLA_RAIO_BLOCO,
  BOLA_VEL_MAX,
  BOLA_VEL_MIN,
} from "../config.js";
import { alturaSobPes } from "../fisica/colisao.js";

const _dir = { x: 0, y: 0, z: 0 };
const _arcoPos = new Float32Array(BOLA_ARCO_AMOSTRAS * 3);
const _impacto = { x: 0, y: 0, z: 0, voo: 0, ux: 0, uy: 0 };
const _dirResolvido = { x: 0, y: 0, z: 0 };
const _resolvido = {
  vel: BOLA_VEL_MIN,
  dir: _dirResolvido,
  alcancavel: true,
  posicoes: _arcoPos,
  count: 0,
  impacto: _impacto,
  distAlvo: 0,
  maxDist: 0,
};

function direcaoComLoft(ux, uy, loft = 0.4) {
  const x = ux;
  const y = Math.max(0.12, loft);
  const z = uy;
  const len = Math.hypot(x, y, z) || 1;
  _dir.x = x / len;
  _dir.y = y / len;
  _dir.z = z / len;
  return _dir;
}

function facingComLoft(corpo, loft = 0.4) {
  const fx = corpo?.dirX || 0;
  const fy = corpo?.dirY || 1;
  const fl = Math.hypot(fx, fy) || 1;
  return direcaoComLoft(fx / fl, fy / fl, loft);
}

/** @returns {{ ux: number, uy: number, dist: number } | null} */
function horizontalParaMira(corpo, mira) {
  if (!corpo || !mira || !Number.isFinite(mira.x) || !Number.isFinite(mira.y)) return null;
  const dx = mira.x - corpo.x;
  const dy = mira.y - corpo.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.15) return null;
  return { ux: dx / dist, uy: dy / dist, dist };
}

function ehTopDown(camera3d) {
  return !camera3d || camera3d.modo !== "mira";
}

/**
 * @param {{ direcaoTiro?: { x: number, y: number, z: number }, modo?: string } | null} camera3d
 * @param {{ x?: number, y?: number, dirX?: number, dirY?: number } | null} corpo
 * @param {{ carga?: number, mira?: { x: number, y: number } | null, loft?: number }} [opts]
 */
export function direcaoDisparoRanged(camera3d, corpo, opts = {}) {
  const carga = Math.min(1, Math.max(0, Number(opts.carga) || 0));
  const loft = opts.loft ?? (ehTopDown(camera3d) ? BOLA_LOFT_TOPDOWN : 0.34 + carga * 0.32);

  if (ehTopDown(camera3d)) {
    const h = horizontalParaMira(corpo, opts.mira);
    if (h) return direcaoComLoft(h.ux, h.uy, loft);
    return facingComLoft(corpo, loft);
  }

  const d = camera3d.direcaoTiro;
  if (!d) {
    const h = horizontalParaMira(corpo, opts.mira);
    if (h) return direcaoComLoft(h.ux, h.uy, loft);
    return facingComLoft(corpo, loft);
  }

  const len = Math.hypot(d.x, d.y, d.z);
  if (len < 1e-6) return facingComLoft(corpo, loft);
  _dir.x = d.x / len;
  _dir.y = d.y / len;
  _dir.z = d.z / len;
  return _dir;
}

/**
 * @param {{ x: number, y: number, elevacao?: number, z?: number, dirX?: number, dirY?: number }} corpo
 * @param {{ yaw?: number, alturaPivo?: number, modo?: string } | null} camera3d
 * @param {{ mira?: { x: number, y: number } | null }} [opts]
 */
export function origemMaoRanged(corpo, camera3d, opts = {}) {
  const elev = (corpo.elevacao ?? corpo.z ?? 0) * ALTURA_BLOCO;
  if (ehTopDown(camera3d)) {
    const h = horizontalParaMira(corpo, opts.mira);
    let ux;
    let uy;
    if (h) {
      ux = h.ux;
      uy = h.uy;
    } else {
      const fx = corpo.dirX || 0;
      const fy = corpo.dirY || 1;
      const fl = Math.hypot(fx, fy) || 1;
      ux = fx / fl;
      uy = fy / fl;
    }
    return {
      x: corpo.x + ux * 0.45,
      y: elev + 1.05,
      z: corpo.y + uy * 0.45,
    };
  }
  const yaw = camera3d.yaw ?? 0;
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);
  const altura = elev + (camera3d.alturaPivo ?? 1.15) * 0.72;
  return {
    x: corpo.x + cosY * 0.22 + -sinY * 0.28,
    y: altura,
    z: corpo.y + -sinY * 0.22 + -cosY * 0.28,
  };
}

export function velocidadeBolaPorCarga(carga) {
  const t = Math.min(1, Math.max(0, Number(carga) || 0));
  return BOLA_VEL_MIN + (BOLA_VEL_MAX - BOLA_VEL_MIN) * t;
}

/**
 * Simula balística. `gravarArco=false` só mede alcance (barato, busca binária).
 * @returns {{ voo: number, count: number }}
 */
function simularBalistica(corpo, camera3d, vel, mira, loft, gravarArco) {
  const opts = { mira, loft, carga: 0 };
  const origem = origemMaoRanged(corpo, camera3d, opts);
  const dir = direcaoDisparoRanged(camera3d, corpo, opts);
  let px = origem.x;
  let py = origem.y;
  let pz = origem.z;
  let vx = dir.x * vel;
  let vy = dir.y * vel;
  let vz = dir.z * vel;

  const dt = 1 / 40;
  const maxPassos = 120;
  let count = 0;

  if (gravarArco) {
    _arcoPos[0] = px;
    _arcoPos[1] = py;
    _arcoPos[2] = pz;
    count = 1;
  }

  for (let i = 0; i < maxPassos; i++) {
    vy -= BOLA_GRAVIDADE * dt;
    px += vx * dt;
    py += vy * dt;
    pz += vz * dt;

    const soloBloco = alturaSobPes(px, pz, py / ALTURA_BLOCO + 1) || 0;
    const soloY = soloBloco * ALTURA_BLOCO + BOLA_RAIO_BLOCO * ALTURA_BLOCO;

    if (gravarArco && count < BOLA_ARCO_AMOSTRAS) {
      const i3 = count * 3;
      _arcoPos[i3] = px;
      _arcoPos[i3 + 1] = py;
      _arcoPos[i3 + 2] = pz;
      count += 1;
    }

    if (py <= soloY) {
      if (gravarArco && count > 0) {
        const i3 = (count - 1) * 3;
        _arcoPos[i3 + 1] = soloY;
      }
      const dx = px - corpo.x;
      const dy = pz - corpo.y;
      const voo = Math.hypot(dx, dy) || BOLA_ALCANCE_MIN;
      const inv = voo > 1e-4 ? 1 / voo : 1;
      _impacto.x = px;
      _impacto.y = pz;
      _impacto.z = soloBloco;
      _impacto.voo = voo;
      _impacto.ux = dx * inv;
      _impacto.uy = dy * inv;
      return { voo, count: gravarArco ? count : 0 };
    }
  }

  const dx = dir.x;
  const dy = dir.z;
  const len = Math.hypot(dx, dy) || 1;
  const voo = BOLA_PICKUP_RAIO * 1.1 + 8;
  _impacto.x = corpo.x + (dx / len) * voo;
  _impacto.y = corpo.y + (dy / len) * voo;
  _impacto.z = corpo.elevacao ?? corpo.z ?? 0;
  _impacto.voo = voo;
  _impacto.ux = dx / len;
  _impacto.uy = dy / len;
  return { voo, count: gravarArco ? Math.max(count, 1) : 0 };
}

/** Cache de vel resolvida (preview chama todo frame; throw reusa se mira não mexeu). */
const _cacheVel = {
  cx: NaN,
  cy: NaN,
  mx: NaN,
  my: NaN,
  vel: BOLA_VEL_MIN,
  maxDist: 0,
  alcancavel: true,
};

function chaveCacheOk(corpo, mira) {
  if (!corpo || !mira) return false;
  return (
    Math.abs(_cacheVel.cx - corpo.x) < 0.08 &&
    Math.abs(_cacheVel.cy - corpo.y) < 0.08 &&
    Math.abs(_cacheVel.mx - mira.x) < 0.12 &&
    Math.abs(_cacheVel.my - mira.y) < 0.12
  );
}

/**
 * Top-down: acha a velocidade pra cair o mais perto possível do cursor.
 * Fora do alcance → VEL_MAX na direção do cursor + alcancavel=false.
 */
export function resolverArremessoTopDown(corpo, camera3d, mira) {
  const loft = BOLA_LOFT_TOPDOWN;
  const h = horizontalParaMira(corpo, mira);
  const distAlvo = h ? h.dist : BOLA_ALCANCE_MIN;

  let best;
  let maxDist;
  let alcancavel;

  if (chaveCacheOk(corpo, mira)) {
    best = _cacheVel.vel;
    maxDist = _cacheVel.maxDist;
    alcancavel = _cacheVel.alcancavel;
  } else {
    const maxMed = simularBalistica(corpo, camera3d, BOLA_VEL_MAX, mira, loft, false);
    maxDist = Math.max(BOLA_ALCANCE_MIN, maxMed.voo);
    alcancavel = distAlvo <= maxDist + 0.25;
    const distDesejada = Math.min(maxDist, Math.max(BOLA_ALCANCE_MIN, distAlvo));

    let lo = BOLA_VEL_MIN;
    let hi = BOLA_VEL_MAX;
    best = alcancavel ? BOLA_VEL_MIN : BOLA_VEL_MAX;
    if (alcancavel) {
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) * 0.5;
        const med = simularBalistica(corpo, camera3d, mid, mira, loft, false);
        if (med.voo < distDesejada) lo = mid;
        else hi = mid;
        best = hi;
      }
    }

    _cacheVel.cx = corpo.x;
    _cacheVel.cy = corpo.y;
    _cacheVel.mx = mira?.x ?? NaN;
    _cacheVel.my = mira?.y ?? NaN;
    _cacheVel.vel = best;
    _cacheVel.maxDist = maxDist;
    _cacheVel.alcancavel = alcancavel;
  }

  const final = simularBalistica(corpo, camera3d, best, mira, loft, true);
  _dirResolvido.x = _dir.x;
  _dirResolvido.y = _dir.y;
  _dirResolvido.z = _dir.z;
  _resolvido.vel = best;
  _resolvido.alcancavel = alcancavel;
  _resolvido.count = final.count;
  _resolvido.distAlvo = distAlvo;
  _resolvido.maxDist = maxDist;
  return _resolvido;
}

/**
 * Arco/preview: top-down resolve no cursor; mira ombro usa carga.
 * @returns {{
 *   posicoes: Float32Array,
 *   count: number,
 *   impacto: typeof _impacto,
 *   alcancavel: boolean,
 *   vel: number,
 *   miraCursor: { x: number, y: number } | null,
 * }}
 */
export function simularTrajetoriaBola(corpo, camera3d, carga, mira = null) {
  if (ehTopDown(camera3d) && mira) {
    const r = resolverArremessoTopDown(corpo, camera3d, mira);
    return {
      posicoes: r.posicoes,
      count: r.count,
      impacto: r.impacto,
      alcancavel: r.alcancavel,
      vel: r.vel,
      miraCursor: mira,
      maxDist: r.maxDist,
    };
  }

  const cargaN = Math.min(1, Math.max(0, Number(carga) || 0));
  const vel = velocidadeBolaPorCarga(cargaN);
  const loft = 0.34 + cargaN * 0.32;
  const med = simularBalistica(corpo, camera3d, vel, mira, loft, true);
  return {
    posicoes: _arcoPos,
    count: med.count,
    impacto: _impacto,
    alcancavel: true,
    vel,
    miraCursor: mira,
    maxDist: _impacto.voo,
  };
}

/**
 * Params de voo pra arremessar (top-down resolve cursor; ombro usa carga).
 * @returns {{ origem: {x:number,y:number,z:number}, dir: {x:number,y:number,z:number}, vel: number, alcancavel: boolean }}
 */
export function parametrosArremessoBola(corpo, camera3d, carga, mira = null) {
  if (ehTopDown(camera3d)) {
    const r = resolverArremessoTopDown(corpo, camera3d, mira);
    const origem = origemMaoRanged(corpo, camera3d, { mira });
    return {
      origem,
      dir: { x: r.dir.x, y: r.dir.y, z: r.dir.z },
      vel: r.vel,
      alcancavel: r.alcancavel,
    };
  }
  const cargaN = Math.min(1, Math.max(0, Number(carga) || 0));
  const opts = { carga: cargaN, mira };
  return {
    origem: origemMaoRanged(corpo, camera3d, opts),
    dir: { ...direcaoDisparoRanged(camera3d, corpo, opts) },
    vel: velocidadeBolaPorCarga(cargaN),
    alcancavel: true,
  };
}

export function estimarQuedaBola(corpo, camera3d, carga, mira = null) {
  if (!corpo) return null;
  const { impacto, alcancavel } = simularTrajetoriaBola(corpo, camera3d, carga, mira);
  return {
    x: impacto.x,
    y: impacto.y,
    z: impacto.z,
    voo: impacto.voo,
    ux: impacto.ux,
    uy: impacto.uy,
    alcancavel,
  };
}
