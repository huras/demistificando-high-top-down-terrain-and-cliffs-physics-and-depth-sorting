/**
 * Vault/hop sobre cercas (segmentos) — portões são passáveis.
 */
import { cercaEm } from "../estruturas.js";
import { FENCE_KIND } from "./tipos.js";

/**
 * @param {number} x
 * @param {number} y
 * @returns {boolean} true se há cerca sólida (não portão)
 */
export function cercaSolidaEm(x, y) {
  const c = cercaEm(Math.floor(x), Math.floor(y));
  return !!(c && c.kind !== FENCE_KIND.GATE);
}

/**
 * Se o movimento atravessa cerca, sugere vault (pulo curto).
 * @param {object} corpo
 * @param {number} nx
 * @param {number} ny
 * @returns {{ vault: boolean, tx?: number, ty?: number }}
 */
export function avaliarVault(corpo, nx, ny) {
  if (!corpo) return { vault: false };
  const fromSolid = cercaSolidaEm(corpo.x, corpo.y);
  const toSolid = cercaSolidaEm(nx, ny);
  if (!fromSolid && toSolid) {
    // atravessar para o outro lado
    const dx = nx - corpo.x;
    const dy = ny - corpo.y;
    const len = Math.hypot(dx, dy) || 1;
    const beyondX = nx + (dx / len) * 0.7;
    const beyondY = ny + (dy / len) * 0.7;
    if (!cercaSolidaEm(beyondX, beyondY)) {
      return {
        vault: true,
        tx: Math.floor(nx),
        ty: Math.floor(ny),
        landX: beyondX,
        landY: beyondY,
      };
    }
  }
  return { vault: false };
}
