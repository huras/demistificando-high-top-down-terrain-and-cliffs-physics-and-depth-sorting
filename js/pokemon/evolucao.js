/**
 * Evolução por nível (port das regras do Pokemon AI).
 */

import {
  EVOLUCOES_HELD,
  EVOLUCOES_NIVEL,
  EVOLUCOES_OVERRIDE,
} from "./dados/evolucoesNivel.js";
import { especie } from "./dados.js";
import { aplicarNivel } from "./ator.js";
import { encherPp, sincronizarPpTipos } from "./pp.js";
import { calcularStats } from "./tipos.js";
import { golpe } from "./dados.js";

function chaveDe(ator) {
  return ator?.especie?.key || null;
}

/**
 * Próxima evolução elegível (sem aplicar).
 * @returns {{ from: string, into: string, level: number, heldItem?: string } | null}
 */
export function proximaEvolucao(ator) {
  const key = chaveDe(ator);
  if (!key) return null;
  const level = ator.nivel | 0;

  const override = EVOLUCOES_OVERRIDE[key];
  if (override && level >= override.level) {
    if (!especie(override.into)) return null;
    return { from: key, into: override.into, level };
  }

  const evo = EVOLUCOES_NIVEL[key];
  if (evo && level >= evo.level) {
    if (!especie(evo.into)) return null;
    return { from: key, into: evo.into, level };
  }

  const heldRules = EVOLUCOES_HELD[key];
  if (heldRules?.length) {
    const held = ator.heldItemKey || ator.itemSegurado || null;
    for (let i = 0; i < heldRules.length; i++) {
      const rule = heldRules[i];
      if (rule.heldItem === held && level >= rule.level && especie(rule.into)) {
        return {
          from: key,
          into: rule.into,
          level,
          heldItem: rule.heldItem,
        };
      }
    }
  }
  return null;
}

function remontaGolpesMantendo(ator, espNova) {
  const nivel = ator.nivel | 0;
  const lista = espNova.learnset || [];
  const sabidos = [];
  for (let i = 0; i < lista.length; i++) {
    if (lista[i][0] <= nivel) sabidos.push(lista[i][1]);
  }
  const atuais = (ator.golpes || [])
    .map((s) => s?.chave || s?.def?.key)
    .filter(Boolean);
  const vistos = new Set();
  const chaves = [];
  for (let i = 0; i < atuais.length && chaves.length < 4; i++) {
    if (vistos.has(atuais[i])) continue;
    if (!golpe(atuais[i])) continue;
    vistos.add(atuais[i]);
    chaves.push(atuais[i]);
  }
  for (let i = sabidos.length - 1; i >= 0 && chaves.length < 4; i--) {
    const k = sabidos[i];
    if (vistos.has(k) || !golpe(k)) continue;
    vistos.add(k);
    chaves.unshift(k);
  }
  const slots = [];
  for (let i = 0; i < chaves.length; i++) {
    const def = golpe(chaves[i]);
    if (!def) continue;
    const velho = (ator.golpes || []).find((s) => s?.chave === def.key);
    slots.push({
      chave: def.key,
      cd: velho?.cd || 0,
      def,
      pp: velho?.pp,
    });
  }
  ator.golpes = slots;
}

/**
 * Troca espécie mantendo % de HP.
 * @returns {object | null} espécie nova
 */
export function aplicarEvolucao(ator, intoKey) {
  const esp = especie(intoKey);
  if (!ator || !esp) return null;

  const prevMax = Math.max(1, ator.hpMax | 0);
  const ratio = Math.min(1, Math.max(0, (ator.hp | 0) / prevMax));

  ator.especie = esp;
  ator.tipos = (esp.tipos || []).slice();
  ator.crescimento = esp.crescimento;

  const nivel = Math.max(1, ator.nivel | 0);
  ator.stats = calcularStats(esp, nivel);
  ator.hpMax = ator.stats.hp;
  ator.hp = Math.max(1, Math.min(ator.hpMax, Math.round(ator.hpMax * ratio)));

  remontaGolpesMantendo(ator, esp);
  sincronizarPpTipos(ator);
  encherPp(ator);

  return esp;
}

/**
 * Aplica um passo se elegível.
 * @returns {{ from: string, into: string, level: number, heldItem?: string } | null}
 */
export function evoluirUmPasso(ator) {
  const pending = proximaEvolucao(ator);
  if (!pending) return null;
  aplicarEvolucao(ator, pending.into);
  if (pending.heldItem && ator.heldItemKey === pending.heldItem) {
    ator.heldItemKey = null;
  }
  if (pending.heldItem && ator.itemSegurado === pending.heldItem) {
    ator.itemSegurado = null;
  }
  return pending;
}

/** Reaplica stats de nível (sem evo) — útil após cancelar mid-anim. */
export function sincronizarNivel(ator) {
  if (!ator?.especie) return;
  aplicarNivel(ator, ator.nivel);
}
