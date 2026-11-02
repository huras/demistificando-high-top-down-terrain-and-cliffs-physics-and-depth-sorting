/**
 * Ritual de construção: reserva custo → companion martela → commit.
 */
import { TIPO_CONSTRUIR } from "./catalogo.js";
import { gastarCusto, reembolsarCusto, maxHpDoRecipe } from "./custos.js";
import { obterPreview, mensagemFalha } from "./colocacao.js";
import {
  colocarCasa,
  colocarCerca,
  colocarMovelOutdoor,
  criarRegistroCasa,
  proximoIdCasa,
} from "./estruturas.js";
import {
  adicionarStockCasa,
  adicionarStockMovel,
  consumirStockCasa,
  consumirStockMovel,
} from "./stock.js";
import { FENCE_KIND } from "./cerca/tipos.js";
import { poeiraDoPreview } from "./poeira.js";

/** @type {object|null} */
let site = null;

export function siteConstrucao() {
  return site;
}

export function temRitualAtivo() {
  return !!site;
}

/**
 * @param {object} recipe
 */
export function planoRitual(recipe) {
  const hp = maxHpDoRecipe(recipe);
  const hits = Math.max(4, Math.min(16, Math.ceil(hp / 12)));
  return {
    hitsNeeded: hits,
    hitsDone: 0,
    burst: 1,
    nextBurstAt: 3,
  };
}

/**
 * @returns {{ ok: boolean, reason?: string, site?: object, message?: string }}
 */
export function iniciarRitual(selected, aimX, aimY, player) {
  if (site) return { ok: false, reason: "busy", message: "Já há uma construção em andamento." };
  const check = obterPreview(selected, aimX, aimY, player);
  if (!check?.ok) {
    return { ok: false, reason: check?.reason || "unknown", message: mensagemFalha(check?.reason) };
  }
  const recipe = check.recipe;
  let usedStock = false;
  if (selected.kind === TIPO_CONSTRUIR.CASA) {
    usedStock = consumirStockCasa(selected.id, 1);
  } else if (selected.kind === TIPO_CONSTRUIR.MOVEL) {
    usedStock = consumirStockMovel(selected.id, 1);
  }
  if (!usedStock && !gastarCusto(recipe)) {
    return { ok: false, reason: "materials", message: mensagemFalha("materials") };
  }

  const plan = planoRitual(recipe);
  site = {
    kind: selected.kind,
    id: selected.id,
    preview: check.preview,
    recipe,
    usedStock,
    hitsNeeded: plan.hitsNeeded,
    hitsDone: 0,
    burst: 1,
    nextBurstAt: 3,
    progress: 0,
    _acc: 0,
    proxy: {
      x: check.preview.x ?? check.preview.tx + 0.5,
      y: check.preview.y ?? check.preview.ty + 0.5,
      z: check.preview.z ?? 0,
    },
  };
  poeiraDoPreview(check.preview);
  return { ok: true, site, message: "Construção iniciada." };
}

/**
 * @returns {{ done: boolean, progress: number, committed?: object }}
 */
export function acertarRitual(n = 1) {
  if (!site) return { done: false, progress: 0, hit: false };
  site.hitsDone += Math.max(1, n | 0);
  if (site.hitsDone >= site.nextBurstAt && site.burst < 3) {
    site.burst += 1;
    site.nextBurstAt += 3 + site.burst;
  }
  site.progress = Math.min(1, site.hitsDone / site.hitsNeeded);
  if (site.hitsDone < site.hitsNeeded) {
    return { done: false, progress: site.progress, hit: true };
  }
  const committed = commitSite();
  return { done: true, progress: 1, committed, hit: true };
}

function commitSite() {
  if (!site) return null;
  const { kind, id, preview, recipe } = site;
  let result = null;
  if (kind === TIPO_CONSTRUIR.CASA) {
    const house = criarRegistroCasa({
      id: proximoIdCasa(preview.x, preview.y),
      buildingId: id,
      x: preview.x,
      y: preview.y,
      z: preview.z,
      cols: recipe.cols,
      rows: recipe.rows,
      floors: recipe.floors,
      enterable: recipe.enterable,
    });
    colocarCasa(house);
    result = { house };
  } else if (kind === TIPO_CONSTRUIR.MOVEL) {
    const furniture = colocarMovelOutdoor({
      key: id,
      x: preview.x,
      y: preview.y,
      z: preview.z,
      hp: maxHpDoRecipe(recipe),
      maxHp: maxHpDoRecipe(recipe),
    });
    result = { furniture };
  } else if (kind === TIPO_CONSTRUIR.CERCA) {
    const fence = colocarCerca({
      tx: preview.tx,
      ty: preview.ty,
      kind: preview.kind || FENCE_KIND.SEGMENT,
      hp: maxHpDoRecipe(recipe),
      maxHp: maxHpDoRecipe(recipe),
    });
    result = { fence };
  }
  site = null;
  return result;
}

export function cancelarRitual() {
  if (!site) return false;
  if (site.usedStock) {
    if (site.kind === TIPO_CONSTRUIR.CASA) adicionarStockCasa(site.id, 1);
    else if (site.kind === TIPO_CONSTRUIR.MOVEL) adicionarStockMovel(site.id, 1);
  } else {
    reembolsarCusto(site.recipe, { full: true });
  }
  site = null;
  return true;
}

/** Auto-progresso se não houver companion (fallback). */
export function tickRitual(dt, opts = {}) {
  if (!site) return null;
  if (opts.autoHit) {
    site._acc = (site._acc || 0) + dt;
    const interval = 1 / Math.max(1, site.burst);
    if (site._acc >= interval) {
      site._acc = 0;
      const r = acertarRitual(1);
      if (r.hit) poeiraDoPreview(site?.preview);
      return r;
    }
  }
  return { done: false, progress: site.progress, hit: false };
}
