import { PULO_EPS_POUSO, RAIO_CORPO } from "../config.js";
import { alturaEm, dentroDoMapa } from "../mundo/altura.js";

export function alturaSobPes(x, y) {
  return alturaEm(Math.floor(x), Math.floor(y));
}

/**
 * Pode ocupar a célula destino?
 * modo: "andar" | "aereo" | "escalar"
 * elevacao: altura contínua dos pés (modo aereo)
 */
export function podeEntrar(cx, cy, zAtual, modo = "andar", elevacao = zAtual) {
  if (!dentroDoMapa(cx, cy)) return false;
  const zDest = alturaEm(cx, cy);

  if (modo === "aereo") {
    if (zDest <= 0) return true;
    return zDest <= elevacao + PULO_EPS_POUSO;
  }

  if (modo === "escalar") {
    if (zDest <= 0) return false;
    return zDest - zAtual === 1 || zDest === zAtual;
  }

  // andar: qualquer célula mais alta = parede (sobe com pulo ou escalada)
  if (zDest === zAtual) return true;
  if (zDest > zAtual) return false;
  return true; // zDest < zAtual ou void (0)
}

/**
 * Movimento no chão. Pode entrar em célula mais baixa — o caller inicia a queda.
 */
export function moverComColisao(corpo, dx, dy, modo = "andar") {
  let { x, y, z } = corpo;
  const r = RAIO_CORPO;
  const x0 = x;
  const y0 = y;

  if (dx !== 0) {
    const nx = x + dx;
    if (cantosLivres(nx, y, z, r, modo, z)) x = nx;
  }
  if (dy !== 0) {
    const ny = y + dy;
    if (cantosLivres(x, ny, z, r, modo, z)) y = ny;
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
 * Movimento no ar: atravessa vazios; parede se topo > elevação.
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
export function celulaAFrente(x, y, dirX, dirY) {
  let sx = Math.sign(dirX);
  let sy = Math.sign(dirY);
  if (sx !== 0 && sy !== 0) {
    if (Math.abs(dirX) >= Math.abs(dirY)) sy = 0;
    else sx = 0;
  }
  if (sx === 0 && sy === 0) sy = 1;
  const fx = Math.floor(x) + sx;
  const fy = Math.floor(y) + sy;
  return { cx: fx, cy: fy, z: alturaEm(fx, fy) };
}
