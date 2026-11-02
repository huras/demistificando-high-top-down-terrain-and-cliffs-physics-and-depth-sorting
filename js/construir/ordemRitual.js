/**
 * Manda o companion até o site de construção e martela até concluir.
 */
import { cancelarPath } from "../navegacao/filaPath.js";
import { velocidadeDe } from "../pokemon/ator.js";
import { irPara } from "../pokemon/ia.js";
import {
  definirDeployado,
  listaParty,
  pokemonDeployado,
  pokemonNoCampo,
} from "../pokemon/party.js";
import { relogioPokemon } from "../pokemon/sistema.js";
import { marcarPose } from "../pokemon/sprites.js";
import { ACAO, capacidadesDe, esperaDaAcao } from "../campo/capacidades.js";
import { acertarRitual, siteConstrucao, temRitualAtivo } from "./ritual.js";
import { poeiraDoPreview } from "./poeira.js";

const DIST_ACERTO = 1.7;
const DIST_PARAR = 0.4;

/**
 * Escolhe companion capaz de CONSTRUIR (ou qualquer vivo se ninguém tiver).
 * @returns {number} índice na party ou -1
 */
export function indiceCompanheiroConstrutor() {
  const party = listaParty();
  const deploy = pokemonDeployado();
  if (deploy && !deploy.morto) {
    const caps = capacidadesDe(deploy.especie?.tipos || deploy.tipos || []);
    if (caps.includes(ACAO.CONSTRUIR)) return party.indexOf(deploy);
  }
  for (let i = 0; i < party.length; i++) {
    const mon = party[i];
    if (!mon || mon.morto) continue;
    const caps = capacidadesDe(mon.especie?.tipos || mon.tipos || []);
    if (caps.includes(ACAO.CONSTRUIR)) return i;
  }
  for (let i = 0; i < party.length; i++) {
    if (party[i] && !party[i].morto) return i;
  }
  return -1;
}

/**
 * Inicia ordem de construção no companion.
 * @returns {boolean}
 */
export function ordenarRitualConstrucao() {
  const site = siteConstrucao();
  if (!site?.proxy) return false;
  const idx = indiceCompanheiroConstrutor();
  if (idx < 0) return false;
  const party = listaParty();
  for (let i = 0; i < party.length; i++) {
    if (i !== idx && party[i]) party[i].ordemCampo = null;
  }
  const ator = party[idx];
  const jaEmCampo = pokemonNoCampo() === ator && !ator.capturado && ator._colocado;
  definirDeployado(idx);
  if (jaEmCampo) ator._colocado = true;
  const vivo = party[idx];
  vivo.ordemAlvo = null;
  vivo.alvo = null;
  vivo.modo = "roam";
  vivo.ordemCampo = {
    acao: ACAO.CONSTRUIR,
    construir: true,
    id: "construction-site",
    x: site.proxy.x,
    y: site.proxy.y,
    z: site.proxy.z ?? 0,
    proximo: 0,
    melhor: 99,
    preso: 0,
  };
  return true;
}

/**
 * Tick da ordem de construção (chamar junto com tickOrdens).
 * @param {number} dt
 * @returns {{ hit?: boolean, done?: boolean }|null}
 */
export function tickOrdemConstrucao(dt) {
  if (!temRitualAtivo()) return null;
  const mon = pokemonDeployado();
  const ordem = mon?.ordemCampo;
  if (!mon || mon.morto || !ordem?.construir) {
    return { precisaAuto: true };
  }
  // Ainda saindo da pokébola — deixa auto-hit de backup rodar depois do grace
  if (!mon._colocado) return { precisaAuto: true };

  const site = siteConstrucao();
  if (!site?.proxy) {
    mon.ordemCampo = null;
    return null;
  }

  const tx = site.proxy.x;
  const ty = site.proxy.y;
  const tz = site.proxy.z ?? 0;
  ordem.x = tx;
  ordem.y = ty;
  ordem.z = tz;

  const dx = mon.x - tx;
  const dy = mon.y - ty;
  const dist = Math.hypot(dx, dy);

  if (dist > DIST_ACERTO) {
    irPara(mon, tx, ty, tz, velocidadeDe(mon, true), dt, DIST_PARAR);
    return { precisaAuto: false };
  }

  cancelarPath(mon.id);
  mon.vx = 0;
  mon.vy = 0;
  mon.andando = false;
  mon.dirX = -dx;
  mon.dirY = -dy;

  const agora = Date.now();
  if (agora < (ordem.proximo || 0)) return { precisaAuto: false };

  poeiraDoPreview(site.preview);
  marcarPose(mon, "Attack", relogioPokemon());
  const hits = Math.max(1, site.burst | 0 || 1);
  const r = acertarRitual(hits);
  ordem.proximo = agora + esperaDaAcao(ACAO.CONSTRUIR);
  if (r.done) {
    mon.ordemCampo = null;
    return { hit: true, done: true };
  }
  return { hit: true, done: false, precisaAuto: false };
}
