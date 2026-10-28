/**
 * Locomoção 3D de NPCs: steering + colisão no chão.
 * Path/agente completo (atualizarAgente) custava ~8 ms/NPC no overworld.
 */
import { alturaSobPes, moverComColisao } from "../fisica/colisao.js";
import { garantirCorpoLocomocao } from "../fisica/agente.js";
import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";
import { PERFIL_ESCALADOR } from "../navegacao/perfilMovimento.js";

/** Distância XY pra considerar meta alcançada (wander/travel). */
export const NPC_DIST_CHEGAR = 0.85;

/**
 * @param {object} npc
 */
export function garantirNpcLoco(npc) {
  if (!npc) return;
  if (npc.perfil !== PERFIL_ESCALADOR) npc.perfil = PERFIL_ESCALADOR;
  garantirCorpoLocomocao(npc, PERFIL_ESCALADOR);
  if (npc.elevacao == null && Number.isFinite(npc.z)) npc.elevacao = npc.z;
  if (!npc.facing || typeof npc.facing !== "object") {
    npc.facing = { x: 0, y: 1 };
  }
}

/**
 * Restaura facing {x,y} depois que o agente sobrescreve com índice cardinal.
 * @param {object} npc
 */
function syncFacingPeople(npc) {
  if (!npc.facing || typeof npc.facing !== "object") {
    npc.facing = { x: 0, y: 1 };
  }
  const dx = npc.dirX ?? 0;
  const dy = npc.dirY ?? 0;
  if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) return;
  if (Math.abs(dx) >= Math.abs(dy)) {
    npc.facing.x = Math.sign(dx) || 0;
    npc.facing.y = 0;
  } else {
    npc.facing.x = 0;
    npc.facing.y = Math.sign(dy) || 0;
  }
}

/**
 * Snap de pé no voxel (lote / idle / hop dormente).
 * Não mexe se estiver no ar, escalando ou mantle.
 * @param {object} npc
 */
export function snapChaoNpc(npc) {
  if (!npc) return;
  if (npc.pulando || npc.escalando || npc.mantle || npc.nadando) return;
  if (npc.noChao === false && (npc.vz ?? 0) !== 0) return;
  const ref = npc.elevacao ?? npc.z ?? ALTURA_PRACA;
  const z = alturaSobPes(npc.x, npc.y, ref);
  if (!(z > 0)) return;
  npc.z = z;
  npc.elevacao = z;
  npc.hopLift = 0;
  npc.noChao = true;
}

/**
 * Altura inicial outdoor (spawn).
 * @param {number} x
 * @param {number} y
 * @param {number} [ref]
 */
export function alturaSpawnNpc(x, y, ref = ALTURA_PRACA) {
  const z = alturaSobPes(x, y, ref);
  return z > 0 ? z : ref;
}

/**
 * Persegue meta XY no chão (sem path 3D).
 * @returns {boolean} true se chegou na meta
 */
export function irParaNpc(npc, gx, gy, dt, vel = 0) {
  if (!npc) return true;
  garantirNpcLoco(npc);
  const dx = gx - npc.x;
  const dy = gy - npc.y;
  const dist = Math.hypot(dx, dy);
  if (dist < NPC_DIST_CHEGAR || !(vel > 0) || !(dt > 0)) {
    npc.vx = 0;
    npc.vy = 0;
    npc.andando = false;
    snapChaoNpc(npc);
    return dist < NPC_DIST_CHEGAR;
  }
  const passo = Math.min(vel * dt, dist);
  const ix = (dx / dist) * passo;
  const iy = (dy / dist) * passo;
  const mov = moverComColisao(npc, ix, iy);
  npc.x = mov.x;
  npc.y = mov.y;
  npc.vx = ix / dt;
  npc.vy = iy / dt;
  npc.andando = true;
  npc.dirX = dx / dist;
  npc.dirY = dy / dist;
  snapChaoNpc(npc);
  syncFacingPeople(npc);
  const rest = Math.hypot(gx - npc.x, gy - npc.y);
  if (rest < NPC_DIST_CHEGAR) {
    npc.vx = 0;
    npc.vy = 0;
    npc.andando = false;
    return true;
  }
  return false;
}
