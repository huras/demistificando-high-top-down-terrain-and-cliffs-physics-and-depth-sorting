/** Placement determinístico dos 8 warehouses no wilderness Kanto. */

import { AREA_KANTO } from "../../mundo/regiao/grafoKanto.js";
import { deLocalKanto } from "../../mundo/bounds.js";
import { listarWarehouseIds } from "./catalogo.js";

/**
 * Offsets de área (ax, ay) longe de cidades principais.
 * Pallet 10,17 — Viridian 10,11 — Celadon 16,11 etc.
 */
const SITES = Object.freeze([
  Object.freeze({ ax: 7, ay: 14, lx: 200, ly: 180 }),
  Object.freeze({ ax: 13, ay: 15, lx: 160, ly: 220 }),
  Object.freeze({ ax: 8, ay: 9, lx: 220, ly: 140 }),
  Object.freeze({ ax: 14, ay: 8, lx: 180, ly: 200 }),
  Object.freeze({ ax: 18, ay: 13, lx: 140, ly: 160 }),
  Object.freeze({ ax: 6, ay: 6, lx: 200, ly: 180 }),
  Object.freeze({ ax: 20, ay: 9, lx: 170, ly: 190 }),
  Object.freeze({ ax: 12, ay: 18, lx: 210, ly: 150 }),
]);

/** @type {object[]|null} */
let cache = null;

export function listarWarehousesMundo() {
  if (cache) return cache;
  const ids = listarWarehouseIds();
  cache = ids.map((id, i) => {
    const s = SITES[i] || SITES[0];
    const pos = deLocalKanto(s.ax * AREA_KANTO + s.lx, s.ay * AREA_KANTO + s.ly);
    return {
      id,
      ax: s.ax,
      ay: s.ay,
      x: pos.x,
      y: pos.y,
      halfW: 5,
      halfH: 6.5,
    };
  });
  return cache;
}

export function warehousePerto(x, y, raio = 4.5) {
  const lista = listarWarehousesMundo();
  let best = null;
  let bestD = raio * raio;
  for (let i = 0; i < lista.length; i++) {
    const w = lista[i];
    const dx = w.x - x;
    const dy = w.y - y;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = w;
    }
  }
  return best;
}
