import { elementoDe } from "./elementos.js";
import { desligarFeixes, limparFeixes, ligarFeixes, sincronizarFeixes, tickFeixes } from "./feixe3d.js";
import { emitirImpacto } from "./impacto.js";
import {
  desligarPoolGpu,
  esconderArcos,
  limparPoolFx,
  ligarPoolGpu,
  sincronizarPoolGpu,
  tickPoolFx,
} from "./poolParticulas3d.js";
import { desligarPoolTiros, ligarPoolTiros, sincronizarPoolTiros } from "./poolTiros3d.js";
import { receitaFx } from "./receitas.js";

const CAP_PADROES = 8;

/** @type {import('./padraoBase.js').PadraoBase[]} */
const ativos = [];

/**
 * @param {object} origem
 * @param {object|null} alvo
 * @param {object} def
 * @param {object} [opts]
 */
export function dispararGolpeFx(origem, alvo, def, opts = {}) {
  if (!origem || !def) return false;
  const receita = receitaFx(def);
  if (!receita) return false;
  while (ativos.length >= CAP_PADROES) {
    const velho = ativos.shift();
    velho?.encerrar();
  }
  const padrao = receita.criar();
  const el = elementoDe(def.tipo || "normal");
  const escala = opts.escala > 0 ? opts.escala : 1;
  padrao.iniciar(origem, alvo, def, el, { ...(receita.opts || {}), escala, ...opts });
  ativos.push(padrao);
  return true;
}

/**
 * Impacto genérico (projétil acertou / melee hit sem padrão dedicado).
 * @param {object} alvo
 * @param {string} tipo
 * @param {number} [efet]
 */
export function impactoFx(alvo, tipo, efet = 1) {
  if (!alvo) return;
  const el = elementoDe(tipo || "normal");
  const z = (alvo.elevacao ?? alvo.z ?? 0) + (alvo.hopLift || 0) + 1.15;
  const escala = efet > 1 ? 1.35 : efet < 1 && efet > 0 ? 0.75 : 1;
  emitirImpacto(el, alvo.x, alvo.y, z, escala);
}

/** @param {number} dt */
export function tickFx(dt) {
  const passo = Math.min(0.05, dt);
  for (let i = ativos.length - 1; i >= 0; i--) {
    const p = ativos[i];
    p.atualizar(passo);
    if (!p.vivo()) ativos.splice(i, 1);
  }
  tickPoolFx(passo);
  tickFeixes(passo);
}

export function limparFx() {
  for (let i = 0; i < ativos.length; i++) ativos[i].encerrar();
  ativos.length = 0;
  limparPoolFx();
  limparFeixes();
  esconderArcos();
}

/** @param {import('three').Scene} cena */
export function ligarFxCena(cena) {
  if (!cena) return;
  ligarPoolGpu(cena);
  ligarPoolTiros(cena);
  ligarFeixes(cena);
}

export function desligarFxCena() {
  desligarPoolGpu();
  desligarPoolTiros();
  desligarFeixes();
}

/**
 * @param {number} [distMax]
 * @param {{x:number,y:number}|null} [foco]
 * @param {import('three').Camera} [camera]
 */
export function sincronizarFx(distMax = 0, foco = null, camera = null) {
  let usaArcos = false;
  for (let i = 0; i < ativos.length; i++) {
    const p = ativos[i];
    if (p.variante === "growl" || p.variante === "tail" || p.estrelas) {
      usaArcos = true;
      break;
    }
  }
  if (!usaArcos) esconderArcos();
  sincronizarPoolGpu(distMax, foco);
  if (camera) {
    sincronizarPoolTiros(camera);
    sincronizarFeixes(camera);
  }
}

export function padroesAtivos() {
  return ativos.length;
}
