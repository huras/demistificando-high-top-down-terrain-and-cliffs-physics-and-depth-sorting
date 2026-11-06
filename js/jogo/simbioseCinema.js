/**
 * Cinema de simbiose: hold → espiral → viagem.
 * Mesmas fases do Pokémon AI (combat/symbiosisFx), no corpo 3D.
 */

const N = 16;
const CORES = Object.freeze([
  [0, 255, 255],
  [74, 158, 255],
  [107, 179, 255],
  [255, 255, 255],
  [160, 208, 255],
]);

const FX = Object.freeze({
  particleCount: 15,
  holdSec: 0.3,
  spiralSec: 0.5,
  travelSec: 0.22,
  spiralDist: 2,
  spiralTurns: 1.5,
  orbitJitter: 0.45,
});

const pool = [];
for (let i = 0; i < N; i++) {
  pool.push({
    baseAngle: 0,
    scale: 1,
    orbitMul: 1,
    r: 1,
    g: 1,
    b: 1,
    x: 0,
    y: 0,
    alpha: 0,
    offsetAngle: 0,
    offsetDist: 0,
    _spiralX: 0,
    _spiralY: 0,
    viva: false,
  });
}

/** @type {null | {
 *   dir: "in"|"out",
 *   phase: string,
 *   age: number,
 *   ator: object,
 *   originX: number,
 *   originY: number,
 *   targetX: number,
 *   targetY: number,
 *   returnX: number,
 *   returnY: number,
 *   holdSec: number,
 *   spiralSec: number,
 *   travelSec: number,
 *   spiralDist: number,
 *   spiralTurns: number,
 *   count: number,
 *   onConcluir?: (dir: string) => void,
 * }} */
let cinema = null;

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function easeOutCubic(t) {
  const x = 1 - clamp01(t);
  return 1 - x * x * x;
}

function easeInOut(t) {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function prepararParticulas(count) {
  const n = Math.max(4, Math.min(N, count | 0));
  const jitter = FX.orbitJitter;
  const minMul = Math.max(0.32, 1 - jitter);
  const maxMul = 1 + jitter;
  const span = Math.max(0.01, maxMul - minMul);
  for (let i = 0; i < N; i++) {
    const p = pool[i];
    p.viva = i < n;
    p.alpha = 0;
    if (!p.viva) continue;
    const rgb = CORES[i % CORES.length];
    const stagger = ((i * 7) % n) / n;
    p.baseAngle = (i / n) * Math.PI * 2;
    p.scale = 0.5 + ((i * 13) % 10) / 20;
    p.orbitMul = minMul + (stagger * 0.55 + ((i * 3) % 7) / 14) * span;
    p.r = rgb[0] / 255;
    p.g = rgb[1] / 255;
    p.b = rgb[2] / 255;
    p.offsetAngle = p.baseAngle;
    p.offsetDist = (0.08 + ((i * 5) % 10) / 100) * p.orbitMul;
    p._spiralX = 0;
    p._spiralY = 0;
  }
  return n;
}

function congelar(ator) {
  if (!ator) return;
  ator.vx = 0;
  ator.vy = 0;
  ator.vz = 0;
  ator.andando = false;
  ator.correndo = false;
  ator._simbioseFreeze = true;
}

export function cinemaSimbioseAtivo() {
  return !!(cinema && cinema.phase && cinema.phase !== "done");
}

export function atorCinemaSimbiose() {
  return cinema?.ator || null;
}

/** Pool fixo. O desenho lê no lugar. */
export function particulasSimbiose() {
  return cinema && cinema.phase !== "done" ? pool : null;
}

export function limparCinemaSimbiose() {
  if (cinema?.ator) delete cinema.ator._simbioseFreeze;
  cinema = null;
  for (let i = 0; i < N; i++) pool[i].viva = false;
}

function abrir(dir, corpo, ator, origem, alvo, retorno, onConcluir) {
  if (!corpo || !ator || cinemaSimbioseAtivo()) return false;
  congelar(ator);
  const count = prepararParticulas(FX.particleCount);
  cinema = {
    dir,
    phase: "hold",
    age: 0,
    ator,
    originX: origem.x,
    originY: origem.y,
    targetX: alvo.x,
    targetY: alvo.y,
    returnX: retorno.x,
    returnY: retorno.y,
    holdSec: FX.holdSec,
    spiralSec: FX.spiralSec,
    travelSec: FX.travelSec,
    spiralDist: FX.spiralDist,
    spiralTurns: FX.spiralTurns,
    count,
    onConcluir,
  };
  corpo.vx = 0;
  corpo.vy = 0;
  return true;
}

export function iniciarCinemaEntrada(corpo, ator, onConcluir) {
  if (!corpo || !ator) return false;
  return abrir(
    "in",
    corpo,
    ator,
    { x: corpo.x, y: corpo.y },
    { x: ator.x, y: ator.y },
    { x: corpo.x, y: corpo.y },
    onConcluir,
  );
}

export function iniciarCinemaSaida(corpo, ator, retorno, onConcluir) {
  if (!corpo || !ator) return false;
  return abrir(
    "out",
    corpo,
    ator,
    { x: ator.x, y: ator.y },
    retorno,
    retorno,
    onConcluir,
  );
}

function atualizarParticulas() {
  if (!cinema) return;
  const {
    phase,
    age,
    holdSec,
    spiralSec,
    travelSec,
    spiralDist,
    spiralTurns,
    originX,
    originY,
    targetX,
    targetY,
    count,
    dir,
  } = cinema;

  if (phase === "hold") {
    const t = clamp01(age / Math.max(0.01, holdSec));
    for (let i = 0; i < count; i++) {
      const p = pool[i];
      const rad = (p.offsetDist || 0.1) * (0.35 + 0.65 * t);
      p.x = originX + Math.cos(p.baseAngle) * rad;
      p.y = originY + Math.sin(p.baseAngle) * rad;
      p.alpha = t;
    }
    return;
  }

  if (phase === "spiral") {
    const t = clamp01(age / Math.max(0.01, spiralSec));
    const ease = easeOutCubic(t);
    for (let i = 0; i < count; i++) {
      const p = pool[i];
      const mul = p.orbitMul || 1;
      const ang = p.baseAngle + spiralTurns * Math.PI * 2 * ease;
      const rad = spiralDist * ease * mul;
      if (dir === "in") {
        p.x = originX + Math.cos(ang) * rad;
        p.y = originY + Math.sin(ang) * rad;
      } else {
        const endAng = p.baseAngle + spiralTurns * Math.PI * 2;
        const sx = targetX + Math.cos(endAng) * spiralDist * mul;
        const sy = targetY + Math.sin(endAng) * spiralDist * mul;
        p.x = originX + (sx - originX) * ease;
        p.y = originY + (sy - originY) * ease;
      }
      p.alpha = 1;
      p._spiralX = p.x;
      p._spiralY = p.y;
    }
    return;
  }

  if (phase === "travel") {
    const t = clamp01(age / Math.max(0.01, travelSec));
    const ease = easeInOut(t);
    for (let i = 0; i < count; i++) {
      const p = pool[i];
      const sx = p._spiralX || originX;
      const sy = p._spiralY || originY;
      const fx = targetX + Math.cos(p.offsetAngle) * p.offsetDist;
      const fy = targetY + Math.sin(p.offsetAngle) * p.offsetDist;
      p.x = sx + (fx - sx) * ease;
      p.y = sy + (fy - sy) * ease;
      p.alpha = 1 - ease;
    }
  }
}

function avancarFase() {
  if (!cinema) return true;
  if (cinema.phase === "hold" || cinema.phase === "spiral") {
    if (cinema.phase === "spiral") {
      const n = cinema.count;
      for (let i = 0; i < n; i++) {
        pool[i]._spiralX = pool[i].x;
        pool[i]._spiralY = pool[i].y;
      }
    }
    cinema.phase = cinema.phase === "hold" ? "spiral" : "travel";
    cinema.age = 0;
    return false;
  }
  cinema.phase = "done";
  return true;
}

function seguirCentro(corpo) {
  if (!corpo || !cinema) return;
  let sx = 0;
  let sy = 0;
  let n = 0;
  const count = cinema.count;
  for (let i = 0; i < count; i++) {
    const p = pool[i];
    if (p.alpha <= 0.02) continue;
    sx += p.x;
    sy += p.y;
    n++;
  }
  if (!n) return;
  corpo.x = sx / n;
  corpo.y = sy / n;
  corpo.vx = 0;
  corpo.vy = 0;
  corpo.vz = 0;
}

/**
 * @param {number} dt
 * @param {object} corpo
 * @returns {boolean} true enquanto o cinema consome o frame
 */
export function tickCinemaSimbiose(dt, corpo) {
  if (!cinema || cinema.phase === "done") return false;
  const ator = cinema.ator;
  if (!ator || ator.morto || ator.hp <= 0) {
    const sair = cinema.dir === "out";
    const cb = cinema.onConcluir;
    const retX = cinema.returnX;
    const retY = cinema.returnY;
    limparCinemaSimbiose();
    if (sair && corpo) {
      corpo.x = retX;
      corpo.y = retY;
      corpo.vx = 0;
      corpo.vy = 0;
    }
    if (sair && cb) cb("out");
    return false;
  }

  congelar(ator);
  if (cinema.dir === "in") {
    cinema.targetX = ator.x;
    cinema.targetY = ator.y;
  }

  cinema.age += dt;
  const lim =
    cinema.phase === "hold"
      ? cinema.holdSec
      : cinema.phase === "spiral"
        ? cinema.spiralSec
        : cinema.travelSec;
  atualizarParticulas();
  seguirCentro(corpo);

  if (cinema.age >= lim) {
    const done = avancarFase();
    if (done) {
      const dir = cinema.dir;
      const cb = cinema.onConcluir;
      const retX = cinema.returnX;
      const retY = cinema.returnY;
      delete ator._simbioseFreeze;
      cinema = null;
      for (let i = 0; i < N; i++) pool[i].viva = false;
      if (dir === "out" && corpo) {
        corpo.x = retX;
        corpo.y = retY;
        corpo.vx = 0;
        corpo.vy = 0;
      }
      if (cb) cb(dir);
    } else {
      atualizarParticulas();
      seguirCentro(corpo);
    }
  }
  return true;
}
