import { ALTURAS, COLUNAS, LINHAS } from "./mapaDemo.js";

export function dentroDoMapa(cx, cy) {
  return cx >= 0 && cy >= 0 && cx < COLUNAS && cy < LINHAS;
}

export function alturaEm(cx, cy) {
  const x = cx | 0;
  const y = cy | 0;
  if (!dentroDoMapa(x, y)) return 0;
  return ALTURAS[y][x] | 0;
}

export function alturaNoPonto(x, y) {
  return alturaEm(Math.floor(x), Math.floor(y));
}

export function vizinho(cx, cy, dx, dy) {
  return { x: cx + dx, y: cy + dy, z: alturaEm(cx + dx, cy + dy) };
}

/** Queda sul: Δz positivo se a célula atual é mais alta que a do sul. */
export function quedaSul(cx, cy) {
  const z = alturaEm(cx, cy);
  const zs = alturaEm(cx, cy + 1);
  return z - zs;
}
