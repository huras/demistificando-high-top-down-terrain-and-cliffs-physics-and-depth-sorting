/**
 * Path + execute Grab/Place/Throw para companions.
 * Espelha o fluxo de js/campo/ordem.js (aproximar com recuo, preso, acerto).
 */
import { cancelarPath } from "../navegacao/filaPath.js";
import { propPorId } from "../mundo/bioma/propsBioma.js";
import { velocidadeDe } from "../pokemon/ator.js";
import { irPara } from "../pokemon/ia.js";
import { listaParty, pokemonDeployado } from "../pokemon/party.js";
import {
  ehPokemonLevantavel,
  ehPropLevantavel,
  pesoDoPokemon,
} from "./alvos.js";
import { pesoDoProp } from "./pesoCarga.js";
import {
  ACAO_FORCA,
  ALCANCE_PLACE,
  ALCANCE_THROW,
} from "./ordemCompanheiro.js";
import {
  estaNoCanalForca,
  executarArremessoOrdenado,
  executarSoltarOrdenado,
  iniciarGrabOrdenado,
  obterCarry,
  obterOrderCarrier,
} from "./sistemaForca.js";

/** Mesma lógica do farm: para perto o bastante pra interagir. */
const DIST_ACERTO = 1.55;
const RECUO = 0.72;
const DIST_PARAR = 0.35;
const DIST_PRESO = 2.4;
const TEMPO_PRESO = 0.45;

function aproximar(mon, x, y, z, dt) {
  irPara(mon, x, y, z, velocidadeDe(mon, true), dt, DIST_PARAR);
}

/**
 * @param {object} mon
 * @param {string} acao
 * @param {object | null} alvo
 * @param {number} [aimX]
 * @param {number} [aimY]
 */
export function ordenarForca(mon, acao, alvo, aimX, aimY) {
  if (!mon || mon.morto || !acao) return false;
  // Limpa combate / farm pra não brigar com a ordem.
  mon.ordemAlvo = null;
  mon.alvo = null;
  mon.itemAlvo = null;
  mon.modo = "roam";
  mon.ordemCampo = null;
  mon._emLutaCampo = false;
  mon.correndo = true;

  const prop = alvo?.prop || (alvo?.tipo === "pedra" || alvo?.tipo === "cristal" ? alvo : null);
  const enemy = alvo?.enemy || (alvo?.especie && !prop ? alvo : null);

  mon.ordemForca = {
    acao,
    propId: prop?.id || alvo?.id || alvo?.propId || null,
    /** Referência viva — evita sumir se o id falhar no lookup. */
    prop: prop || null,
    kind:
      alvo?.kind ||
      (prop ? "rock" : enemy ? "faintedWild" : "aim"),
    enemy: enemy || null,
    weightTier: alvo?.weightTier,
    x: aimX ?? prop?.x ?? enemy?.x ?? alvo?.x ?? mon.x,
    y: aimY ?? prop?.y ?? enemy?.y ?? alvo?.y ?? mon.y,
    z: prop?.z ?? enemy?.z ?? alvo?.z ?? mon.z ?? 0,
    melhor: 99,
    preso: 0,
  };
  // #region agent log
  fetch('http://127.0.0.1:7578/ingest/2d17c26e-34d3-4e31-ad4f-513a36a051d1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5811b2'},body:JSON.stringify({sessionId:'5811b2',runId:'pre',hypothesisId:'A',location:'tickOrdensForca.js:ordenarForca',message:'ordem criada',data:{acao,kind:mon.ordemForca.kind,propId:mon.ordemForca.propId,hasProp:!!prop,hasEnemy:!!enemy,monKey:mon.especie?.key||null,x:mon.ordemForca.x,y:mon.ordemForca.y,colocado:!!mon._colocado},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return true;
}

/**
 * @param {number} dt
 */
export function tickOrdensForca(dt) {
  // Prioriza o deployado (mesmo padrão do farm).
  const deployado = pokemonDeployado();
  if (deployado?.ordemForca && !deployado.morto) {
    tickUm(deployado, dt);
    return;
  }
  const party = listaParty();
  for (let i = 0; i < party.length; i++) {
    const mon = party[i];
    if (mon?.ordemForca && !mon.morto && mon !== deployado) tickUm(mon, dt);
  }
}

/**
 * @param {object} mon
 * @param {number} dt
 */
function tickUm(mon, dt) {
  const ordem = mon.ordemForca;
  if (!ordem) return;
  if (!mon._colocado && !obterCarry()) {
    // #region agent log
    if ((ordem._dbgSkip = (ordem._dbgSkip || 0) + 1) <= 3 || ordem._dbgSkip % 30 === 0) {
      fetch('http://127.0.0.1:7578/ingest/2d17c26e-34d3-4e31-ad4f-513a36a051d1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5811b2'},body:JSON.stringify({sessionId:'5811b2',runId:'pre',hypothesisId:'B',location:'tickOrdensForca.js:tickUm',message:'skip !_colocado',data:{n:ordem._dbgSkip,acao:ordem.acao,monKey:mon.especie?.key||null,capturado:!!mon.capturado},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
    return;
  }
  if (mon.capturado) return;

  // Já no canal de lift — sistemaForca conduz.
  if (obterOrderCarrier() === mon && estaNoCanalForca() && ordem.acao === ACAO_FORCA.LEVANTAR) {
    mon.ordemForca = null;
    return;
  }

  if (ordem.acao === ACAO_FORCA.LEVANTAR) {
    tickLevantar(mon, ordem, dt);
    return;
  }

  if (ordem.acao === ACAO_FORCA.SOLTAR) {
    if (!obterCarry() || obterOrderCarrier() !== mon) {
      mon.ordemForca = null;
      return;
    }
    const dist = Math.hypot(mon.x - ordem.x, mon.y - ordem.y);
    if (dist > ALCANCE_PLACE) {
      aproximar(mon, ordem.x, ordem.y, ordem.z, dt);
      return;
    }
    cancelarPath(mon.id);
    executarSoltarOrdenado(mon, ordem.x, ordem.y);
    mon.ordemForca = null;
    return;
  }

  if (ordem.acao === ACAO_FORCA.ARREMESSAR) {
    if (!obterCarry() || obterOrderCarrier() !== mon) {
      mon.ordemForca = null;
      return;
    }
    const dist = Math.hypot(mon.x - ordem.x, mon.y - ordem.y);
    if (dist > ALCANCE_THROW + 2) {
      aproximar(mon, ordem.x, ordem.y, ordem.z, dt);
      return;
    }
    cancelarPath(mon.id);
    executarArremessoOrdenado(mon, ordem.x, ordem.y);
    mon.ordemForca = null;
  }
}

/**
 * @param {object} mon
 * @param {object} ordem
 * @param {number} dt
 */
function tickLevantar(mon, ordem, dt) {
  let alvoX = ordem.x;
  let alvoY = ordem.y;
  let alvoZ = ordem.z;
  let target = null;

  if (ordem.kind === "rock" || ordem.propId || ordem.prop) {
    let prop = ordem.prop;
    if (!prop || prop.forcaCarregado || !ehPropLevantavel(prop)) {
      prop = ordem.propId ? propPorId(ordem.propId) : null;
    }
    if (!prop || !ehPropLevantavel(prop)) {
      // Sem prop: ainda tenta chegar no ponto gravado (como farm).
      if (Math.hypot(mon.x - ordem.x, mon.y - ordem.y) < 2) {
        mon.ordemForca = null;
        return;
      }
      aproximar(mon, ordem.x, ordem.y, ordem.z, dt);
      return;
    }
    ordem.prop = prop;
    alvoX = prop.x;
    alvoY = prop.y;
    alvoZ = prop.z ?? 0;
    target = {
      kind: "rock",
      prop,
      weightTier: ordem.weightTier ?? pesoDoProp(prop),
    };
  } else if (ordem.enemy) {
    const enemy = ordem.enemy;
    if (!ehPokemonLevantavel(enemy)) {
      mon.ordemForca = null;
      return;
    }
    alvoX = enemy.x;
    alvoY = enemy.y;
    alvoZ = enemy.z ?? 0;
    target = {
      kind: "faintedWild",
      enemy,
      weightTier: ordem.weightTier ?? pesoDoPokemon(enemy),
    };
  } else {
    mon.ordemForca = null;
    return;
  }

  const dx = mon.x - alvoX;
  const dy = mon.y - alvoY;
  const dist = Math.hypot(dx, dy);

  if (dist > DIST_ACERTO) {
    if (dist + 0.05 < (ordem.melhor ?? 99)) {
      ordem.melhor = dist;
      ordem.preso = 0;
    } else if (dist < DIST_PRESO) ordem.preso = (ordem.preso || 0) + dt;
    else ordem.preso = 0;

    if ((ordem.preso || 0) < TEMPO_PRESO) {
      const len = dist || 1;
      mon.correndo = true;
      // #region agent log
      if ((ordem._dbgApr = (ordem._dbgApr || 0) + 1) <= 2 || ordem._dbgApr % 45 === 0) {
        fetch('http://127.0.0.1:7578/ingest/2d17c26e-34d3-4e31-ad4f-513a36a051d1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5811b2'},body:JSON.stringify({sessionId:'5811b2',runId:'pre',hypothesisId:'C',location:'tickOrdensForca.js:aproximar',message:'aproximando alvo',data:{dist,melhor:ordem.melhor,preso:ordem.preso,n:ordem._dbgApr,monX:mon.x,monY:mon.y,alvoX,alvoY},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion
      aproximar(
        mon,
        alvoX + (dx / len) * RECUO,
        alvoY + (dy / len) * RECUO,
        alvoZ,
        dt,
      );
      return;
    }
    // Preso perto: tenta levantar mesmo assim.
  }

  ordem.preso = 0;
  cancelarPath(mon.id);
  mon.vx = 0;
  mon.vy = 0;
  mon.andando = false;
  mon.correndo = false;
  mon.dirX = -dx;
  mon.dirY = -dy;

  const okGrab = iniciarGrabOrdenado(mon, target);
  // #region agent log
  fetch('http://127.0.0.1:7578/ingest/2d17c26e-34d3-4e31-ad4f-513a36a051d1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5811b2'},body:JSON.stringify({sessionId:'5811b2',runId:'pre',hypothesisId:'C',location:'tickOrdensForca.js:tickLevantar',message:'tentativa grab',data:{okGrab,dist,kind:target.kind,peso:target.weightTier,falhas:ordem.falhasStart||0,monKey:mon.especie?.key||null,propId:target.prop?.id||null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (okGrab) {
    mon.ordemForca = null;
    return;
  }
  // Ocupado (outro grab/carry): espera um pouco; senão cancela.
  ordem.falhasStart = (ordem.falhasStart || 0) + 1;
  if (ordem.falhasStart > 45) mon.ordemForca = null;
}
