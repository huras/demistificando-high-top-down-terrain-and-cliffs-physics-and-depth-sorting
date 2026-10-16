/**
 * Manda o Pokémon do time até o prop e repete o acerto. Não entra em combate.
 */

import { cancelarPath } from "../navegacao/filaPath.js";
import { propPorId } from "../mundo/bioma/propsBioma.js";
import { velocidadeDe } from "../pokemon/ator.js";
import { irPara } from "../pokemon/ia.js";
import { definirDeployado, listaParty, pokemonDeployado, pokemonNoCampo } from "../pokemon/party.js";
import { executarNoProp } from "./acoes.js";
import { esperaDaAcao, segueOrdem } from "./capacidades.js";

const DIST_ACERTO = 1.15;
const RECUO = 0.9;

export function ordenarCampo(indice, acao, prop) {
  const party = listaParty();
  const ator = party[indice];
  if (!ator || ator.morto || !prop || !acao) return false;
  for (let i = 0; i < party.length; i++) {
    if (i !== indice) party[i].ordemCampo = null;
  }
  const jaEmCampo = pokemonNoCampo() === ator && ator._colocado;
  definirDeployado(indice);
  if (jaEmCampo) ator._colocado = true;
  const vivo = party[indice];
  vivo.ordemAlvo = null;
  vivo.alvo = null;
  vivo.modo = "roam";
  vivo.ordemCampo = {
    acao,
    id: prop.id,
    x: prop.x,
    y: prop.y,
    z: prop.z ?? 0,
    proximo: 0,
  };
  return true;
}

function aproximar(mon, x, y, z, dt) {
  irPara(mon, x, y, z, velocidadeDe(mon, true), dt);
}

export function tickOrdens(dt) {
  const mon = pokemonDeployado();
  if (!mon?.ordemCampo || mon.morto) {
    if (mon?.ordemCampo && mon.morto) mon.ordemCampo = null;
    return;
  }
  if (!mon._colocado) return;
  mon.ordemAlvo = null;
  mon.alvo = null;
  const ordem = mon.ordemCampo;
  const prop = propPorId(ordem.id);
  if (!prop) {
    if (Math.hypot(mon.x - ordem.x, mon.y - ordem.y) < 2) mon.ordemCampo = null;
    else aproximar(mon, ordem.x, ordem.y, ordem.z, dt);
    return;
  }
  if (!segueOrdem(ordem.acao, prop)) {
    mon.ordemCampo = null;
    return;
  }
  const dx = mon.x - prop.x;
  const dy = mon.y - prop.y;
  const dist = Math.hypot(dx, dy);
  if (dist > DIST_ACERTO) {
    const len = dist || 1;
    aproximar(mon, prop.x + (dx / len) * RECUO, prop.y + (dy / len) * RECUO, prop.z ?? ordem.z, dt);
    return;
  }
  cancelarPath(mon.id);
  mon.vx = 0;
  mon.vy = 0;
  mon.andando = false;
  const agora = Date.now();
  if (agora < ordem.proximo) return;
  const resultado = executarNoProp(ordem.acao, prop);
  if (resultado === "nao") {
    mon.ordemCampo = null;
    return;
  }
  if (resultado !== "espera") ordem.proximo = agora + esperaDaAcao(ordem.acao);
}
