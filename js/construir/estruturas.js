/**
 * Casas, móveis outdoor e cercas do jogador (coords mundiais absolutas).
 * Buckets por área Kanto só para caps/streaming.
 */
import { AREA_KANTO } from "../mundo/regiao/grafoKanto.js";
import { paraLocalKanto } from "../mundo/bounds.js";
import { alturaDoRelevo } from "../mundo/bioma/catalogo.js";
import { pegadaCasa, receitaConstruir, TIPO_CONSTRUIR } from "./catalogo.js";
import { maxHpDoRecipe, mesclarCustos, reembolsarCusto } from "./custos.js";
import { adicionarStockCasa, adicionarStockMovel } from "./stock.js";
import { limparOcupacao, reconstruirOcupacao } from "./ocupacao.js";
import { FENCE_KIND, FENCE_MAX_PER_AREA, tileKey } from "./cerca/tipos.js";

const MAX_BUCKETS = 200;
const MAX_CASAS = 64;
const MAX_MOVEIS = 128;

/** @typedef {{ houses: object[], interiors: Record<string, object>, outdoorFurniture: object[], fences: object[] }} BundleLike */

/** @type {Record<string, BundleLike>} */
let porArea = Object.create(null);

let versaoEstruturas = 0;
let seqCasa = 1;

export function versaoEstruturasJogador() {
  return versaoEstruturas;
}

function bump() {
  versaoEstruturas++;
}

function emptyBundle() {
  return { houses: [], interiors: {}, outdoorFurniture: [], fences: [] };
}

/**
 * @param {number} wx
 * @param {number} wy
 */
export function chaveAreaDe(wx, wy) {
  const local = paraLocalKanto(wx, wy);
  if (!local) {
    return `${Math.floor(wx / AREA_KANTO)},${Math.floor(wy / AREA_KANTO)}`;
  }
  return `${Math.floor(local.x / AREA_KANTO)},${Math.floor(local.y / AREA_KANTO)}`;
}

/**
 * @param {string} key
 * @returns {BundleLike}
 */
export function obterBundle(key) {
  let b = porArea[key];
  if (!b) {
    b = emptyBundle();
    porArea[key] = b;
  }
  if (!Array.isArray(b.houses)) b.houses = [];
  if (!b.interiors || typeof b.interiors !== "object") b.interiors = {};
  if (!Array.isArray(b.outdoorFurniture)) b.outdoorFurniture = [];
  if (!Array.isArray(b.fences)) b.fences = [];
  return b;
}

export function obterBundleEm(wx, wy) {
  return obterBundle(chaveAreaDe(wx, wy));
}

export function resetEstruturas() {
  porArea = Object.create(null);
  seqCasa = 1;
  limparOcupacao();
  bump();
}

export function listarBundles() {
  return Object.values(porArea);
}

export function listarCasas() {
  const out = [];
  for (const b of Object.values(porArea)) {
    for (const h of b.houses) out.push(h);
  }
  return out;
}

export function listarMoveisOutdoor() {
  const out = [];
  for (const b of Object.values(porArea)) {
    for (const f of b.outdoorFurniture) out.push(f);
  }
  return out;
}

export function listarCercas() {
  const out = [];
  for (const b of Object.values(porArea)) {
    for (const f of b.fences) out.push(f);
  }
  return out;
}

/**
 * @param {number} wx
 * @param {number} wy
 * @param {number} [raio]
 */
export function casasPerto(wx, wy, raio = 48) {
  const r2 = raio * raio;
  return listarCasas().filter((h) => {
    const dx = h.x - wx;
    const dy = h.y - wy;
    return dx * dx + dy * dy <= r2;
  });
}

export function proximoIdCasa(wx, wy) {
  const key = chaveAreaDe(wx, wy);
  let id = `player-house-${key}-${seqCasa++}`;
  const used = new Set(obterBundle(key).houses.map((h) => h.id));
  while (used.has(id)) id = `player-house-${key}-${seqCasa++}`;
  return id;
}

/**
 * @param {object} opts
 */
export function criarRegistroCasa(opts) {
  const fp = pegadaCasa(opts.buildingId);
  const cols = opts.cols || fp.cols;
  const rows = opts.rows || fp.rows;
  const recipe = receitaConstruir(TIPO_CONSTRUIR.CASA, opts.buildingId);
  return {
    id: opts.id,
    kind: "house",
    buildingId: opts.buildingId,
    x: opts.x,
    y: opts.y,
    z: Number.isFinite(opts.z) ? opts.z : alturaDoRelevo(opts.x, opts.y),
    cols,
    rows,
    floors: Math.max(1, opts.floors | 0 || 1),
    enterable: opts.enterable ?? recipe?.enterable ?? true,
    owner: "player",
    label: opts.label || "Casa",
    yaw: opts.yaw || 0,
    hp: opts.hp ?? maxHpDoRecipe(recipe),
    maxHp: opts.maxHp ?? maxHpDoRecipe(recipe),
  };
}

/**
 * @param {object} house
 */
export function colocarCasa(house) {
  const bundle = obterBundleEm(house.x, house.y);
  if (bundle.houses.length >= MAX_CASAS) return null;
  bundle.houses.push(house);
  if (!bundle.interiors[house.id]) {
    bundle.interiors[house.id] = {
      floors: Array.from({ length: Math.max(1, house.floors | 0) }, () => ({
        furniture: [],
        drops: [],
      })),
    };
  }
  rebuildOcc();
  bump();
  return house;
}

/**
 * @param {string} houseId
 */
export function acharCasa(houseId) {
  for (const b of Object.values(porArea)) {
    const h = b.houses.find((x) => x.id === houseId);
    if (h) return h;
  }
  return null;
}

/**
 * @param {string} houseId
 */
export function demolirCasa(houseId) {
  for (const [key, b] of Object.entries(porArea)) {
    const idx = b.houses.findIndex((h) => h.id === houseId);
    if (idx < 0) continue;
    const house = b.houses[idx];
    const recipe = receitaConstruir(TIPO_CONSTRUIR.CASA, house.buildingId);
    /** @type {Record<string, number>} */
    const materials = Object.create(null);
    mesclarCustos(materials, reembolsarCusto(recipe));
    const interior = b.interiors[house.id];
    for (const floor of interior?.floors || []) {
      for (const item of floor?.furniture || []) {
        if (!item?.key) continue;
        const r = receitaConstruir(TIPO_CONSTRUIR.MOVEL, item.key);
        mesclarCustos(materials, reembolsarCusto(r));
        adicionarStockMovel(item.key, 1);
      }
    }
    delete b.interiors[house.id];
    b.houses.splice(idx, 1);
    adicionarStockCasa(house.buildingId, 1);
    if (!b.houses.length && !b.outdoorFurniture.length && !b.fences.length) {
      delete porArea[key];
    }
    rebuildOcc();
    bump();
    return { ok: true, house, materialsRefunded: materials };
  }
  return { ok: false, reason: "missing" };
}

/**
 * @param {object} item { id?, key, x, y, cols?, rows? }
 */
export function colocarMovelOutdoor(item) {
  const bundle = obterBundleEm(item.x, item.y);
  if (bundle.outdoorFurniture.length >= MAX_MOVEIS) return null;
  const row = {
    id: item.id || `player-furn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    key: item.key,
    x: Math.floor(item.x),
    y: Math.floor(item.y),
    z: Number.isFinite(item.z) ? item.z : alturaDoRelevo(item.x, item.y),
    cols: item.cols || 1,
    rows: item.rows || 1,
    hp: item.hp,
    maxHp: item.maxHp,
  };
  bundle.outdoorFurniture.push(row);
  rebuildOcc();
  bump();
  return row;
}

export function demolirMovelOutdoor(id) {
  for (const b of Object.values(porArea)) {
    const idx = b.outdoorFurniture.findIndex((f) => f.id === id);
    if (idx < 0) continue;
    const item = b.outdoorFurniture[idx];
    b.outdoorFurniture.splice(idx, 1);
    adicionarStockMovel(item.key, 1);
    const recipe = receitaConstruir(TIPO_CONSTRUIR.MOVEL, item.key);
    const materials = reembolsarCusto(recipe);
    rebuildOcc();
    bump();
    return { ok: true, item, materialsRefunded: materials };
  }
  return { ok: false };
}

/**
 * @param {{ tx:number, ty:number, kind:string, hp?:number, maxHp?:number }} cell
 */
export function colocarCerca(cell) {
  const bundle = obterBundleEm(cell.tx + 0.5, cell.ty + 0.5);
  if (bundle.fences.length >= FENCE_MAX_PER_AREA) return null;
  const key = tileKey(cell.tx, cell.ty);
  if (bundle.fences.some((f) => tileKey(f.tx, f.ty) === key)) return null;
  const row = {
    tx: cell.tx | 0,
    ty: cell.ty | 0,
    kind: cell.kind === FENCE_KIND.GATE ? FENCE_KIND.GATE : FENCE_KIND.SEGMENT,
    hp: cell.hp,
    maxHp: cell.maxHp,
  };
  bundle.fences.push(row);
  rebuildOcc();
  bump();
  return row;
}

export function removerCerca(tx, ty) {
  const key = tileKey(tx, ty);
  for (const b of Object.values(porArea)) {
    const idx = b.fences.findIndex((f) => tileKey(f.tx, f.ty) === key);
    if (idx < 0) continue;
    const [row] = b.fences.splice(idx, 1);
    rebuildOcc();
    bump();
    return row;
  }
  return null;
}

export function cercaEm(tx, ty) {
  const key = tileKey(tx, ty);
  for (const b of Object.values(porArea)) {
    const f = b.fences.find((c) => tileKey(c.tx, c.ty) === key);
    if (f) return f;
  }
  return null;
}

/**
 * Traduz estruturas dentro do claim antigo.
 * @param {number} dx
 * @param {number} dy
 * @param {{ x0:number,y0:number,x1:number,y1:number }} claimAntigo
 */
export function traduzirEstruturas(dx, dy, claimAntigo) {
  if (!dx && !dy) return;
  const dentro = (x, y) =>
    x >= claimAntigo.x0 &&
    x < claimAntigo.x1 &&
    y >= claimAntigo.y0 &&
    y < claimAntigo.y1;

  /** @type {BundleLike[]} */
  const snapshot = listarBundles().map((b) => ({
    houses: b.houses.slice(),
    outdoorFurniture: b.outdoorFurniture.slice(),
    fences: b.fences.slice(),
    interiors: b.interiors,
  }));

  // Reagrupa movendo itens entre buckets
  const casas = [];
  const moveis = [];
  const cercas = [];
  const interiors = Object.create(null);

  for (const b of snapshot) {
    Object.assign(interiors, b.interiors);
    for (const h of b.houses) {
      if (dentro(h.x, h.y)) casas.push({ ...h, x: h.x + dx, y: h.y + dy });
      else casas.push(h);
    }
    for (const f of b.outdoorFurniture) {
      if (dentro(f.x + 0.5, f.y + 0.5)) {
        moveis.push({ ...f, x: f.x + dx, y: f.y + dy });
      } else moveis.push(f);
    }
    for (const c of b.fences) {
      if (dentro(c.tx + 0.5, c.ty + 0.5)) {
        cercas.push({ ...c, tx: c.tx + dx, ty: c.ty + dy });
      } else cercas.push(c);
    }
  }

  porArea = Object.create(null);
  for (const h of casas) {
    const b = obterBundleEm(h.x, h.y);
    b.houses.push(h);
    if (interiors[h.id]) b.interiors[h.id] = interiors[h.id];
  }
  for (const f of moveis) obterBundleEm(f.x, f.y).outdoorFurniture.push(f);
  for (const c of cercas) obterBundleEm(c.tx + 0.5, c.ty + 0.5).fences.push(c);
  rebuildOcc();
  bump();
}

/**
 * Sync móveis indoor (estado.moveis) → interiors do bundle.
 * @param {string} houseId
 * @param {object[]} moveis
 */
export function syncInteriorMoveis(houseId, moveis) {
  const house = acharCasa(houseId);
  if (!house) return;
  const bundle = obterBundleEm(house.x, house.y);
  if (!bundle.interiors[houseId]) {
    bundle.interiors[houseId] = { floors: [{ furniture: [], drops: [] }] };
  }
  const floor = bundle.interiors[houseId].floors[0];
  floor.furniture = (moveis || []).map((m) => ({
    key: m.key,
    x: m.x,
    y: m.y,
  }));
  bump();
}

export function interiorDaCasa(houseId) {
  for (const b of Object.values(porArea)) {
    if (b.interiors[houseId]) return b.interiors[houseId];
  }
  return null;
}

function rebuildOcc() {
  reconstruirOcupacao(Object.values(porArea));
}

export function serializarEstruturas() {
  const areas = Object.create(null);
  let n = 0;
  for (const [key, b] of Object.entries(porArea)) {
    if (n >= MAX_BUCKETS) break;
    areas[key] = {
      houses: b.houses.map((h) => ({ ...h })),
      interiors: b.interiors,
      outdoorFurniture: b.outdoorFurniture.map((f) => ({ ...f })),
      fences: b.fences.map((f) => ({ ...f })),
    };
    n++;
  }
  return { areas, seqCasa };
}

export function hidratarEstruturas(dados) {
  porArea = Object.create(null);
  seqCasa = Math.max(1, dados?.seqCasa | 0 || 1);
  const areas = dados?.areas || dados || {};
  for (const [key, b] of Object.entries(areas)) {
    if (!b || typeof b !== "object") continue;
    const bundle = emptyBundle();
    bundle.houses = Array.isArray(b.houses) ? b.houses.slice(0, MAX_CASAS) : [];
    bundle.interiors = b.interiors && typeof b.interiors === "object" ? b.interiors : {};
    bundle.outdoorFurniture = Array.isArray(b.outdoorFurniture)
      ? b.outdoorFurniture.slice(0, MAX_MOVEIS)
      : [];
    bundle.fences = Array.isArray(b.fences)
      ? b.fences.slice(0, FENCE_MAX_PER_AREA)
      : [];
    porArea[key] = bundle;
  }
  rebuildOcc();
  bump();
}

/** Props de colisão para indexarBases / stream. */
export function propsColisaoCasas() {
  const out = [];
  for (const h of listarCasas()) {
    const z = Number.isFinite(h.z) ? h.z : alturaDoRelevo(h.x, h.y);
    const cols = h.cols || 6;
    const rows = h.rows || 5;
    const x0 = Math.floor(h.x - cols / 2);
    const y0 = Math.floor(h.y - rows / 2);
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        out.push({
          id: `${h.id}:${ix},${iy}`,
          tipo: "baseCasa",
          houseId: h.id,
          x: x0 + ix + 0.5,
          y: y0 + iy + 0.5,
          z,
          r: 0.55,
        });
      }
    }
  }
  for (const f of listarMoveisOutdoor()) {
    out.push({
      id: f.id,
      tipo: "baseMovel",
      x: f.x + 0.5,
      y: f.y + 0.5,
      z: f.z ?? alturaDoRelevo(f.x, f.y),
      r: 0.4,
    });
  }
  for (const c of listarCercas()) {
    if (c.kind === FENCE_KIND.GATE) continue;
    out.push({
      id: `fence:${c.tx},${c.ty}`,
      tipo: "baseCerca",
      x: c.tx + 0.5,
      y: c.ty + 0.5,
      z: alturaDoRelevo(c.tx + 0.5, c.ty + 0.5),
      r: 0.35,
    });
  }
  return out;
}
