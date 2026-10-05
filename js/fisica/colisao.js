import { RAIO_CORPO } from "../config.js";
import { alturaEm, dentroDoMapa } from "../mundo/altura.js";

/**
 * Pode ocupar a célula destino vindo de (zAtual)?
 * modo: "andar" | "pular" | "escalar"
 */
export function podeEntrar(cx, cy, zAtual, modo = "andar") {
  if (!dentroDoMapa(cx, cy)) return false;
  const zDest = alturaEm(cx, cy);
  if (zDest <= 0) return false;
  const dz = zDest - zAtual;

  if (dz === 0) return true;
  if (modo === "escalar") return dz === 1;
  if (modo === "pular") return dz <= 0; // só desce / mesmo nível no ar
  // andar
  if (dz === -1) return true; // desce 1 andando
  return false;
}

/**
 * Resolve movimento com 4 cantos do corpo (AABB circular approx).
 * Retorna nova posição e z sincronizado com o chão sob os pés.
 */
export function moverComColisao(corpo, dx, dy, modo = "andar") {
  let { x, y, z } = corpo;
  const r = RAIO_CORPO;

  if (dx !== 0) {
    const nx = x + dx;
    if (cantosLivres(nx, y, z, r, modo)) x = nx;
  }
  if (dy !== 0) {
    const ny = y + dy;
    if (cantosLivres(x, ny, z, r, modo)) y = ny;
  }

  // sincroniza z com o chão quando andando (não no ar)
  if (modo === "andar" || modo === "escalar") {
    const zChao = alturaEm(Math.floor(x), Math.floor(y));
    if (zChao > 0 && (modo === "escalar" || zChao === z || zChao === z - 1)) {
      z = zChao;
    }
  }

  return { x, y, z };
}

function cantosLivres(x, y, z, r, modo) {
  const pontos = [
    [x - r, y - r],
    [x + r, y - r],
    [x - r, y + r],
    [x + r, y + r],
  ];
  for (const [px, py] of pontos) {
    const cx = Math.floor(px);
    const cy = Math.floor(py);
    if (!podeEntrar(cx, cy, z, modo)) return false;
  }
  return true;
}

/** Célula logo à frente do olhar (cardinal puro). */
export function celulaAFrente(x, y, dirX, dirY) {
  let sx = Math.sign(dirX);
  let sy = Math.sign(dirY);
  if (sx !== 0 && sy !== 0) {
    // desempate: eixo dominante
    if (Math.abs(dirX) >= Math.abs(dirY)) sy = 0;
    else sx = 0;
  }
  if (sx === 0 && sy === 0) sy = 1;
  const fx = Math.floor(x) + sx;
  const fy = Math.floor(y) + sy;
  return { cx: fx, cy: fy, z: alturaEm(fx, fy) };
}
