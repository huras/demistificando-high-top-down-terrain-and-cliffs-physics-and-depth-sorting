/**
 * Modo paint/erase de cercas (stroke).
 */
import { pontoNoClaim } from "../base.js";
import { validarCerca, mensagemFalha } from "../colocacao.js";
import { colocarCerca, removerCerca, cercaEm } from "../estruturas.js";
import { gastarCusto, reembolsarCusto, maxHpDoRecipe } from "../custos.js";
import { receitaConstruir, TIPO_CONSTRUIR } from "../catalogo.js";
import {
  FENCE_CATALOG_ID,
  FENCE_KIND,
  FENCE_MAX_STROKE,
  fenceKindFromCatalogId,
  tileKey,
} from "./tipos.js";
import { invalidarMapasCerca } from "./autotile.js";

/** @type {Set<string>} */
const stroke = new Set();
let strokeMode = "paint"; // paint | erase
let catalogId = FENCE_CATALOG_ID.SEGMENT;

export function iniciarStrokeCerca(id, mode = "paint") {
  catalogId = id || FENCE_CATALOG_ID.SEGMENT;
  strokeMode = mode === "erase" ? "erase" : "paint";
  stroke.clear();
}

export function limparStrokeCerca() {
  stroke.clear();
}

export function cellsStrokeCerca() {
  return [...stroke];
}

/**
 * @param {number} aimX
 * @param {number} aimY
 */
export function adicionarCellStroke(aimX, aimY) {
  if (stroke.size >= FENCE_MAX_STROKE) return { ok: false, reason: "cap" };
  const tx = Math.floor(aimX);
  const ty = Math.floor(aimY);
  const key = tileKey(tx, ty);
  if (stroke.has(key)) return { ok: true, dup: true };
  if (!pontoNoClaim(tx + 0.5, ty + 0.5)) {
    return { ok: false, reason: "outsideBase", message: mensagemFalha("outsideBase") };
  }
  if (strokeMode === "paint") {
    const v = validarCerca(catalogId, tx + 0.5, ty + 0.5);
    if (!v.ok && !cercaEm(tx, ty)) {
      return { ok: false, reason: v.reason, message: mensagemFalha(v.reason) };
    }
  }
  stroke.add(key);
  return { ok: true, tx, ty };
}

/**
 * Confirma stroke: gasta e coloca / remove.
 */
export function confirmarStrokeCerca() {
  const cells = [...stroke].map((k) => {
    const i = k.indexOf(",");
    return { tx: Number(k.slice(0, i)), ty: Number(k.slice(i + 1)) };
  });
  stroke.clear();
  if (!cells.length) return { ok: false, reason: "empty" };

  if (strokeMode === "erase") {
    let n = 0;
    for (const c of cells) {
      if (removerCerca(c.tx, c.ty)) n++;
    }
    invalidarMapasCerca();
    return { ok: true, erased: n };
  }

  const recipeOne = receitaConstruir(TIPO_CONSTRUIR.CERCA, catalogId);
  if (!recipeOne) return { ok: false, reason: "unknown" };
  const kind = fenceKindFromCatalogId(catalogId) || FENCE_KIND.SEGMENT;
  let placed = 0;
  for (const c of cells) {
    if (cercaEm(c.tx, c.ty)) continue;
    const v = validarCerca(catalogId, c.tx + 0.5, c.ty + 0.5);
    if (!v.ok) continue;
    if (!gastarCusto(recipeOne)) break;
    colocarCerca({
      tx: c.tx,
      ty: c.ty,
      kind,
      hp: maxHpDoRecipe(recipeOne),
      maxHp: maxHpDoRecipe(recipeOne),
    });
    placed++;
  }
  invalidarMapasCerca();
  return { ok: placed > 0, placed };
}

export function cancelarStrokeCerca() {
  stroke.clear();
}
