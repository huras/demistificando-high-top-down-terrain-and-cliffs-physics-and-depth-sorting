import {
  ALTURA_CORPO,
  CHUNK_Y,
  PULO_EPS_POUSO,
  RAIO_CORPO,
} from "../config.js";
import { dentroDoMapa } from "../mundo/altura.js";
import { obterBloco } from "../mundo/voxel/storeMundo.js";
import { ehSolido } from "../mundo/voxel/tiposBloco.js";

/**
 * Walk height (= face acima do sólido) sob elevRef na coluna.
 * Scan voxel — funciona com N cavernas / andares.
 */
export function chaoSobElevacao(cx, cy, elevRef) {
  if (!dentroDoMapa(cx, cy)) return 0;
  let z = Math.min(CHUNK_Y - 1, Math.floor(elevRef + PULO_EPS_POUSO));
  if (z < 0) z = 0;
  for (; z >= 0; z--) {
    if (ehSolido(obterBloco(cx, cy, z))) return z + 1;
  }
  return 0;
}

/**
 * Underside do primeiro sólido acima da cabeça (teto).
 * Infinity se céu aberto.
 */
export function tetoSobreCabeca(cx, cy, elevPes, altura = ALTURA_CORPO) {
  if (!dentroDoMapa(cx, cy)) return Infinity;
  const zHead = Math.floor(elevPes + altura - 1e-4);
  const z0 = Math.max(0, zHead);
  for (let z = z0; z < CHUNK_Y; z++) {
    if (ehSolido(obterBloco(cx, cy, z))) return z;
  }
  return Infinity;
}

/** True se há sólido na faixa vertical [elevPes, elevPes+altura). */
export function corpoColideSolido(cx, cy, elevPes, altura = ALTURA_CORPO) {
  if (!dentroDoMapa(cx, cy)) return true;
  const z0 = Math.floor(elevPes + 1e-4);
  const z1 = Math.floor(elevPes + altura - 1e-4);
  for (let z = Math.max(0, z0); z <= z1 && z < CHUNK_Y; z++) {
    if (ehSolido(obterBloco(cx, cy, z))) return true;
  }
  return false;
}

/**
 * Superfície sob os pés na camada da elevação.
 * Sem elevRef → chão sob y=CHUNK_Y (topo implícito via scan do alto).
 */
export function alturaSobPes(x, y, elevRef = null, _elevAnterior = null) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (elevRef == null) return chaoSobElevacao(cx, cy, CHUNK_Y);
  return chaoSobElevacao(cx, cy, elevRef);
}

/**
 * Pode ocupar a célula destino?
 * modo: "andar" | "aereo" | "escalar"
 */
export function podeEntrar(cx, cy, zAtual, modo = "andar", elevacao = zAtual) {
  if (!dentroDoMapa(cx, cy)) return false;

  if (modo === "aereo") {
    return !corpoColideSolido(cx, cy, elevacao);
  }

  const zDest = chaoSobElevacao(cx, cy, elevacao + 0.35);

  if (modo === "escalar") {
    if (zDest <= 0) return false;
    return zDest - zAtual === 1 || zDest === zAtual;
  }

  // andar: precisa piso + espaço pra cabeça; sobe só +0 (degrau sobe = pulo)
  if (zDest <= 0) return false;
  if (corpoColideSolido(cx, cy, zDest)) return false;
  const zPes = Math.floor(zAtual + 1e-4);
  if (zDest === zPes) return true;
  if (zDest > zPes) return false;
  return true;
}

/**
 * Movimento no chão. Pode entrar em célula mais baixa — o caller inicia a queda.
 */
export function moverComColisao(corpo, dx, dy, modo = "andar") {
  let { x, y, z } = corpo;
  const r = RAIO_CORPO;
  const x0 = x;
  const y0 = y;
  const elev = corpo.elevacao ?? z;

  if (dx !== 0) {
    const nx = x + dx;
    if (cantosLivres(nx, y, elev, r, modo, elev)) x = nx;
  }
  if (dy !== 0) {
    const ny = y + dy;
    if (cantosLivres(x, ny, elev, r, modo, elev)) y = ny;
  }

  return {
    x,
    y,
    z,
    bloqueouX: dx !== 0 && x === x0,
    bloqueouY: dy !== 0 && y === y0,
  };
}

/**
 * Movimento no ar: AABB vs sólidos na faixa do corpo.
 */
export function moverAereo(corpo, dx, dy, elevacao) {
  let { x, y } = corpo;
  const r = RAIO_CORPO;
  const x0 = x;
  const y0 = y;
  const zRef = corpo.z;

  if (dx !== 0) {
    const nx = x + dx;
    if (cantosLivres(nx, y, zRef, r, "aereo", elevacao)) x = nx;
  }
  if (dy !== 0) {
    const ny = y + dy;
    if (cantosLivres(x, ny, zRef, r, "aereo", elevacao)) y = ny;
  }

  return {
    x,
    y,
    bloqueouX: dx !== 0 && x === x0,
    bloqueouY: dy !== 0 && y === y0,
  };
}

function cantosLivres(x, y, z, r, modo, elevacao) {
  const pontos = [
    [x - r, y - r],
    [x + r, y - r],
    [x - r, y + r],
    [x + r, y + r],
  ];
  for (const [px, py] of pontos) {
    const cx = Math.floor(px);
    const cy = Math.floor(py);
    if (!podeEntrar(cx, cy, z, modo, elevacao)) return false;
  }
  return true;
}

/** Célula logo à frente do olhar (cardinal puro). */
export function celulaAFrente(x, y, dirX, dirY, elevRef = null) {
  let sx = Math.sign(dirX);
  let sy = Math.sign(dirY);
  if (sx !== 0 && sy !== 0) {
    if (Math.abs(dirX) >= Math.abs(dirY)) sy = 0;
    else sx = 0;
  }
  if (sx === 0 && sy === 0) sy = 1;
  const fx = Math.floor(x) + sx;
  const fy = Math.floor(y) + sy;
  const elev = elevRef != null ? elevRef : CHUNK_Y;
  const z = chaoSobElevacao(fx, fy, elev);
  return { cx: fx, cy: fy, z };
}

/**
 * Clamp vertical: não atravessa teto sólido acima da cabeça.
 */
export function aplicarTetoOverhang(corpo) {
  const elev = corpo.elevacao ?? corpo.z;
  const r = RAIO_CORPO;
  const cantos = [
    [corpo.x - r, corpo.y - r],
    [corpo.x + r, corpo.y - r],
    [corpo.x - r, corpo.y + r],
    [corpo.x + r, corpo.y + r],
  ];

  let lim = Infinity;
  for (const [px, py] of cantos) {
    const cx = Math.floor(px);
    const cy = Math.floor(py);
    if (!dentroDoMapa(cx, cy)) continue;
    const teto = tetoSobreCabeca(cx, cy, elev);
    if (Number.isFinite(teto)) {
      lim = Math.min(lim, teto - ALTURA_CORPO);
    }
  }

  if (Number.isFinite(lim) && elev > lim) {
    corpo.elevacao = lim;
    if (corpo.vz > 0) corpo.vz = 0;
  }
}

/**
 * Lista pisos walkable da coluna (sólido abaixo, 2 ar pra cabeça).
 * Usado pelo nav multi-floor.
 */
export function listarPisosWalkable(cx, cy, maxPisos = 8) {
  if (!dentroDoMapa(cx, cy)) return [];
  const out = [];
  for (let z = 0; z < CHUNK_Y - 1 && out.length < maxPisos; z++) {
    if (!ehSolido(obterBloco(cx, cy, z))) continue;
    const floor = z + 1;
    if (floor >= CHUNK_Y) continue;
    if (ehSolido(obterBloco(cx, cy, floor))) continue;
    if (floor + 1 < CHUNK_Y && ehSolido(obterBloco(cx, cy, floor + 1))) {
      continue;
    }
    out.push(floor);
  }
  return out;
}
