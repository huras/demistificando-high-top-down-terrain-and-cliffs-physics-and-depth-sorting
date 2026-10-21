/**
 * Pool de rajadas em mundo. Spawn upwind da câmera; curvas sozinhas.
 */
import { CLIMA_CFG } from "../../../../clima/config.js";
import { intervaloSpawnGale, ventoHud01 } from "../../../../clima/vento.js";
import { VARIANTES_GALE } from "./formaGouja.js";

const MAX = 28;

function criarRajada() {
  return {
    hx: 0,
    hy: 0,
    mx: 0,
    my: 0,
    tx: 0,
    ty: 0,
    dirX: 1,
    dirY: 0,
    tailDirX: 1,
    tailDirY: 0,
    halfLen: 2.5,
    speed: 12,
    varIdx: 0,
    steer: 1,
    fase: 0,
    omega: 1,
    z: 1.2,
  };
}

function alinharTrilho(r, hx, hy, dirX, dirY, halfLen) {
  r.hx = hx;
  r.hy = hy;
  r.dirX = dirX;
  r.dirY = dirY;
  r.tailDirX = dirX;
  r.tailDirY = dirY;
  r.halfLen = halfLen;
  r.mx = hx - dirX * halfLen;
  r.my = hy - dirY * halfLen;
  r.tx = hx - dirX * halfLen * 2;
  r.ty = hy - dirY * halfLen * 2;
}

function puxarRumo(dx, dy, tx, ty, dt, rate) {
  let x = dx;
  let y = dy;
  const len = Math.hypot(x, y) || 1;
  x /= len;
  y /= len;
  const al = Math.hypot(tx, ty) || 1;
  const ax = tx / al;
  const ay = ty / al;
  const cruz = x * ay - y * ax;
  const dot = x * ax + y * ay;
  const ang = Math.atan2(cruz, dot);
  const max = rate * dt;
  const d = Math.max(-max, Math.min(max, ang));
  const c = Math.cos(d);
  const s = Math.sin(d);
  return { x: x * c - y * s, y: x * s + y * c };
}

export function criarEstadoGale() {
  return {
    rajadas: [],
    livres: [],
    spawnCd: 0.4,
    seq: 0,
    dirX: 1,
    dirY: 0,
    dirPronta: false,
  };
}

function esvaziar(estado) {
  for (let i = 0; i < estado.rajadas.length; i++) estado.livres.push(estado.rajadas[i]);
  estado.rajadas.length = 0;
}

function obter(estado) {
  return estado.livres.pop() ?? criarRajada();
}

/**
 * @param {object} estado
 * @param {number} dt
 * @param {{ intensidade: number, vx: number, vy: number }} vento
 * @param {{ x: number, y: number }} centro câmera/player no chão
 * @param {number} raio metade da janela de spawn
 * @param {object} [cfg]
 */
export function atualizarCampoGale(estado, dt, vento, centro, raio, cfg = CLIMA_CFG) {
  if (!(dt > 0) || !centro) return;
  const wind = vento?.intensidade ?? 0;
  const wind01 = ventoHud01(vento, cfg);
  const wSparse = cfg.galeWindSparse ?? 0.12;
  if (!(wind >= wSparse * 0.85) && !(wind01 > 0.08)) {
    esvaziar(estado);
    estado.spawnCd = 0.5;
    estado.dirPronta = false;
    return;
  }

  let dirX = vento.vx ?? 0.8;
  let dirY = vento.vy ?? 0.2;
  let len = Math.hypot(dirX, dirY) || 1;
  dirX /= len;
  dirY /= len;
  // Quase horizontal (Wind Waker): limita componente "norte-sul" visual.
  if (Math.abs(dirY) > 0.07) dirY = Math.sign(dirY) * 0.07;
  len = Math.hypot(dirX, dirY) || 1;
  dirX /= len;
  dirY /= len;

  if (!estado.dirPronta) {
    estado.dirX = dirX;
    estado.dirY = dirY;
    estado.dirPronta = true;
  } else {
    const rumo = puxarRumo(estado.dirX, estado.dirY, dirX, dirY, dt, 1.1);
    estado.dirX = rumo.x;
    estado.dirY = rumo.y;
  }
  dirX = estado.dirX;
  dirY = estado.dirY;
  const perpX = -dirY;
  const perpY = dirX;

  const halfMin = cfg.galeHalfLenMin ?? 7.2;
  const halfMax = cfg.galeHalfLenMax ?? 16;
  const halfLenBase = halfMin + wind01 * (halfMax - halfMin);
  const pad = halfLenBase * 2.05 + (raio || 18) * 0.4;
  const speedBase = 11 + wind01 * 28;
  const steerBase = cfg.galeSteerPerSec ?? 1.6;
  const tailLag = cfg.galeTailLag ?? 0.42;
  const wander = cfg.galeWander ?? 0.055;
  const maxVivos = Math.min(MAX, Math.ceil((cfg.galeGouges ?? 14) * (0.45 + wind01)));

  const vivos = estado.rajadas;
  let w = 0;
  for (let i = 0; i < vivos.length; i++) {
    const r = vivos[i];
    const rumo = puxarRumo(r.dirX, r.dirY, dirX, dirY, dt, steerBase * r.steer);
    r.dirX = rumo.x;
    r.dirY = rumo.y;
    r.fase += r.omega * dt;
    const wob = Math.sin(r.fase) * wander;
    const mx = r.dirX * Math.cos(wob) - r.dirY * Math.sin(wob);
    const my = r.dirX * Math.sin(wob) + r.dirY * Math.cos(wob);
    r.hx += mx * r.speed * dt;
    r.hy += my * r.speed * dt;
    const lag = 1 - Math.pow(1 - tailLag, dt * 60);
    r.mx += (r.hx - r.dirX * r.halfLen - r.mx) * lag;
    r.my += (r.hy - r.dirY * r.halfLen - r.my) * lag;
    r.tx += (r.mx - r.dirX * r.halfLen - r.tx) * lag;
    r.ty += (r.my - r.dirY * r.halfLen - r.ty) * lag;
    r.tailDirX += (r.dirX - r.tailDirX) * lag;
    r.tailDirY += (r.dirY - r.tailDirY) * lag;

    const dx = r.hx - centro.x;
    const dy = r.hy - centro.y;
    if (dx * dx + dy * dy > (pad + halfLenBase * 3) ** 2) {
      estado.livres.push(r);
      continue;
    }
    vivos[w++] = r;
  }
  vivos.length = w;

  estado.spawnCd -= dt;
  const intervalo = intervaloSpawnGale(wind01, cfg);
  while (estado.spawnCd <= 0 && vivos.length < maxVivos) {
    estado.spawnCd += intervalo * (0.55 + Math.random() * 0.9);
    const lat = (Math.random() - 0.5) * (raio || 18) * 1.6;
    const hx = centro.x - dirX * pad + perpX * lat;
    const hy = centro.y - dirY * pad + perpY * lat;
    const r = obter(estado);
    const half = halfLenBase * (0.88 + Math.random() * 0.35);
    alinharTrilho(r, hx, hy, dirX, dirY, half);
    r.speed = speedBase * (0.75 + Math.random() * 0.5);
    r.varIdx = estado.seq % VARIANTES_GALE.length;
    r.steer = 0.7 + Math.random() * 0.6;
    r.fase = Math.random() * Math.PI * 2;
    r.omega = 1.2 + Math.random() * 1.8;
    r.z = 0.9 + Math.random() * 1.4;
    estado.seq += 1;
    vivos.push(r);
  }
  if (estado.spawnCd < 0) estado.spawnCd = 0;
}

export function listarRajadas(estado) {
  return estado.rajadas;
}
