/**
 * Sistema Força (BOTW): carregar / soltar / arremessar pedras e corpos.
 */
import { FORCA_HUMANO } from "./forcaEspecie.js";
import { acharAlvoForca, ehPokemonLevantavel, pesoDoPokemon } from "./alvos.js";
import { ehFalhaGrab } from "./falhaLevantar.js";
import {
  ehAgroForca,
  marcarStruggle,
  soltarVivoDoLift,
} from "./agarrarVivo.js";
import {
  finalizarGrab,
  infoMobilidade,
  iniciarGrabNoAlvo,
  mulVelocidadeCarry,
  resolverTierCarrier,
  restaurarPokemon,
  restaurarProp,
  tentarSoltarAFrente,
  tentarSoltarEm,
} from "./carregar.js";
import {
  atualizarArremessos,
  criarArremesso,
  limparArremessos,
  resolverMiraArremesso,
  FORCA_CARGA_MS,
} from "./arremessar.js";
import { aplicarDanoLivre } from "../pokemon/combate/executor.js";

/** @type {{
 *   humanoTier: number,
 *   poderArremesso: number,
 *   cargaArremessoMs: number,
 * }} */
let cfg = {
  humanoTier: FORCA_HUMANO,
  poderArremesso: 35,
  cargaArremessoMs: FORCA_CARGA_MS,
};

/** @type {object | null} */
let carry = null;
/** @type {object | null} */
let carryOwner = null;
/** @type {object | null} */
let grabAction = null;
/** @type {object | null} */
let grabActor = null;
/** @type {object[]} */
const thrown = [];
let throwAiming = false;
let throwCharge = 0;
/** @type {object | null} */
let orderCarrier = null;
/** @type {object | null} */
let stickyTarget = null;
/** @type {{ carrier: object, weightTier: number, strengthTier: number } | null} */
let failedLiftEvent = null;
/** @type {{ carrier: object, enemy: object } | null} */
let struggleBreakEvent = null;

export function configurarForca(parcial) {
  if (!parcial) return;
  if (parcial.humanoTier != null) cfg.humanoTier = parcial.humanoTier | 0 || FORCA_HUMANO;
  if (parcial.poderArremesso != null) cfg.poderArremesso = Number(parcial.poderArremesso) || 35;
  if (parcial.cargaArremessoMs != null) {
    cfg.cargaArremessoMs = Number(parcial.cargaArremessoMs) || FORCA_CARGA_MS;
  }
}

export function obterCfgForca() {
  return cfg;
}

export function estadoForca() {
  return {
    carry,
    carryOwner,
    grabAction,
    grabActor,
    thrown,
    throwAiming,
    throwCharge,
    orderCarrier,
  };
}

export function estaCarregandoForca() {
  return !!carry;
}

export function estaNoCanalForca() {
  return !!grabAction;
}

export function obterCarry() {
  return carry;
}

export function obterCarryOwner() {
  return carryOwner;
}

export function obterOrderCarrier() {
  return orderCarrier;
}

export function obterGrabAction() {
  return grabAction;
}

export function obterGrabActor() {
  return grabActor;
}

export function obterThrown() {
  return thrown;
}

export function cargaArremesso() {
  return throwCharge;
}

export function mirandoArremesso() {
  return throwAiming;
}

function liberarGrabActor() {
  soltarVivoDoLift(grabAction?.enemy);
  if (grabActor) grabActor._forcaCanalLock = false;
  grabAction = null;
  grabActor = null;
}

export function limparOrderCarrier() {
  if (orderCarrier) {
    orderCarrier.forcaVelMul = 1;
    orderCarrier._forcaCanalLock = false;
    orderCarrier.ordemForca = null;
  }
  orderCarrier = null;
}

export function definirOrderCarrier(follower) {
  if (orderCarrier && orderCarrier !== follower) limparOrderCarrier();
  orderCarrier = follower ?? null;
}

export function carrierAtivo(gameCarrier = null) {
  return orderCarrier ?? gameCarrier ?? null;
}

function ehDono(carrier) {
  return !!(carrier && carry && carrier === carryOwner);
}

export function mobilidadeDe(carrier) {
  if (!ehDono(carrier)) return null;
  return infoMobilidade(carry, resolverTierCarrier(carrier, cfg));
}

export function mulVelDe(carrier) {
  if (!ehDono(carrier)) return 1;
  return mulVelocidadeCarry(carry, resolverTierCarrier(carrier, cfg));
}

function resolverAlvo(carrier) {
  const target = acharAlvoForca(carrier, carrier, { sticky: stickyTarget });
  stickyTarget = target;
  return target;
}

export function infoPromptForca(carrier) {
  if (!carrier) return null;
  if (carry) {
    if (!ehDono(carrier)) return null;
    return {
      kind: "place",
      rotulo: "Soltar",
      tecla: "R",
      mobility: mobilidadeDe(carrier),
    };
  }
  if (grabAction) {
    if (grabActor && carrier !== grabActor) return null;
    return {
      kind: "grabbing",
      progress: Math.min(
        1,
        grabAction.elapsedSec / Math.max(0.01, grabAction.durationSec),
      ),
      tecla: "R",
    };
  }
  if (orderCarrier && carrier === orderCarrier) return null;
  const target = resolverAlvo(carrier);
  if (!target) return null;
  return { kind: "grab", rotulo: "Pegar", tecla: "R", target };
}

/**
 * Rising edge de R.
 * @param {object} carrier
 */
export function tentarInteragir(carrier) {
  if (!carrier) return false;
  if (carrier.voando || carrier.escalando || carrier.planando) return false;
  const nowSec = performance.now() * 0.001;
  if (carry) {
    if (!ehDono(carrier)) return false;
    liberarGrabActor();
    const ok = tentarSoltarAFrente(carrier, carry);
    if (ok) {
      carry = null;
      carryOwner = null;
      if (orderCarrier === carrier) limparOrderCarrier();
    }
    return true;
  }
  if (grabAction) return true;
  if (orderCarrier && carrier === orderCarrier) return false;
  const target = resolverAlvo(carrier);
  if (!target) return false;
  const action = iniciarGrabNoAlvo(carrier, target, nowSec, cfg);
  if (!action) return false;
  grabAction = action;
  grabActor = carrier;
  if (action.failed) {
    carrier._forcaCanalLock = true;
    carrier.vx = 0;
    carrier.vy = 0;
  }
  return true;
}

/**
 * @param {object} follower
 * @param {{ kind: string, prop?: object, enemy?: object, weightTier: number }} target
 */
export function iniciarGrabOrdenado(follower, target) {
  if (!follower || !target || carry || grabAction) return false;
  if (follower.voando) return false;
  if (target.kind === "faintedWild") {
    if (!ehPokemonLevantavel(target.enemy)) return false;
    if (target.weightTier == null) {
      target = { ...target, weightTier: pesoDoPokemon(target.enemy) };
    }
  }
  const action = iniciarGrabNoAlvo(follower, target, performance.now() * 0.001, cfg);
  if (!action) return false;
  definirOrderCarrier(follower);
  follower._forcaCanalLock = true;
  follower.vx = 0;
  follower.vy = 0;
  grabAction = action;
  grabActor = follower;
  follower.ordemForca = null;
  return true;
}

/**
 * @param {object} follower
 * @param {number} x
 * @param {number} y
 */
export function executarSoltarOrdenado(follower, x, y) {
  if (!carry || !follower) return false;
  let ok = tentarSoltarEm(follower, carry, x, y);
  if (!ok) ok = tentarSoltarAFrente(follower, carry);
  if (!ok) return false;
  carry = null;
  carryOwner = null;
  throwAiming = false;
  throwCharge = 0;
  if (orderCarrier === follower) limparOrderCarrier();
  return true;
}

/**
 * @param {object} follower
 * @param {number} aimTx
 * @param {number} aimTy
 */
export function executarArremessoOrdenado(follower, aimTx, aimTy) {
  if (!iniciarArremesso(follower, aimTx, aimTy)) return false;
  if (orderCarrier === follower) limparOrderCarrier();
  return true;
}

/**
 * @param {object} carrier
 * @param {number} aimTx
 * @param {number} aimTy
 */
export function iniciarArremesso(carrier, aimTx, aimTy) {
  if (!carry || !ehDono(carrier)) return false;
  const ent = criarArremesso(carrier, carry, aimTx, aimTy);
  thrown.push(ent);
  carry = null;
  carryOwner = null;
  throwAiming = false;
  throwCharge = 0;
  return true;
}

/**
 * @param {number} dt
 * @param {object} carrier
 * @param {{ pointer?: { x: number, y: number } | null, carregando?: boolean, soltou?: boolean }} [opts]
 */
export function atualizarCanal(dt, carrier, opts = {}) {
  tickStruggleCarregado(carrier);
  const action = grabAction;
  if (!action || !carrier) {
    tickCarryMobility(carrier);
    tickThrowCharge(dt, carrier, opts);
    atualizarArremessos(thrown, dt, cfg.poderArremesso);
    return;
  }
  if (carry) {
    liberarGrabActor();
    tickCarryMobility(carrier);
    tickThrowCharge(dt, carrier, opts);
    atualizarArremessos(thrown, dt, cfg.poderArremesso);
    return;
  }

  const ordered = orderCarrier === carrier;
  const failed = ehFalhaGrab(action);
  const abort = () => {
    soltarVivoDoLift(action.enemy);
    liberarGrabActor();
    if (ordered) limparOrderCarrier();
  };

  if (!ordered && carrier !== grabActor) {
    abort();
    atualizarArremessos(thrown, dt, cfg.poderArremesso);
    return;
  }
  if (carrier.voando || carrier.escalando || carrier.planando) {
    abort();
    atualizarArremessos(thrown, dt, cfg.poderArremesso);
    return;
  }

  if (action.struggle) {
    action.elapsedSec += dt;
    if (action.elapsedSec >= action.durationSec) {
      const enemy = action.enemy;
      struggleBreakEvent = { carrier, enemy };
      soltarVivoDoLift(enemy);
      liberarGrabActor();
      if (ordered) limparOrderCarrier();
      if (enemy && !enemy.morto) {
        try {
          aplicarDanoLivre(enemy, carrier, 40, "normal", "physical", Date.now(), null);
        } catch {
          /* ok */
        }
      }
    }
    atualizarArremessos(thrown, dt, cfg.poderArremesso);
    return;
  }

  if (
    action.kind === "faintedWild" &&
    action.enemy &&
    !failed &&
    ehAgroForca(action.enemy)
  ) {
    marcarStruggle(action);
    atualizarArremessos(thrown, dt, cfg.poderArremesso);
    return;
  }

  const moved =
    Math.hypot(carrier.x - action.startX, carrier.y - action.startY) > 0.55;
  if (moved && !failed) {
    abort();
    atualizarArremessos(thrown, dt, cfg.poderArremesso);
    return;
  }

  action.elapsedSec += dt;
  if (failed && !action.failFeedbackPlayed && action.elapsedSec >= action.durationSec * 0.35) {
    action.failFeedbackPlayed = true;
    failedLiftEvent = {
      carrier,
      weightTier: action.weightTier,
      strengthTier: action.strengthTier,
    };
  }
  if (action.elapsedSec >= action.durationSec) {
    if (failed) {
      liberarGrabActor();
      if (ordered) limparOrderCarrier();
    } else {
      const held = finalizarGrab(action, carrier);
      liberarGrabActor();
      if (held) {
        carry = held;
        carryOwner = carrier;
        if (ordered) definirOrderCarrier(carrier);
      } else if (ordered) {
        limparOrderCarrier();
      }
    }
  }

  tickCarryMobility(carrier);
  tickThrowCharge(dt, carrier, opts);
  atualizarArremessos(thrown, dt, cfg.poderArremesso);
}

function tickCarryMobility(carrier) {
  if (!carrier) return;
  if (ehDono(carrier)) {
    carrier.forcaVelMul = mulVelDe(carrier);
  } else if (carrier.forcaVelMul != null && carrier.forcaVelMul !== 1 && !carry) {
    carrier.forcaVelMul = 1;
  }
}

function tickThrowCharge(dt, carrier, opts) {
  if (!carry || !ehDono(carrier)) {
    throwAiming = false;
    throwCharge = 0;
    return;
  }
  // Companion ordered não usa LMB do player.
  if (orderCarrier && carrier === orderCarrier && orderCarrier !== opts.playerCarrier) {
    return;
  }
  if (opts.carregando) {
    throwAiming = true;
    const ms = cfg.cargaArremessoMs || FORCA_CARGA_MS;
    throwCharge = Math.min(1, throwCharge + (dt * 1000) / ms);
  } else if (opts.soltou && throwAiming) {
    const mira = resolverMiraArremesso(carrier, {
      chargeProgress: throwCharge,
      pointer: opts.pointer,
    });
    iniciarArremesso(carrier, mira.x, mira.y);
  } else if (!opts.carregando) {
    throwAiming = false;
    throwCharge = 0;
  }
}

function tickStruggleCarregado(carrier) {
  if (!carry || carry.kind !== "faintedWild" || !carry.enemy) return;
  const enemy = carry.enemy;
  if (!ehAgroForca(enemy)) return;
  // Agro mid-carry: força drop
  forcarSoltarPerto(carrier);
  struggleBreakEvent = { carrier, enemy };
}

/**
 * @param {object | null} carrier
 */
export function forcarSoltarPerto(carrier) {
  const dono = carrier || carryOwner;
  if (!carry) {
    if (grabAction) {
      soltarVivoDoLift(grabAction.enemy);
      liberarGrabActor();
    }
    return;
  }
  const x = dono?.x ?? carry.originX ?? 0;
  const y = dono?.y ?? carry.originY ?? 0;
  if (carry.kind === "faintedWild" && carry.enemy) {
    restaurarPokemon(carry.enemy, x, y);
  } else if (carry.prop) {
    restaurarProp(carry.prop, x, y);
  }
  carry = null;
  carryOwner = null;
  throwAiming = false;
  throwCharge = 0;
  liberarGrabActor();
  limparOrderCarrier();
}

export function consumirFalhaLift() {
  const ev = failedLiftEvent;
  failedLiftEvent = null;
  return ev;
}

export function consumirStruggleBreak() {
  const ev = struggleBreakEvent;
  struggleBreakEvent = null;
  return ev;
}

export function resetarForca() {
  forcarSoltarPerto(carryOwner || orderCarrier || grabActor);
  limparArremessos(thrown);
  carry = null;
  carryOwner = null;
  throwAiming = false;
  throwCharge = 0;
  failedLiftEvent = null;
  struggleBreakEvent = null;
  limparOrderCarrier();
  stickyTarget = null;
}

/** Snapshot read-only para menu RMB. */
export function snapshotSistemaForca() {
  return {
    carry,
    carryOwner,
    orderCarrier,
    grabAction,
  };
}
