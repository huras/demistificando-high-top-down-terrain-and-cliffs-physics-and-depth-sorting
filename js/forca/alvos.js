/**
 * Alvos de Força: pedras/cristais e Pokémon (desmaiado / vivo).
 */
import { RAIO_BASE_PEDRA, RAIO_POKEMON } from "../config.js";
import { FASE } from "../campo/estadoProps.js";
import { visitarVegetacaoNaArea } from "../mundo/bioma/propsBioma.js";
import { selvagensAtivos } from "../pokemon/populacao.js";
import { listaParty } from "../pokemon/party.js";
import { PORTAO_CORPO, PORTAO_PEDRA, scoreCone, scoreConeSuperficie } from "./alcance.js";
import { ehVivoLevantavel } from "./agarrarVivo.js";
import { pesoDoCorpo, pesoDoProp } from "./pesoCarga.js";

/**
 * @param {object | null | undefined} p
 */
export function ehPropLevantavel(p) {
  if (!p || p.oculto || p.forcaCarregado) return false;
  if (p.fase && p.fase !== FASE.EM_PE) return false;
  // Peças já encaixadas do puzzle de letra ficam fixas.
  if (p.letterPuzzle && !p.letterPuzzleLoose) return false;
  return p.tipo === "pedra" || p.tipo === "cristal";
}

/**
 * Corpo no chão.
 * @param {object | null | undefined} e
 */
export function ehDesmaiadoLevantavel(e) {
  if (!e || e.capturado || e.forcaCarregado) return false;
  if (!e.morto && (e.hp ?? 0) > 0) return false;
  return true;
}

/**
 * Desmaiado ou vivo (Ghost vivo fora).
 * @param {object | null | undefined} e
 */
export function ehPokemonLevantavel(e) {
  return ehDesmaiadoLevantavel(e) || ehVivoLevantavel(e);
}

/**
 * @param {object | null | undefined} e
 */
export function pesoDoPokemon(e) {
  const esp = e?.especie;
  return pesoDoCorpo({
    altura: esp?.altura,
    peso: esp?.peso,
  });
}

/**
 * @returns {object[]}
 */
export function listarEntidadesPresentes() {
  const out = [];
  const selvagens = selvagensAtivos();
  for (let i = 0; i < selvagens.length; i++) {
    const a = selvagens[i];
    if (a && !a.capturado) out.push(a);
  }
  const party = listaParty();
  for (let i = 0; i < party.length; i++) {
    const a = party[i];
    if (a && !a.capturado && a.morto) out.push(a);
  }
  return out;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {object} prop
 */
export function distSuperficieProp(x, y, prop) {
  const r = Math.max(0.2, prop.r > 0 ? prop.r : RAIO_BASE_PEDRA);
  return Math.max(0, Math.hypot(prop.x - x, prop.y - y) - r);
}

/**
 * @param {{ x: number, y: number }} body
 * @param {object | null} facing
 * @param {object} prop
 * @param {"enter"|"exit"} [mode]
 */
export function scorePedra(body, facing, prop, mode = "enter") {
  if (!body || !ehPropLevantavel(prop)) return null;
  const surface = distSuperficieProp(body.x, body.y, prop);
  const score = scoreConeSuperficie(
    body,
    facing,
    prop.x,
    prop.y,
    surface,
    PORTAO_PEDRA,
    mode,
  );
  if (!score) return null;
  return {
    kind: "rock",
    prop,
    dist2: score.dist2,
    toward: score.toward,
    weightTier: pesoDoProp(prop),
  };
}

/**
 * @param {{ x: number, y: number }} body
 * @param {object | null} facing
 * @param {object} enemy
 * @param {"enter"|"exit"} [mode]
 */
export function scoreCorpo(body, facing, enemy, mode = "enter") {
  if (!body || !ehPokemonLevantavel(enemy)) return null;
  const score = scoreCone(body, facing, enemy.x, enemy.y, PORTAO_CORPO, mode);
  if (!score) return null;
  return {
    kind: "faintedWild",
    enemy,
    dist2: score.dist2,
    toward: score.toward,
    weightTier: pesoDoPokemon(enemy),
  };
}

/**
 * @param {{ x: number, y: number }} body
 * @param {object | null} facing
 * @param {"enter"|"exit"} [mode]
 */
export function acharPedraProxima(body, facing, mode = "enter") {
  if (!body) return null;
  const pad = mode === "exit" ? 4.5 : 4;
  let best = null;
  let bestDist2 = Infinity;
  let bestToward = -Infinity;
  visitarVegetacaoNaArea(
    body.x - pad,
    body.y - pad,
    body.x + pad,
    body.y + pad,
    (p) => {
      const hit = scorePedra(body, facing, p, mode);
      if (!hit) return;
      if (
        hit.dist2 < bestDist2 - 1e-6 ||
        (Math.abs(hit.dist2 - bestDist2) <= 1e-6 && hit.toward > bestToward)
      ) {
        bestDist2 = hit.dist2;
        bestToward = hit.toward;
        best = hit;
      }
    },
  );
  return best;
}

/**
 * @param {{ x: number, y: number }} body
 * @param {object | null} facing
 * @param {object[]} [lista]
 * @param {"enter"|"exit"} [mode]
 */
export function acharCorpoProximo(body, facing, lista = null, mode = "enter") {
  if (!body) return null;
  const items = lista || listarEntidadesPresentes();
  let best = null;
  let bestDist2 = Infinity;
  let bestToward = -Infinity;
  for (let i = 0; i < items.length; i++) {
    const hit = scoreCorpo(body, facing, items[i], mode);
    if (!hit) continue;
    if (
      hit.dist2 < bestDist2 - 1e-6 ||
      (Math.abs(hit.dist2 - bestDist2) <= 1e-6 && hit.toward > bestToward)
    ) {
      bestDist2 = hit.dist2;
      bestToward = hit.toward;
      best = hit;
    }
  }
  return best;
}

/**
 * @param {{ x: number, y: number }} body
 * @param {object | null} facing
 * @param {{ sticky?: object | null }} [opts]
 */
export function acharAlvoForca(body, facing, opts = {}) {
  const sticky = opts.sticky || null;
  if (sticky) {
    let keep = null;
    if (sticky.kind === "rock" && sticky.prop) {
      keep = scorePedra(body, facing, sticky.prop, "exit");
    } else if (sticky.kind === "faintedWild" && sticky.enemy) {
      keep = scoreCorpo(body, facing, sticky.enemy, "exit");
    }
    if (keep) return keep;
  }
  const rock = acharPedraProxima(body, facing, "enter");
  const bodyHit = acharCorpoProximo(body, facing, null, "enter");
  if (!rock) return bodyHit;
  if (!bodyHit) return rock;
  if (rock.dist2 < bodyHit.dist2 - 1e-6) return rock;
  if (bodyHit.dist2 < rock.dist2 - 1e-6) return bodyHit;
  return rock.toward >= bodyHit.toward ? rock : bodyHit;
}

/**
 * Pedra/cristal sob o cursor (RMB).
 * @param {number} ax
 * @param {number} ay
 * @param {number} [aimRadius]
 */
export function propSobMira(ax, ay, aimRadius = 1.45) {
  let best = null;
  let dist = aimRadius;
  visitarVegetacaoNaArea(ax - 2, ay - 2, ax + 2, ay + 2, (p) => {
    if (!ehPropLevantavel(p)) return;
    const d = Math.hypot(p.x - ax, p.y - ay);
    if (d >= dist) return;
    dist = d;
    best = p;
  });
  return best;
}

/**
 * Pokémon sob o cursor (RMB).
 * @param {number} ax
 * @param {number} ay
 * @param {number} [aimRadius]
 */
export function pokemonSobMira(ax, ay, aimRadius = 1.45) {
  const items = listarEntidadesPresentes();
  let best = null;
  let dist = aimRadius + RAIO_POKEMON;
  for (let i = 0; i < items.length; i++) {
    const e = items[i];
    if (!ehPokemonLevantavel(e)) continue;
    const r = Math.max(0.3, e.r || RAIO_POKEMON);
    const d = Math.hypot(e.x - ax, e.y - ay) - r * 0.35;
    if (d >= dist) continue;
    dist = d;
    best = e;
  }
  return best;
}
