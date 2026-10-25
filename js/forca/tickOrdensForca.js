/**
 * Path + execute Grab/Place/Throw para companions.
 */
import { cancelarPath } from "../navegacao/filaPath.js";
import { propPorId } from "../mundo/bioma/propsBioma.js";
import { velocidadeDe } from "../pokemon/ator.js";
import { irPara } from "../pokemon/ia.js";
import { listaParty } from "../pokemon/party.js";
import {
  ehPokemonLevantavel,
  ehPropLevantavel,
  pesoDoPokemon,
} from "./alvos.js";
import { pesoDoProp } from "./pesoCarga.js";
import {
  ACAO_FORCA,
  ALCANCE_GRAB,
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

const DIST_PARAR = 0.35;

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
  mon.ordemAlvo = null;
  mon.alvo = null;
  mon.modo = "roam";
  mon.ordemCampo = null;
  mon.ordemForca = {
    acao,
    propId: alvo?.id || alvo?.prop?.id || null,
    kind:
      alvo?.kind ||
      (alvo?.tipo === "pedra" || alvo?.tipo === "cristal"
        ? "rock"
        : alvo?.enemy || alvo?.especie
          ? "faintedWild"
          : "aim"),
    enemy: alvo?.enemy || (alvo?.especie ? alvo : null),
    weightTier: alvo?.weightTier,
    x: aimX ?? alvo?.x ?? mon.x,
    y: aimY ?? alvo?.y ?? mon.y,
    z: alvo?.z ?? mon.z ?? 0,
  };
  return true;
}

/**
 * @param {number} dt
 */
export function tickOrdensForca(dt) {
  const party = listaParty();
  for (let i = 0; i < party.length; i++) {
    const mon = party[i];
    if (mon?.ordemForca && !mon.morto) tickUm(mon, dt);
  }
}

/**
 * @param {object} mon
 * @param {number} dt
 */
function tickUm(mon, dt) {
  const ordem = mon.ordemForca;
  if (!ordem) return;
  if (!mon._colocado && !obterCarry()) return;

  if (obterOrderCarrier() === mon && estaNoCanalForca() && ordem.acao === ACAO_FORCA.LEVANTAR) {
    return;
  }

  if (ordem.acao === ACAO_FORCA.LEVANTAR) {
    let alvoX = ordem.x;
    let alvoY = ordem.y;
    let alvoZ = ordem.z;
    let target = null;

    if (ordem.kind === "rock" || ordem.propId) {
      const prop = propPorId(ordem.propId);
      if (!prop || !ehPropLevantavel(prop)) {
        mon.ordemForca = null;
        return;
      }
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

    const dist = Math.hypot(mon.x - alvoX, mon.y - alvoY);
    if (dist > ALCANCE_GRAB) {
      aproximar(mon, alvoX, alvoY, alvoZ, dt);
      return;
    }
    cancelarPath(mon.id);
    mon.vx = 0;
    mon.vy = 0;
    mon.andando = false;
    iniciarGrabOrdenado(mon, target);
    mon.ordemForca = null;
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
