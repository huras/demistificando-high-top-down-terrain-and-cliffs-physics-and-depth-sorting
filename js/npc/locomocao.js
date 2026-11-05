/**
 * Locomoção 3D de NPCs: LOD path perto do player; steering + desviarDisco longe.
 *
 * Perto (≤ NAV_RAIO): `atualizarAgente` (mesmo pipeline do mon).
 * Longe: direção + sensoria local + desviarDisco (O(1)).
 */
import {
  ALTURA_SPRITE_JOGADOR,
  NAV_RAIO,
  RAIO_CORPO,
  STAMINA_MAX,
  VELOCIDADE_MAX,
} from "../config.js";
import { atualizarAgente, garantirCorpoLocomocao } from "../fisica/agente.js";
import { alturaSobPes } from "../fisica/colisao.js";
import { soltarEscalada } from "../fisica/escalada.js";
import { atualizarMovimentoDirecionado } from "../fisica/movimento.js";
import { desviarDisco } from "../navegacao/desviarDisco.js";
import { projetarMetaLivre } from "../navegacao/metaLivre.js";
import { PERFIL_ESCALADOR } from "../navegacao/perfilMovimento.js";
import { tickStuck } from "../navegacao/recoveryStuck.js";
import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";

/** Distância XY pra considerar meta alcançada (wander/travel). */
export const NPC_DIST_CHEGAR = 0.85;

/** Depois de ver queda, bloqueia auto-climb (evita grudar na face da beirada). */
const BLOQUEIO_CLIMB_POS_QUEDA = 0.9;

const NAV_RAIO_SQ = NAV_RAIO * NAV_RAIO;

/** Âncora do player pra LOD (setada no tickNpc). */
let ancoraLodX = 0;
let ancoraLodY = 0;
let ancoraLodOk = false;

/** @param {number} x @param {number} y */
export function definirAncoraLodNpc(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    ancoraLodOk = false;
    return;
  }
  ancoraLodX = x;
  ancoraLodY = y;
  ancoraLodOk = true;
}

function pertoDoPlayerLod(npc) {
  if (!ancoraLodOk || !npc) return false;
  const dx = npc.x - ancoraLodX;
  const dy = npc.y - ancoraLodY;
  return dx * dx + dy * dy <= NAV_RAIO_SQ;
}

function onStuckNpc(npc) {
  if (!npc) return;
  npc.wanderGoal = null;
  npc.travelTarget = null;
  npc._seq = (npc._seq | 0) + 1;
}

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
  if (npc.raioCorpo == null) {
    npc.raioCorpo = npc.raio > 0 ? npc.raio : RAIO_CORPO;
  }
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
 * Sensor local na direção do movimento.
 * @returns {"pulo"|"escalar"|"queda"|null}
 */
function sensoriarFrente(npc, nx, ny) {
  if (!npc?.noChao || npc.nadando || npc.escalando || npc.mantle || npc.pulando) {
    return null;
  }
  const base = Math.round(npc.z ?? npc.elevacao ?? 0);
  let viuQueda = false;
  let viuPulo = false;
  let viuEscalar = false;

  for (const dist of [0.55, 0.95, 1.35]) {
    const ax = npc.x + nx * dist;
    const ay = npc.y + ny * dist;

    const zBaixo = alturaSobPes(ax, ay, base + 0.35);
    if (!(zBaixo > 0) || zBaixo <= base - 2) {
      viuQueda = true;
      continue;
    }

    const zAlto = alturaSobPes(ax, ay, base + 2.8);
    if (!(zAlto > 0)) continue;
    const dz = Math.round(zAlto) - base;
    if (dz === 1) viuPulo = true;
    else if (dz >= 2) viuEscalar = true;
  }

  if (viuEscalar && npc.perfil?.podeEscalar) return "escalar";
  if (viuPulo && npc.perfil?.podePular) return "pulo";
  if (viuQueda) return "queda";
  return null;
}

function marcarBloqueioClimb(npc, dtOuSeg) {
  npc._npcBloqueioClimbT = Math.max(npc._npcBloqueioClimbT || 0, dtOuSeg);
}

function tickBloqueioClimb(npc, dt) {
  if ((npc._npcBloqueioClimbT || 0) <= 0) return;
  npc._npcBloqueioClimbT = Math.max(0, npc._npcBloqueioClimbT - dt);
}

function climbBloqueado(npc) {
  return (npc._npcBloqueioClimbT || 0) > 0;
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
  tickBloqueioClimb(npc, dt > 0 ? dt : 0);
  if (
    npc.nadando ||
    npc.escalando ||
    npc.mantle ||
    npc.pulando ||
    npc.noChao === false
  ) {
    reabastecerStaminaNpc(npc);
    if (npc.escalando && climbBloqueado(npc)) {
      soltarEscalada(npc, { impulso: false, motivo: "queda-npc" });
    }
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

function emTransicaoNpc(npc) {
  return (
    !!npc.nadando ||
    !!npc.escalando ||
    !!npc.mantle ||
    !!npc.pulando ||
    npc.noChao === false
  );
}

/**
 * Steer + desviarDisco (longe do player).
 */
function irParaSteer(npc, mx, my, dt, vel) {
  const dx = mx - npc.x;
  const dy = my - npc.y;
  const dist = Math.hypot(dx, dy);
  const inv = dist > 1e-4 ? 1 / dist : 0;
  let nx = dx * inv;
  let ny = dy * inv;

  const desvio = desviarDisco(npc, nx, ny);
  nx = desvio.x;
  ny = desvio.y;

  if (nx !== 0 || ny !== 0) {
    npc.dirX = nx;
    npc.dirY = ny;
  }

  reabastecerStaminaNpc(npc);
  npc.forcaVelMul = Math.max(0.15, Math.min(1.35, vel / VELOCIDADE_MAX));

  const senso = sensoriarFrente(npc, nx, ny);

  if (senso === "queda") {
    marcarBloqueioClimb(npc, BLOQUEIO_CLIMB_POS_QUEDA);
    npc._npcClimbIntent = false;
  } else if (senso === "escalar") {
    npc._npcClimbIntent = true;
  } else if (!npc.escalando && !npc.mantle && npc.noChao) {
    npc._npcClimbIntent = false;
  }

  if (npc.escalando && (climbBloqueado(npc) || !npc._npcClimbIntent)) {
    soltarEscalada(npc, { impulso: false, motivo: "queda-npc" });
    marcarBloqueioClimb(npc, BLOQUEIO_CLIMB_POS_QUEDA);
    npc._npcClimbIntent = false;
  }

  const querPulo =
    !!npc.perfil?.podePular &&
    npc.noChao &&
    !npc.nadando &&
    !npc.escalando &&
    !npc.mantle &&
    senso === "pulo";

  const querEscalar =
    !!npc.perfil?.podeEscalar &&
    !climbBloqueado(npc) &&
    (senso === "escalar" || (!!npc._npcClimbIntent && !!npc.escalando));

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
    autoEscalar: querEscalar,
    podeSoltarEscala: false,
  });

  syncFacingPeople(npc);
}

/**
 * Persegue meta XY com física real (nado / pulo / climb) + LOD path.
 * @returns {boolean} true se chegou na meta
 */
export function irParaNpc(npc, gx, gy, dt, vel = 0) {
  if (!npc) return true;
  garantirNpcLoco(npc);
  tickBloqueioClimb(npc, dt > 0 ? dt : 0);

  const elev = npc.elevacao ?? npc.z ?? 0;
  const r = npc.raioCorpo > 0 ? npc.raioCorpo : RAIO_CORPO;
  const meta = projetarMetaLivre(gx, gy, elev, r);
  const mx = meta.x;
  const my = meta.y;

  const dist = Math.hypot(mx - npc.x, my - npc.y);
  const transicao = emTransicaoNpc(npc);

  if (!(vel > 0) || !(dt > 0)) {
    manterFisicaNpc(npc, dt);
    pararIntent(npc);
    return dist < NPC_DIST_CHEGAR;
  }

  if (dist < NPC_DIST_CHEGAR && !transicao) {
    pararIntent(npc);
    manterFisicaNpc(npc, dt);
    return true;
  }

  if (pertoDoPlayerLod(npc)) {
    // Path real; stuck fica a cargo de seguirCaminho/recoveryStuck.
    atualizarAgente(
      npc,
      { x: mx, y: my, z: elev, elevacao: elev },
      dt,
      vel,
      0,
    );
    syncFacingPeople(npc);
  } else {
    irParaSteer(npc, mx, my, dt, vel);
    tickStuck(npc, dt, {
      usarNav: false,
      ativo: !emTransicaoNpc(npc) && dist >= NPC_DIST_CHEGAR,
      onStuck: onStuckNpc,
    });
  }

  const rest = Math.hypot(mx - npc.x, my - npc.y);
  if (rest < NPC_DIST_CHEGAR && !emTransicaoNpc(npc)) {
    pararIntent(npc);
    snapChaoNpc(npc);
    return true;
  }
  return false;
}
