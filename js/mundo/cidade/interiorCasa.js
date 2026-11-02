/**
 * Móveis da sala 3D, recortados da folha de interior do Pokémon AI.
 * A posição é no chão da sala (18×15). O render e a colisão usam a mesma lista.
 */
import { origemDoChao } from "./sala3d.js";
import { hashStr, mulberry32, pickIndex } from "../../npc/rng.js";

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

/** Layout padrão (outras cidades). */
const PONTOS_PADRAO = Object.freeze([
  Object.freeze(["cama-azul", 2.6, 2.4]),
  Object.freeze(["vaso", 6.2, 1.8]),
  Object.freeze(["vaso", 15.4, 2.2]),
  Object.freeze(["mesa", 9, 6.4]),
  Object.freeze(["cadeira", 6.8, 6.4]),
  Object.freeze(["cadeira", 11.2, 6.4]),
  Object.freeze(["lixo", 2.2, 11.5]),
  Object.freeze(["cama-vermelha", 14.2, 10.2]),
]);

/** Presets Celadon: plantas em destaque. */
const PRESETS_CELADON = Object.freeze([
  Object.freeze([
    Object.freeze(["cama-verde", 2.4, 2.2]),
    Object.freeze(["vaso", 5.2, 1.6]),
    Object.freeze(["vaso", 7.4, 1.8]),
    Object.freeze(["vaso", 14.8, 2.0]),
    Object.freeze(["vaso", 16.6, 1.7]),
    Object.freeze(["mesa", 9, 6.2]),
    Object.freeze(["cadeira", 6.8, 6.2]),
    Object.freeze(["cadeira", 11.2, 6.2]),
    Object.freeze(["cama-azul", 14.0, 10.4]),
    Object.freeze(["lixo", 2.0, 12.0]),
  ]),
  Object.freeze([
    Object.freeze(["cama-vermelha", 13.8, 2.2]),
    Object.freeze(["vaso", 2.4, 2.0]),
    Object.freeze(["vaso", 4.2, 2.4]),
    Object.freeze(["vaso", 15.8, 10.8]),
    Object.freeze(["vaso", 9.0, 2.0]),
    Object.freeze(["mesa", 8.5, 7.0]),
    Object.freeze(["cadeira", 6.4, 7.0]),
    Object.freeze(["cadeira", 10.6, 7.0]),
    Object.freeze(["cama-verde", 2.6, 10.2]),
    Object.freeze(["lixo", 16.4, 12.0]),
  ]),
  Object.freeze([
    Object.freeze(["cama-azul", 2.8, 9.8]),
    Object.freeze(["cama-verde", 14.2, 2.4]),
    Object.freeze(["vaso", 6.0, 2.0]),
    Object.freeze(["vaso", 8.0, 1.6]),
    Object.freeze(["vaso", 10.0, 2.0]),
    Object.freeze(["vaso", 12.0, 1.7]),
    Object.freeze(["vaso", 16.2, 10.6]),
    Object.freeze(["mesa", 9.2, 6.6]),
    Object.freeze(["cadeira", 7.0, 6.6]),
    Object.freeze(["cadeira", 11.4, 6.6]),
  ]),
]);

/** @type {readonly (readonly [string, number, number])[]} */
let pontosAtivos = PONTOS_PADRAO;
let casaIdAtiva = "";
/** @type {null | (() => void)} */
let aoMudarLayout = null;

export function registrarRefreshMoveis(fn) {
  aoMudarLayout = typeof fn === "function" ? fn : null;
}

export function definirLayoutSala(casaId = "") {
  const id = String(casaId || "");
  if (id === casaIdAtiva) return;
  casaIdAtiva = id;
  if (id.startsWith("player-")) {
    // Casa do jogador: vazia até ele mobiliar (não herda layout de NPC).
    pontosAtivos = Object.freeze([]);
  } else if (id.startsWith("celadon:")) {
    const rng = mulberry32(hashStr(`moveis:${id}`));
    pontosAtivos = PRESETS_CELADON[pickIndex(rng, PRESETS_CELADON.length)];
  } else {
    pontosAtivos = PONTOS_PADRAO;
  }
  aoMudarLayout?.();
}

export function moveisDaSala() {
  const chao = origemDoChao();
  const lista = [];
  for (let i = 0; i < pontosAtivos.length; i++) {
    const peca = porId.get(pontosAtivos[i][0]);
    if (!peca) continue;
    lista.push({
      id: peca.id,
      x: chao.x + pontosAtivos[i][1],
      y: chao.y + pontosAtivos[i][2],
      r: peca.r,
    });
  }
  return lista;
}
