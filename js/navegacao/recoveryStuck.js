/**
 * Recovery unificado pra mon (seguirCaminho) e NPC (irParaNpc).
 * Progresso XY baixo → empurra fora do disco, limpa path, callback.
 */
import { PATH_STUCK_SEG } from "../config.js";
import { resolverForaDeObstaculo } from "../fisica/obstaculos.js";
import { cancelarPath, limparCachePath } from "./filaPath.js";

const BLOQUEIO_WP_MS = 2800;

function marcarWpBloqueado(nav, cx, cy) {
  if (!nav) return;
  if (!nav.wpBloqueados) nav.wpBloqueados = new Map();
  nav.wpBloqueados.set(`${cx | 0},${cy | 0}`, performance.now() + BLOQUEIO_WP_MS);
}

/**
 * Aplica escape compartilhado (fora do disco + limpa path/cache).
 * @param {object} ent
 * @param {{ onStuck?: (ent: object) => void }} [opts]
 */
export function executarRecoveryStuck(ent, opts = {}) {
  if (!ent) return;
  const nav = ent.nav;
  if (nav) {
    const wp = nav.path?.cells?.[nav.idx];
    if (wp) marcarWpBloqueado(nav, wp.cx, wp.cy);
    nav.path = null;
    nav.stuckT = 0;
  }
  resolverForaDeObstaculo(ent);
  limparCachePath();
  if (ent.id != null) cancelarPath(ent.id);
  opts.onStuck?.(ent);
}

/**
 * Acumula stuck por progresso XY; dispara recovery ao limiar.
 * @param {object} ent
 * @param {number} dt
 * @param {{
 *   onStuck?: (ent: object) => void,
 *   limiar?: number,
 *   progMin?: number,
 *   ativo?: boolean,
 *   usarNav?: boolean,
 * }} [opts]
 * @returns {boolean} true se disparou recovery
 */
export function tickStuck(ent, dt, opts = {}) {
  if (!ent || !(dt > 0)) return false;
  const limiar = opts.limiar ?? PATH_STUCK_SEG;
  const progMin = opts.progMin ?? 0.03;
  const ativo = opts.ativo !== false;

  const nav = opts.usarNav === false ? null : ent.nav;
  if (nav) {
    if (nav.lastX == null || nav.lastY == null) {
      nav.lastX = ent.x;
      nav.lastY = ent.y;
    }
    const prog = Math.hypot(ent.x - nav.lastX, ent.y - nav.lastY);
    nav.lastX = ent.x;
    nav.lastY = ent.y;
    if (!ativo) {
      nav.stuckT = 0;
      return false;
    }
    if (prog < progMin) nav.stuckT = (nav.stuckT || 0) + dt;
    else nav.stuckT = 0;
    if ((nav.stuckT || 0) < limiar) return false;
    executarRecoveryStuck(ent, opts);
    return true;
  }

  if (ent._stuckLastX == null) {
    ent._stuckLastX = ent.x;
    ent._stuckLastY = ent.y;
    ent._stuckT = 0;
    return false;
  }
  const prog = Math.hypot(ent.x - ent._stuckLastX, ent.y - ent._stuckLastY);
  ent._stuckLastX = ent.x;
  ent._stuckLastY = ent.y;
  if (!ativo) {
    ent._stuckT = 0;
    return false;
  }
  if (prog < progMin) ent._stuckT = (ent._stuckT || 0) + dt;
  else ent._stuckT = 0;
  if ((ent._stuckT || 0) < limiar) return false;
  executarRecoveryStuck(ent, opts);
  return true;
}
