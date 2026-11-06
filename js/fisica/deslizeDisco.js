/**
 * Deslize sem atrito contra discos imóveis (árvore, pedra, cogumelo).
 * O passo perde só a componente que entra no disco; a tangente fica.
 * Sem alocação no meio do passo — o resultado sai no scratch do módulo.
 */
import { discoInvasor } from "./obstaculos.js";

const PELE = 2e-4;
const ITER = 3;
const VARREDURA = 6;

const scratch = {
  dx: 0,
  dy: 0,
  tocou: 0,
  n: 0,
  n0x: 0,
  n0y: 0,
  n1x: 0,
  n1y: 0,
};

function instanteContato(px, py, vx, vy, cx, cy, raio) {
  const ox = px - cx;
  const oy = py - cy;
  const a = vx * vx + vy * vy;
  if (a < 1e-12) return 0;
  const b = ox * vx + oy * vy;
  const c = ox * ox + oy * oy - raio * raio;
  const disc = b * b - a * c;
  if (disc < 0) return 0;
  const t = -(b + Math.sqrt(disc)) / a;
  if (!(t > 0)) return 0;
  if (t > 1) return 1;
  return t;
}

function guardarNormal(cnX, cnY, into) {
  if (!(into < -1e-8) || scratch.n >= 2) return;
  if (scratch.n === 0) {
    scratch.n0x = cnX;
    scratch.n0y = cnY;
  } else {
    scratch.n1x = cnX;
    scratch.n1y = cnY;
  }
  scratch.n++;
}

function aindaInvade(x, y, elev, raio) {
  return discoInvasor(x, y, elev, raio) != null;
}

/**
 * Encurta (dx, dy) para o maior passo que não entra no disco.
 * `n` / `n0` / `n1` são normais pra fora, só dos contatos que cortaram velocidade.
 * O objeto devolvido é reutilizado no próximo passo.
 */
export function deslizarDeltaDisco(x0, y0, dx, dy, elev, raio) {
  let x = x0;
  let y = y0;
  let vx = dx;
  let vy = dy;
  scratch.n = 0;
  scratch.tocou = 0;

  for (let n = 0; n < ITER; n++) {
    const disco = discoInvasor(x + vx, y + vy, elev, raio);
    if (!disco) break;
    scratch.tocou = 1;
    const min = raio + disco.r;
    let ox = x - disco.x;
    let oy = y - disco.y;
    let dist = Math.hypot(ox, oy);
    let cnX;
    let cnY;
    if (dist > 1e-6) {
      cnX = ox / dist;
      cnY = oy / dist;
    } else {
      cnX = 0;
      cnY = 1;
      dist = 0;
    }

    if (dist < min) {
      const falta = min + PELE - dist;
      x += cnX * falta;
      y += cnY * falta;
    } else {
      const t = instanteContato(x, y, vx, vy, disco.x, disco.y, min);
      x += vx * t;
      y += vy * t;
      const resto = 1 - t;
      vx *= resto;
      vy *= resto;
      ox = x - disco.x;
      oy = y - disco.y;
      dist = Math.hypot(ox, oy);
      if (dist > 1e-6) {
        cnX = ox / dist;
        cnY = oy / dist;
      }
    }

    const into = vx * cnX + vy * cnY;
    if (into < 0) {
      vx -= into * cnX;
      vy -= into * cnY;
    }
    guardarNormal(cnX, cnY, into);
  }

  if (aindaInvade(x + vx, y + vy, elev, raio)) {
    const bx = vx;
    const by = vy;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < VARREDURA; i++) {
      const mid = (lo + hi) * 0.5;
      if (aindaInvade(x + bx * mid, y + by * mid, elev, raio)) hi = mid;
      else lo = mid;
    }
    vx = bx * lo;
    vy = by * lo;
  }

  scratch.dx = x + vx - x0;
  scratch.dy = y + vy - y0;
  return scratch;
}

/** Tira de vx/vy a componente que entra nos discos do passo. */
export function aplicarDeslizeVelocidade(corpo, deslize) {
  if (!corpo || !deslize || !(deslize.n > 0)) return;
  let vx = corpo.vx;
  let vy = corpo.vy;
  if (typeof vx !== "number" || typeof vy !== "number") return;
  const into0 = vx * deslize.n0x + vy * deslize.n0y;
  if (into0 < 0) {
    vx -= into0 * deslize.n0x;
    vy -= into0 * deslize.n0y;
  }
  if (deslize.n > 1) {
    const into1 = vx * deslize.n1x + vy * deslize.n1y;
    if (into1 < 0) {
      vx -= into1 * deslize.n1x;
      vy -= into1 * deslize.n1y;
    }
  }
  corpo.vx = vx;
  corpo.vy = vy;
}
