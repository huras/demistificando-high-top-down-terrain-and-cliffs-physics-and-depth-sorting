/**
 * Gasto / reembolso de materiais via bolsa (contarItem / ajustarItem).
 */
import { CRISTAIS, MATERIAIS } from "../wild/catalogo.js";
import { ajustarItem, contarItem } from "../pokemon/party.js";

export const MATERIAIS_BASE = Object.freeze(["wood", "stone", "plantFiber"]);

/**
 * @param {object|null|undefined} recipe
 * @returns {Record<string, number>}
 */
export function custosDoRecipe(recipe) {
  /** @type {Record<string, number>} */
  const out = Object.create(null);
  if (!recipe) return out;
  const src = recipe.costs && typeof recipe.costs === "object" ? recipe.costs : recipe;
  for (const [key, n] of Object.entries(src)) {
    if (
      key === "cols" ||
      key === "rows" ||
      key === "floors" ||
      key === "costs" ||
      key === "except" ||
      key === "exceptCrystals" ||
      key === "ballKey" ||
      key === "id" ||
      key === "kind" ||
      key === "buildingId" ||
      key === "label" ||
      key === "enterable"
    ) {
      continue;
    }
    const amount = n | 0;
    if (amount > 0) out[key] = amount;
  }
  return out;
}

/**
 * @param {object|null|undefined} recipe
 * @returns {string[]}
 */
export function exceptoCristais(recipe) {
  const raw = recipe?.exceptCrystals ?? recipe?.except;
  if (!Array.isArray(raw)) return [];
  return raw.filter((k) => typeof k === "string" && k);
}

/**
 * @param {string[]|null|undefined} except
 */
export function chavesCristal(except) {
  if (!except?.length) return CRISTAIS.slice();
  const ban = new Set(except);
  return CRISTAIS.filter((k) => !ban.has(k));
}

export function contarCristais(except) {
  let total = 0;
  for (const key of chavesCristal(except)) total += contarItem(key) | 0;
  return total;
}

/**
 * @param {object|null|undefined} recipe
 */
export function podePagar(recipe) {
  if (!recipe) return false;
  const costs = custosDoRecipe(recipe);
  const except = exceptoCristais(recipe);
  for (const [key, amount] of Object.entries(costs)) {
    if (key === "anyCrystal") {
      if (contarCristais(except) < amount) return false;
      continue;
    }
    if ((contarItem(key) | 0) < amount) return false;
  }
  return true;
}

function gastarCristais(amount, except) {
  let left = amount | 0;
  if (left <= 0) return true;
  if (contarCristais(except) < left) return false;
  const keys = chavesCristal(except)
    .map((key) => ({ key, n: contarItem(key) | 0 }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);
  for (const row of keys) {
    if (left <= 0) break;
    const take = Math.min(row.n, left);
    ajustarItem(row.key, -take, "mudo");
    left -= take;
  }
  return left <= 0;
}

/**
 * @param {object|null|undefined} recipe
 * @returns {boolean}
 */
export function gastarCusto(recipe) {
  if (!podePagar(recipe)) return false;
  const costs = custosDoRecipe(recipe);
  const except = exceptoCristais(recipe);
  for (const [key, amount] of Object.entries(costs)) {
    if (key === "anyCrystal") {
      if (!gastarCristais(amount, except)) return false;
      continue;
    }
    ajustarItem(key, -amount, "mudo");
  }
  return true;
}

/**
 * Devolve materiais (metade arredondada pra cima por chave, mínimo 1 se havia custo).
 * @param {object|null|undefined} recipe
 * @param {{ full?: boolean }} [opts]
 * @returns {Record<string, number>}
 */
export function reembolsarCusto(recipe, opts = {}) {
  const costs = custosDoRecipe(recipe);
  /** @type {Record<string, number>} */
  const out = Object.create(null);
  for (const [key, amount] of Object.entries(costs)) {
    if (key === "anyCrystal") continue;
    const n = opts.full ? amount | 0 : Math.max(1, Math.ceil((amount | 0) * 0.5));
    if (n <= 0) continue;
    out[key] = n;
    ajustarItem(key, n, "mudo");
  }
  return out;
}

/**
 * @param {Record<string, number>} a
 * @param {Record<string, number>} b
 */
export function mesclarCustos(a, b) {
  for (const [key, n] of Object.entries(b || {})) {
    const v = n | 0;
    if (v <= 0) continue;
    a[key] = (a[key] | 0) + v;
  }
  return a;
}

export function nomeMaterial(key) {
  return MATERIAIS[key]?.nome || key;
}

export function maxHpDoRecipe(recipe) {
  const costs = custosDoRecipe(recipe);
  let total = 0;
  for (const n of Object.values(costs)) total += n | 0;
  return Math.max(8, total * 4);
}
