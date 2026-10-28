/**
 * Pousa o Pokémon deployado junto do jogador (porta / teleporte / shrine).
 */
import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";
import { OFFSET_MON } from "../navegacao/espacoSeguir.js";
import { resetarNav } from "../navegacao/seguirCaminho.js";
import { resolverPisoInterior } from "../jogo/pisoInterior.js";
import { resolverForaDeObstaculo } from "../fisica/obstaculos.js";
import { pokemonDeployado } from "./party.js";

/**
 * @param {object} mon
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
export function pousarMon(mon, x, y, z) {
  if (!mon) return;
  mon.x = x;
  mon.y = y;
  mon.z = z;
  mon.elevacao = z;
  mon.vx = 0;
  mon.vy = 0;
  mon.vz = 0;
  mon.hopLift = 0;
  mon.noChao = true;
  mon._colocado = true;
  if (mon.nav) resetarNav(mon);
}

/**
 * Pousa o mon deployado em OFFSET_MON do corpo, no piso válido.
 * @param {object} corpo
 * @param {{ z?: number, dirX?: number, dirY?: number, facing?: number }} [opts]
 * @returns {boolean}
 */
export function pousarCompanheiro(corpo, opts = {}) {
  const mon = pokemonDeployado();
  if (!mon || !corpo) return false;
  const z = Number.isFinite(opts.z) ? opts.z : (corpo.elevacao ?? corpo.z ?? ALTURA_PRACA);
  let mx = corpo.x + OFFSET_MON.x;
  let my = corpo.y + OFFSET_MON.y;
  const ok = resolverPisoInterior(mx, my, corpo.x, corpo.y);
  if (ok) {
    mx = ok.x;
    my = ok.y;
  } else {
    mx = corpo.x;
    my = corpo.y;
  }
  pousarMon(mon, mx, my, z);
  resolverForaDeObstaculo(mon);
  if (opts.dirX != null) mon.dirX = opts.dirX;
  if (opts.dirY != null) mon.dirY = opts.dirY;
  if (opts.facing != null) mon.facing = opts.facing;
  return true;
}
