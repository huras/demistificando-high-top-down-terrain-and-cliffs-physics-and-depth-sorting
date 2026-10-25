/**
 * Ordens Força para Pokémon soltos (RMB Levantar / Soltar / Arremessar).
 */
import { pokemonDeployado, listaParty } from "../pokemon/party.js";
import { estaMontado } from "../jogo/ride.js";
import {
  ehDesmaiadoLevantavel,
  ehPokemonLevantavel,
  ehPropLevantavel,
  pesoDoPokemon,
  pokemonSobMira,
  propSobMira,
} from "./alvos.js";
import { pesoDoProp } from "./pesoCarga.js";
import { celulaLivreParaSoltar, resolverTierCarrier } from "./carregar.js";
import { podeLevantar } from "./falhaLevantar.js";

export const ALCANCE_COMANDO = 13.5;
export const RAIO_MIRA = 1.45;
export const ALCANCE_GRAB = 1.15;
export const ALCANCE_PLACE = 1.65;
export const ALCANCE_THROW = 4.6;

export const ACAO_FORCA = Object.freeze({
  LEVANTAR: "levantar",
  SOLTAR: "soltar",
  ARREMESSAR: "arremessar",
});

/**
 * @returns {object[]}
 */
export function companionsDeployados() {
  const out = [];
  const mon = pokemonDeployado();
  // Deployado no campo (mesmo ainda colocando o sprite) — ordem RMB não exige _colocado.
  if (mon && !mon.morto && !mon.capturado) out.push(mon);
  return out;
}

/**
 * @param {object[]} deployed
 * @param {number} weightTier
 * @param {{ x: number, y: number } | null} [near]
 * @param {{ humanoTier?: number } | null} [cfg]
 */
export function escolherCompanheiroForca(deployed, weightTier, near = null, cfg = null) {
  const need = Math.max(1, weightTier | 0);
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < (deployed?.length || 0); i++) {
    const f = deployed[i];
    if (!f || f.morto || f.capturado) continue;
    if (resolverTierCarrier(f, cfg) < need) continue;
    if (!near) return f;
    const d = Math.hypot(f.x - near.x, f.y - near.y);
    if (d < bestDist) {
      bestDist = d;
      best = f;
    }
  }
  return best;
}

/**
 * Quem consegue; senão o mais perto (tenta e falha).
 */
export function escolherCompanheiroOrdem(deployed, weightTier, near = null, cfg = null) {
  return (
    escolherCompanheiroForca(deployed, weightTier, near, cfg) ??
    escolherCompanheiroForca(deployed, 1, near, cfg) ??
    null
  );
}

/**
 * @param {object} follower
 * @param {object} prop
 * @param {{ humanoTier?: number } | null} [cfg]
 */
export function companheiroPodeLevantarProp(follower, prop, cfg = null) {
  if (!follower || follower.morto || !ehPropLevantavel(prop)) return false;
  return podeLevantar(resolverTierCarrier(follower, cfg), pesoDoProp(prop));
}

/**
 * @param {number} mundoX
 * @param {number} mundoY
 * @param {{ x: number, y: number }} corpo
 * @param {object | null} sys
 * @param {{ humanoTier?: number } | null} [cfg]
 */
export function montarOpcoesMenuForca(mundoX, mundoY, corpo, sys, cfg = null) {
  /** @type {Array<object>} */
  const opcoes = [];
  if (!corpo || estaMontado()) return opcoes;

  const deployed = companionsDeployados();

  // Carry do companion: Soltar / Arremessar
  if (sys?.carry && sys.orderCarrier && sys.carryOwner === sys.orderCarrier) {
    const carrier = sys.orderCarrier;
    const livre = celulaLivreParaSoltar(null, sys.carry, mundoX, mundoY, carrier);
    if (livre) {
      opcoes.push({
        id: ACAO_FORCA.SOLTAR,
        rotulo: "Soltar",
        locked: false,
        mon: carrier,
        aimX: mundoX,
        aimY: mundoY,
      });
    }
    opcoes.push({
      id: ACAO_FORCA.ARREMESSAR,
      rotulo: "Arremessar",
      locked: false,
      mon: carrier,
      aimX: mundoX,
      aimY: mundoY,
    });
    return opcoes;
  }

  if (Math.hypot(mundoX - corpo.x, mundoY - corpo.y) > ALCANCE_COMANDO) {
    return opcoes;
  }

  const prop = propSobMira(mundoX, mundoY, RAIO_MIRA);
  const monAlvo = pokemonSobMira(mundoX, mundoY, RAIO_MIRA);

  if (prop) {
    const peso = pesoDoProp(prop);
    const assignee = escolherCompanheiroOrdem(deployed, peso, prop, cfg);
    if (!assignee) {
      opcoes.push({
        id: ACAO_FORCA.LEVANTAR,
        rotulo: "Levantar",
        locked: true,
        lockHint: deployed.length ? "Precisa de Força" : "Precisa de Pokémon solto",
        prop,
        weightTier: peso,
      });
    } else {
      opcoes.push({
        id: ACAO_FORCA.LEVANTAR,
        rotulo: "Levantar",
        locked: false,
        mon: assignee,
        prop,
        weightTier: peso,
        kind: "rock",
      });
    }
  } else if (monAlvo && ehPokemonLevantavel(monAlvo)) {
    // Não ordenar levantar o próprio companion deployado vivo
    const party = listaParty();
    const ehPartyVivo = party.includes(monAlvo) && !monAlvo.morto;
    if (!ehPartyVivo) {
      const peso = pesoDoPokemon(monAlvo);
      const assignee = escolherCompanheiroOrdem(deployed, peso, monAlvo, cfg);
      if (!assignee) {
        opcoes.push({
          id: ACAO_FORCA.LEVANTAR,
          rotulo: "Levantar",
          locked: true,
          lockHint: deployed.length ? "Precisa de Força" : "Precisa de Pokémon solto",
          enemy: monAlvo,
          weightTier: peso,
        });
      } else {
        opcoes.push({
          id: ACAO_FORCA.LEVANTAR,
          rotulo: "Levantar",
          locked: false,
          mon: assignee,
          enemy: monAlvo,
          weightTier: peso,
          kind: "faintedWild",
        });
      }
    }
  }

  return opcoes;
}

export { ehDesmaiadoLevantavel, ehPropLevantavel };
