/**
 * Locomoção 3D de NPCs: steering local + física compartilhada do jogador.
 *
 * Path/agente completo (`atualizarAgente`) custava ~8 ms/NPC — aqui só
 * direção + sensoria local (nado / pulo +1 / climb). Mesmo pipeline de
 * `atualizarMovimentoDirecionado` (água, hop, escalada, mantle).
 */
import { ALTURA_SPRITE_JOGADOR, STAMINA_MAX, VELOCIDADE_MAX } from "../config.js";
import { garantirCorpoLocomocao } from "../fisica/agente.js";
import { alturaSobPes } from "../fisica/colisao.js";
import { atualizarMovimentoDirecionado } from "../fisica/movimento.js";
import { PERFIL_ESCALADOR } from "../navegacao/perfilMovimento.js";
import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";

/** Distância XY pra considerar meta alcançada (wander/travel). */
export const NPC_DIST_CHEGAR = 0.85;

/** Tempo sem progresso XY antes de forçar pulo/climb. */
const STUCK_SEC = 0.4;

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
  if (npc.alturaCorpo == null) npc.alturaCorpo = ALTURA_SPRITE_JOGADOR;
  if (npc.acao == null || typeof npc.acao !== "string") npc.acao = "parado";
  if (npc.staminaMax == null) npc.staminaMax = STAMINA_MAX;
  if (npc.stamina == null) npc.stamina = npc.staminaMax;
}

/** Treinadores OW não afogam / não caem da parede no meio da rota. */
function reabastecerStaminaNpc(npc) {
  const max = npc.staminaMax ?? STAMINA_MAX;
  npc.stamina = max;
  npc.afogandoT = 0;
}

/**
 * Restaura facing {x,y} depois que a física sobrescreve com índice cardinal.
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
 * Olha pra frente: +1 = hop Mario; ≥2 = climb BOTW.
 * @returns {"pulo"|"escalar"|null}
 */
function sensoriarObstaculoVertical(npc, nx, ny) {
  if (!npc?.noChao || npc.nadando || npc.escalando || npc.mantle || npc.pulando) {
    return null;
  }
  if (!npc.perfil?.podePular && !npc.perfil?.podeEscalar) return null;
  const base = Math.round(npc.z ?? npc.elevacao ?? 0);
  let melhor = null;
  for (const dist of [0.45, 0.8, 1.15]) {
    const zFrente = alturaSobPes(
      npc.x + nx * dist,
      npc.y + ny * dist,
      base + 2.8,
    );
    if (!(zFrente > 0)) continue;
    const dz = Math.round(zFrente) - base;
    if (dz === 1 && npc.perfil?.podePular) {
      melhor = "pulo";
      break;
    }
    if (dz >= 2 && npc.perfil?.podeEscalar) {
      melhor = "escalar";
      break;
    }
  }
  return melhor;
}

function registrarProgresso(npc, distMeta, dt) {
  const prev = npc._npcGoalD;
  if (prev == null || distMeta < prev - 0.06) {
    npc._npcGoalD = distMeta;
    npc._npcStuckT = 0;
    return 0;
  }
  npc._npcStuckT = (npc._npcStuckT || 0) + dt;
  return npc._npcStuckT;
}

function limparProgresso(npc) {
  npc._npcGoalD = null;
  npc._npcStuckT = 0;
}

function pararIntent(npc) {
  npc.vx = 0;
  npc.vy = 0;
  npc.andando = false;
  npc.correndo = false;
  npc.forcaVelMul = undefined;
  npc.segurarPulo = false;
}

/**
 * Snap de pé no voxel (lote / idle / hop dormente).
 * Não mexe se estiver no ar, escalando, mantle ou nadando.
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
 * Idle / chegada: mantém nado/climb/ar vivos; no chão só snapa o pé.
 * @param {object} npc
 * @param {number} dt
 */
export function manterFisicaNpc(npc, dt) {
  if (!npc) return;
  garantirNpcLoco(npc);
  if (
    npc.nadando ||
    npc.escalando ||
    npc.mantle ||
    npc.pulando ||
    npc.noChao === false
  ) {
    reabastecerStaminaNpc(npc);
    atualizarMovimentoDirecionado(npc, 0, 0, dt > 0 ? dt : 0, {
      autoEscalar: false,
      podeSoltarEscala: false,
      apertouPulo: false,
      querEscalar: false,
    });
    syncFacingPeople(npc);
    return;
  }
  snapChaoNpc(npc);
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
 * Persegue meta XY com física real (nado / pulo / climb).
 * @returns {boolean} true se chegou na meta
 */
export function irParaNpc(npc, gx, gy, dt, vel = 0) {
  if (!npc) return true;
  garantirNpcLoco(npc);

  const dx = gx - npc.x;
  const dy = gy - npc.y;
  const dist = Math.hypot(dx, dy);
  const emTransicao =
    !!npc.nadando ||
    !!npc.escalando ||
    !!npc.mantle ||
    !!npc.pulando ||
    npc.noChao === false;

  if (!(vel > 0) || !(dt > 0)) {
    manterFisicaNpc(npc, dt);
    pararIntent(npc);
    return dist < NPC_DIST_CHEGAR;
  }

  if (dist < NPC_DIST_CHEGAR && !emTransicao) {
    limparProgresso(npc);
    pararIntent(npc);
    manterFisicaNpc(npc, dt);
    return true;
  }

  const inv = dist > 1e-4 ? 1 / dist : 0;
  const nx = dx * inv;
  const ny = dy * inv;
  if (nx !== 0 || ny !== 0) {
    npc.dirX = nx;
    npc.dirY = ny;
  }

  reabastecerStaminaNpc(npc);
  npc.forcaVelMul = Math.max(0.15, Math.min(1.35, vel / VELOCIDADE_MAX));

  const senso = sensoriarObstaculoVertical(npc, nx, ny);
  const stuckT = registrarProgresso(npc, dist, dt);
  const forcarClimb = stuckT >= STUCK_SEC;
  const forcarPulo = stuckT >= STUCK_SEC * 2.5;
  const querPulo =
    !!npc.perfil?.podePular &&
    !emTransicao &&
    (senso === "pulo" || (forcarPulo && senso !== "escalar"));
  const querEscalar =
    !!npc.perfil?.podeEscalar &&
    (senso === "escalar" || forcarClimb || !!npc.escalando);

  if (querPulo) {
    npc.segurarPulo = true;
    npc.puloCortado = false;
  } else if (npc.noChao) {
    npc.segurarPulo = false;
  }

  atualizarMovimentoDirecionado(npc, nx, ny, dt, {
    correndo: false,
    apertouPulo: querPulo,
    querEscalar,
    autoEscalar: !!npc.perfil?.podeEscalar,
    podeSoltarEscala: false,
  });

  syncFacingPeople(npc);

  const rest = Math.hypot(gx - npc.x, gy - npc.y);
  const aindaNoAr =
    !!npc.nadando ||
    !!npc.escalando ||
    !!npc.mantle ||
    !!npc.pulando ||
    npc.noChao === false;
  if (rest < NPC_DIST_CHEGAR && !aindaNoAr) {
    limparProgresso(npc);
    pararIntent(npc);
    snapChaoNpc(npc);
    return true;
  }
  return false;
}
