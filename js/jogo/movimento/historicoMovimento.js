/**
 * Histórico de movimento: ring buffer + EMAs em 0.5s / 2s / 8s.
 * Alimenta prefetch de chunks e a predição de direção.
 */

const CAP = 160;
const DIST_MIN = 0.35;
const DT_MIN = 1 / 15;

const xs = new Float64Array(CAP);
const ys = new Float64Array(CAP);
const ts = new Float64Array(CAP);
let n = 0;
let head = 0;
let tAcum = 0;
let ultimoX = NaN;
let ultimoY = NaN;

let emaCurtaX = 0;
let emaCurtaY = 0;
let emaMediaX = 0;
let emaMediaY = 0;
let emaLongaX = 0;
let emaLongaY = 0;
let predX = 0;
let predY = 0;
let predLen = 0;

function tauParaAlfa(dt, tau) {
  if (dt <= 0) return 0;
  return 1 - Math.exp(-dt / tau);
}

function empurrar(x, y, t) {
  xs[head] = x;
  ys[head] = y;
  ts[head] = t;
  head = (head + 1) % CAP;
  if (n < CAP) n++;
}

/**
 * Atualiza amostras e EMAs a partir do corpo (vx/vy + dirX/dirY).
 */
export function tickHistorico(corpo, dt) {
  if (!corpo) return;
  const d = Math.max(0, dt || 0);
  tAcum += d;
  const x = corpo.x;
  const y = corpo.y;

  let vx = corpo.vx ?? 0;
  let vy = corpo.vy ?? 0;
  const sp = Math.hypot(vx, vy);
  if (sp < 0.08) {
    const dx = corpo.dirX ?? 0;
    const dy = corpo.dirY ?? 1;
    const dl = Math.hypot(dx, dy) || 1;
    vx = (dx / dl) * 0.01;
    vy = (dy / dl) * 0.01;
  }

  const aC = tauParaAlfa(d, 0.5);
  const aM = tauParaAlfa(d, 2);
  const aL = tauParaAlfa(d, 8);
  emaCurtaX += (vx - emaCurtaX) * aC;
  emaCurtaY += (vy - emaCurtaY) * aC;
  emaMediaX += (vx - emaMediaX) * aM;
  emaMediaY += (vy - emaMediaY) * aM;
  emaLongaX += (vx - emaLongaX) * aL;
  emaLongaY += (vy - emaLongaY) * aL;

  // Blend: curto reage, longo estabiliza o prefetch.
  const bx = emaCurtaX * 0.55 + emaMediaX * 0.3 + emaLongaX * 0.15;
  const by = emaCurtaY * 0.55 + emaMediaY * 0.3 + emaLongaY * 0.15;
  predLen = Math.hypot(bx, by);
  if (predLen > 1e-6) {
    predX = bx / predLen;
    predY = by / predLen;
  } else {
    const dx = corpo.dirX ?? 0;
    const dy = corpo.dirY ?? 1;
    const dl = Math.hypot(dx, dy) || 1;
    predX = dx / dl;
    predY = dy / dl;
    predLen = 0;
  }

  if (!Number.isFinite(ultimoX)) {
    ultimoX = x;
    ultimoY = y;
    empurrar(x, y, tAcum);
    return;
  }
  const dist = Math.hypot(x - ultimoX, y - ultimoY);
  const tUlt = n > 0 ? ts[(head - 1 + CAP) % CAP] : -1e9;
  if (dist < DIST_MIN && tAcum - tUlt < DT_MIN) return;
  ultimoX = x;
  ultimoY = y;
  empurrar(x, y, tAcum);
}

/** Direção unitária prevista (mundo X/Y). */
export function vetorPredicao() {
  return { x: predX, y: predY, len: predLen };
}

export function obterEmas() {
  return {
    curta: { x: emaCurtaX, y: emaCurtaY },
    media: { x: emaMediaX, y: emaMediaY },
    longa: { x: emaLongaX, y: emaLongaY },
  };
}

/** Copia amostras recentes (mais antigas primeiro) para buffer externo. */
export function copiarAmostras(outX, outY, outT, max = CAP) {
  const q = Math.min(n, max | 0);
  const inicio = (head - n + CAP) % CAP;
  for (let i = 0; i < q; i++) {
    const j = (inicio + i) % CAP;
    outX[i] = xs[j];
    outY[i] = ys[j];
    if (outT) outT[i] = ts[j];
  }
  return q;
}

export function resetarHistorico() {
  n = 0;
  head = 0;
  tAcum = 0;
  ultimoX = NaN;
  ultimoY = NaN;
  emaCurtaX = emaCurtaY = 0;
  emaMediaX = emaMediaY = 0;
  emaLongaX = emaLongaY = 0;
  predX = 0;
  predY = 1;
  predLen = 0;
}
