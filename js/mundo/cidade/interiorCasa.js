/**
 * Móveis da sala 3D, recortados da folha de interior do Pokémon AI.
 * A posição é no chão da sala (18×15). O render e a colisão usam a mesma lista.
 */
import { origemDoChao } from "./sala3d.js";

export const FOLHA_INTERIOR =
  "/ref/sprites/interiors/Safari-Zone-Inner-Room-Hospital-Tileset-629434880.png";

export const ESCALA_MOVEL = 0.5;
export const PX_MOVEL = 16 / ESCALA_MOVEL;

export const PECAS_INTERIOR = Object.freeze([
  Object.freeze({ id: "cama-azul", col: 2, row: 36, cols: 5, rows: 6, r: 0.95 }),
  Object.freeze({ id: "cama-vermelha", col: 2, row: 30, cols: 5, rows: 6, r: 0.95 }),
  Object.freeze({ id: "cama-verde", col: 2, row: 23, cols: 5, rows: 7, r: 0.95 }),
  Object.freeze({ id: "mesa", col: 42, row: 15, cols: 3, rows: 3, r: 0.55 }),
  Object.freeze({ id: "cadeira", col: 45, row: 15, cols: 3, rows: 3, r: 0.5 }),
  Object.freeze({ id: "vaso", col: 15, row: 41, cols: 3, rows: 6, r: 0.4 }),
  Object.freeze({ id: "lixo", col: 0, row: 15, cols: 3, rows: 3, r: 0.38 }),
]);

const porId = new Map(PECAS_INTERIOR.map((peca) => [peca.id, peca]));

/** Local ao chão: x pra leste, y pra sul. A porta fica no sul, no meio. */
const PONTOS = Object.freeze([
  Object.freeze(["cama-azul", 2.6, 2.4]),
  Object.freeze(["vaso", 6.2, 1.8]),
  Object.freeze(["vaso", 15.4, 2.2]),
  Object.freeze(["mesa", 9, 6.4]),
  Object.freeze(["cadeira", 6.8, 6.4]),
  Object.freeze(["cadeira", 11.2, 6.4]),
  Object.freeze(["lixo", 2.2, 11.5]),
  Object.freeze(["cama-vermelha", 14.2, 10.2]),
]);

export function moveisDaSala() {
  const chao = origemDoChao();
  const lista = [];
  for (let i = 0; i < PONTOS.length; i++) {
    const peca = porId.get(PONTOS[i][0]);
    if (!peca) continue;
    lista.push({
      id: peca.id,
      x: chao.x + PONTOS[i][1],
      y: chao.y + PONTOS[i][2],
      r: peca.r,
    });
  }
  return lista;
}
