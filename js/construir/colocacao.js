/**
 * Validação, preview e colocação (casas / móveis outdoor / cercas).
 */
import { alturaDoRelevo } from "../mundo/bioma/catalogo.js";
import {
  TIPO_CONSTRUIR,
  pegadaCasa,
  podePagar,
  gastarCusto,
  receitaConstruir,
} from "./catalogo.js";
import {
  claimRect,
  footprintNoClaim,
  pontoNoClaim,
  temClaim,
} from "./base.js";
import {
  blockersCasa,
  blockersInsideRect,
  blockersMovel,
  footprintEm,
  jogadorSobrepoe,
  snapOrigemCasa,
} from "./pegadas.js";
import { motivoSobreposicao, motivoTerrenoOutdoor } from "./checagensOutdoor.js";
import {
  colocarCasa,
  colocarCerca,
  colocarMovelOutdoor,
  criarRegistroCasa,
  proximoIdCasa,
} from "./estruturas.js";
import { consumirStockCasa, consumirStockMovel, contarStockCasa, contarStockMovel } from "./stock.js";
import { maxHpDoRecipe } from "./custos.js";
import { FENCE_KIND, fenceKindFromCatalogId } from "./cerca/tipos.js";
import { cercaEm } from "./estruturas.js";

const MOTIVOS = Object.freeze({
  unknown: "Receita desconhecida.",
  noBase: "Plante a bandeira da base primeiro.",
  outsideBase: "Só dentro da área da bandeira.",
  water: "Não dá pra construir na água.",
  road: "Não dá pra construir na estrada.",
  city: "Longe demais da cidade — use o campo.",
  overlap: "Espaço ocupado.",
  site: "Há um sítio/santuário aqui.",
  shrine: "Há um santuário perto.",
  fence: "Há uma cerca no caminho.",
  occupied: "Tile ocupado.",
  player: "Você está no caminho.",
  materials: "Materiais insuficientes.",
  mira: "Mira inválida.",
  stock: "Sem estoque nem materiais.",
});

export function mensagemFalha(reason) {
  return MOTIVOS[reason] || MOTIVOS.unknown;
}

/**
 * @returns {{ ok: boolean, reason?: string, preview?: object, recipe?: object }}
 */
export function validarCasa(buildingId, aimX, aimY, player) {
  const recipe = receitaConstruir(TIPO_CONSTRUIR.CASA, buildingId);
  if (!recipe) return { ok: false, reason: "unknown" };
  const placed = snapOrigemCasa(aimX, aimY, recipe.cols, recipe.rows);
  const fp = footprintEm(placed.x, placed.y, recipe.cols, recipe.rows);
  const blockers = blockersCasa(buildingId, fp);
  const preview = { ...placed, buildingId, z: alturaDoRelevo(placed.x, placed.y) };

  if (!temClaim()) return { ok: false, reason: "noBase", preview, recipe };
  if (!blockersInsideRect(blockers, claimRect()) || !footprintNoClaim(fp)) {
    return { ok: false, reason: "outsideBase", preview, recipe };
  }
  const terrain = motivoTerrenoOutdoor(blockers);
  if (terrain) return { ok: false, reason: terrain, preview, recipe };
  const over = motivoSobreposicao(blockers);
  if (over) return { ok: false, reason: over, preview, recipe };
  if (player && jogadorSobrepoe(player.x, player.y, player.r ?? 0.45, blockers)) {
    return { ok: false, reason: "player", preview, recipe };
  }
  const temStock = contarStockCasa(buildingId) > 0;
  if (!temStock && !podePagar(recipe)) {
    return { ok: false, reason: "materials", preview, recipe };
  }
  return { ok: true, preview, recipe };
}

/**
 * @returns {{ ok: boolean, reason?: string, preview?: object, recipe?: object }}
 */
export function validarMovelOutdoor(key, aimX, aimY, player) {
  const recipe = receitaConstruir(TIPO_CONSTRUIR.MOVEL, key);
  if (!recipe || recipe.outdoor === false) return { ok: false, reason: "unknown" };
  const x = Math.floor(aimX);
  const y = Math.floor(aimY);
  const blockers = blockersMovel(x, y, 1, 1);
  const preview = { x, y, key, z: alturaDoRelevo(x + 0.5, y + 0.5) };
  if (!temClaim() || !pontoNoClaim(x + 0.5, y + 0.5)) {
    return { ok: false, reason: "outsideBase", preview, recipe };
  }
  const terrain = motivoTerrenoOutdoor(blockers);
  if (terrain) return { ok: false, reason: terrain, preview, recipe };
  const over = motivoSobreposicao(blockers);
  if (over) return { ok: false, reason: over, preview, recipe };
  if (player && jogadorSobrepoe(player.x, player.y, player.r ?? 0.45, blockers)) {
    return { ok: false, reason: "player", preview, recipe };
  }
  const temStock = contarStockMovel(key) > 0;
  if (!temStock && !podePagar(recipe)) {
    return { ok: false, reason: "materials", preview, recipe };
  }
  return { ok: true, preview, recipe };
}

/**
 * @returns {{ ok: boolean, reason?: string, preview?: object, recipe?: object }}
 */
export function validarCerca(catalogId, aimX, aimY) {
  const recipe = receitaConstruir(TIPO_CONSTRUIR.CERCA, catalogId);
  if (!recipe) return { ok: false, reason: "unknown" };
  const tx = Math.floor(aimX);
  const ty = Math.floor(aimY);
  const preview = { tx, ty, catalogId, kind: fenceKindFromCatalogId(catalogId) };
  if (!temClaim() || !pontoNoClaim(tx + 0.5, ty + 0.5)) {
    return { ok: false, reason: "outsideBase", preview, recipe };
  }
  if (cercaEm(tx, ty)) return { ok: false, reason: "fence", preview, recipe };
  const blockers = blockersMovel(tx, ty, 1, 1);
  const terrain = motivoTerrenoOutdoor(blockers);
  if (terrain) return { ok: false, reason: terrain, preview, recipe };
  if (!podePagar(recipe)) return { ok: false, reason: "materials", preview, recipe };
  return { ok: true, preview, recipe };
}

/**
 * Preview genérico do item selecionado no buildMode.
 */
export function obterPreview(selected, aimX, aimY, player) {
  if (!selected?.kind || !selected?.id) return null;
  if (selected.kind === TIPO_CONSTRUIR.CASA) {
    return validarCasa(selected.id, aimX, aimY, player);
  }
  if (selected.kind === TIPO_CONSTRUIR.MOVEL) {
    return validarMovelOutdoor(selected.id, aimX, aimY, player);
  }
  if (selected.kind === TIPO_CONSTRUIR.CERCA) {
    return validarCerca(selected.id, aimX, aimY);
  }
  return null;
}

/**
 * Paga e cria registro (sem ritual). Preferir ritualConstrucao.
 */
export function colocarSelecionado(selected, aimX, aimY, player) {
  const preview = obterPreview(selected, aimX, aimY, player);
  if (!preview?.ok) return { ok: false, reason: preview?.reason || "unknown", preview };
  const { recipe } = preview;

  if (selected.kind === TIPO_CONSTRUIR.CASA) {
    const usedStock = consumirStockCasa(selected.id, 1);
    if (!usedStock && !gastarCusto(recipe)) {
      return { ok: false, reason: "materials", preview };
    }
    const p = preview.preview;
    const house = criarRegistroCasa({
      id: proximoIdCasa(p.x, p.y),
      buildingId: selected.id,
      x: p.x,
      y: p.y,
      z: p.z,
      cols: recipe.cols,
      rows: recipe.rows,
      floors: recipe.floors,
      enterable: recipe.enterable,
    });
    colocarCasa(house);
    return { ok: true, house, preview };
  }

  if (selected.kind === TIPO_CONSTRUIR.MOVEL) {
    const usedStock = consumirStockMovel(selected.id, 1);
    if (!usedStock && !gastarCusto(recipe)) {
      return { ok: false, reason: "materials", preview };
    }
    const p = preview.preview;
    const item = colocarMovelOutdoor({
      key: selected.id,
      x: p.x,
      y: p.y,
      z: p.z,
      hp: maxHpDoRecipe(recipe),
      maxHp: maxHpDoRecipe(recipe),
    });
    return { ok: true, furniture: item, preview };
  }

  if (selected.kind === TIPO_CONSTRUIR.CERCA) {
    if (!gastarCusto(recipe)) return { ok: false, reason: "materials", preview };
    const p = preview.preview;
    const cell = colocarCerca({
      tx: p.tx,
      ty: p.ty,
      kind: p.kind || FENCE_KIND.SEGMENT,
      hp: maxHpDoRecipe(recipe),
      maxHp: maxHpDoRecipe(recipe),
    });
    return { ok: true, fence: cell, preview };
  }

  return { ok: false, reason: "unknown" };
}

export { pegadaCasa };
