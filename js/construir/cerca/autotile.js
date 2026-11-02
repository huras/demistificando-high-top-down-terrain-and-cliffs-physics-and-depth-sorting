/**
 * Autotile de cercas: roles por vizinhos 4-dir.
 */
import { cercaEm } from "../estruturas.js";
import { FENCE_KIND, tileKey } from "./tipos.js";

/** @type {Map<string, Map<string, string>>} */
const cacheMaps = new Map();

export function invalidarMapasCerca() {
  cacheMaps.clear();
}

/**
 * @param {number} tx
 * @param {number} ty
 */
function vizinho(tx, ty, dx, dy) {
  const c = cercaEm(tx + dx, ty + dy);
  return !!(c && c.kind !== FENCE_KIND.GATE);
}

/**
 * Role visual: post / n / e / s / w / ne / ... / cross
 * @param {number} tx
 * @param {number} ty
 */
export function roleCerca(tx, ty) {
  const self = cercaEm(tx, ty);
  if (!self) return null;
  if (self.kind === FENCE_KIND.GATE) return "gate";
  const n = vizinho(tx, ty, 0, -1);
  const e = vizinho(tx, ty, 1, 0);
  const s = vizinho(tx, ty, 0, 1);
  const w = vizinho(tx, ty, -1, 0);
  const bits = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
  const ROLES = [
    "post",
    "n",
    "e",
    "ne",
    "s",
    "ns",
    "se",
    "nes",
    "w",
    "nw",
    "ew",
    "new",
    "sw",
    "nsw",
    "sew",
    "cross",
  ];
  return ROLES[bits] || "post";
}

/**
 * @param {string} areaKey
 * @param {{ tx:number, ty:number, kind:string }[]} fences
 */
export function mapaRolesArea(areaKey, fences) {
  let map = cacheMaps.get(areaKey);
  if (map) return map;
  map = new Map();
  for (const f of fences || []) {
    map.set(tileKey(f.tx, f.ty), roleCerca(f.tx, f.ty));
  }
  cacheMaps.set(areaKey, map);
  return map;
}
