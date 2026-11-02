/**
 * Demolição por HP (casas / móveis outdoor / cercas).
 */
import { receitaConstruir, TIPO_CONSTRUIR } from "./catalogo.js";
import { maxHpDoRecipe, reembolsarCusto } from "./custos.js";
import {
  acharCasa,
  demolirCasa,
  demolirMovelOutdoor,
  listarCasas,
  listarMoveisOutdoor,
  removerCerca,
  cercaEm,
} from "./estruturas.js";
import { FENCE_KIND, receitaCercaPorKind } from "./cerca/tipos.js";
import { invalidarMapasCerca } from "./cerca/autotile.js";
import { pontoNoClaim } from "./base.js";

/**
 * @param {number} x
 * @param {number} y
 * @param {number} [reach]
 */
export function alvoDemolirPerto(x, y, reach = 2.2) {
  const r2 = reach * reach;
  let best = null;
  let bestD = r2;

  for (const h of listarCasas()) {
    const dx = h.x - x;
    const dy = h.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = { tipo: "house", id: h.id, x: h.x, y: h.y, hp: h.hp, maxHp: h.maxHp };
    }
  }
  for (const f of listarMoveisOutdoor()) {
    const cx = f.x + 0.5;
    const cy = f.y + 0.5;
    const dx = cx - x;
    const dy = cy - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = { tipo: "furniture", id: f.id, x: cx, y: cy, hp: f.hp, maxHp: f.maxHp };
    }
  }
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const c = cercaEm(tx + ox, ty + oy);
      if (!c) continue;
      const cx = c.tx + 0.5;
      const cy = c.ty + 0.5;
      const dx = cx - x;
      const dy = cy - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = { tipo: "fence", tx: c.tx, ty: c.ty, x: cx, y: cy, hp: c.hp, maxHp: c.maxHp };
      }
    }
  }
  return best;
}

/**
 * @returns {{ ok: boolean, destroyed?: boolean, message?: string, hp?: number, maxHp?: number }}
 */
export function acertarDemolicao(alvo, dano = 8) {
  if (!alvo) return { ok: false, message: "Nada para demolir." };
  if (alvo.tipo === "house") {
    const house = acharCasa(alvo.id);
    if (!house) return { ok: false };
    if (!Number.isFinite(house.maxHp)) {
      const r = receitaConstruir(TIPO_CONSTRUIR.CASA, house.buildingId);
      house.maxHp = maxHpDoRecipe(r);
      house.hp = house.maxHp;
    }
    house.hp = Math.max(0, (house.hp | 0) - (dano | 0));
    if (house.hp > 0) return { ok: true, destroyed: false, hp: house.hp, maxHp: house.maxHp };
    demolirCasa(house.id);
    return { ok: true, destroyed: true, message: "Casa demolida." };
  }
  if (alvo.tipo === "furniture") {
    const items = listarMoveisOutdoor();
    const item = items.find((f) => f.id === alvo.id);
    if (!item) return { ok: false };
    if (!Number.isFinite(item.maxHp)) {
      const r = receitaConstruir(TIPO_CONSTRUIR.MOVEL, item.key);
      item.maxHp = maxHpDoRecipe(r);
      item.hp = item.maxHp;
    }
    item.hp = Math.max(0, (item.hp | 0) - (dano | 0));
    if (item.hp > 0) return { ok: true, destroyed: false, hp: item.hp, maxHp: item.maxHp };
    demolirMovelOutdoor(item.id);
    return { ok: true, destroyed: true, message: "Móvel removido." };
  }
  if (alvo.tipo === "fence") {
    const c = cercaEm(alvo.tx, alvo.ty);
    if (!c) return { ok: false };
    if (!pontoNoClaim(c.tx + 0.5, c.ty + 0.5)) {
      return { ok: false, message: "Só na sua base." };
    }
    if (!Number.isFinite(c.maxHp)) {
      c.maxHp = maxHpDoRecipe({ costs: receitaCercaPorKind(c.kind) });
      c.hp = c.maxHp;
    }
    c.hp = Math.max(0, (c.hp | 0) - (dano | 0));
    if (c.hp > 0) return { ok: true, destroyed: false, hp: c.hp, maxHp: c.maxHp };
    removerCerca(c.tx, c.ty);
    invalidarMapasCerca();
    reembolsarCusto({ costs: receitaCercaPorKind(c.kind || FENCE_KIND.SEGMENT) });
    return { ok: true, destroyed: true, message: "Cerca removida." };
  }
  return { ok: false };
}
