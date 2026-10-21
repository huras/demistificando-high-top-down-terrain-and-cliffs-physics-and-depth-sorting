/** PP por tipo: uma barra por elemento presente nos golpes equipados. */

import { escalaRecarga } from "./tipos.js";

function tipoDoGolpe(def) {
  return def?.tipo || "normal";
}

function custoDoGolpe(def) {
  if (def?.pp === 0) return 0;
  return def?.pp || 1;
}

/** Monta/atualiza `ator.ppPorTipo` e `ator.ppTipos` a partir dos golpes. */
export function sincronizarPpTipos(ator) {
  if (!ator) return;
  const max = Math.max(1, ator.ppMax || 1);
  const antigo = ator.ppPorTipo || {};
  const novo = Object.create(null);
  const ordem = [];
  const golpes = ator.golpes || [];
  for (let i = 0; i < golpes.length; i++) {
    const tipo = tipoDoGolpe(golpes[i]?.def);
    if (novo[tipo] != null) continue;
    ordem.push(tipo);
    novo[tipo] = antigo[tipo] != null ? Math.min(max, Math.max(0, antigo[tipo])) : max;
  }
  ator.ppPorTipo = novo;
  ator.ppTipos = ordem;
}

export function ppMaxDe(ator) {
  return Math.max(1, ator?.ppMax || 1);
}

export function ppDe(ator, tipo) {
  if (!ator || !tipo) return 0;
  const mapa = ator.ppPorTipo;
  if (!mapa || mapa[tipo] == null) return 0;
  return mapa[tipo];
}

export function podeGastarPp(ator, def) {
  if (!ator || !def) return false;
  const custo = custoDoGolpe(def);
  if (custo <= 0) return true;
  return ppDe(ator, tipoDoGolpe(def)) >= custo;
}

export function gastarPp(ator, def) {
  if (!ator || !def) return false;
  const custo = custoDoGolpe(def);
  if (custo <= 0) return true;
  const tipo = tipoDoGolpe(def);
  const mapa = ator.ppPorTipo;
  if (!mapa || mapa[tipo] == null) return false;
  if (mapa[tipo] < custo) return false;
  mapa[tipo] = Math.max(0, mapa[tipo] - custo);
  return true;
}

/** Regen em todas as barras (mesmo ritmo do pool antigo). */
export function tickPp(ator, dt, movendo) {
  if (!ator || !(dt > 0) || ator.morto || ator.capturado) return;
  const mapa = ator.ppPorTipo;
  if (!mapa) return;
  const max = ppMaxDe(ator);
  let regen = (1 / 10) * (1 / escalaRecarga(ator.stats?.velocidade || 50));
  if (movendo) regen += 1;
  const ganho = regen * dt;
  if (!(ganho > 0)) return;
  const tipos = ator.ppTipos;
  if (tipos && tipos.length) {
    for (let i = 0; i < tipos.length; i++) {
      const t = tipos[i];
      mapa[t] = Math.min(max, mapa[t] + ganho);
    }
    return;
  }
  for (const t in mapa) mapa[t] = Math.min(max, mapa[t] + ganho);
}

export function encherPp(ator) {
  if (!ator) return;
  if (!ator.ppPorTipo) sincronizarPpTipos(ator);
  const max = ppMaxDe(ator);
  const mapa = ator.ppPorTipo;
  if (!mapa) return;
  for (const t in mapa) mapa[t] = max;
}

/** Soma `qtd` em todas as barras (Leppa). */
export function restaurarPp(ator, qtd) {
  if (!ator || !(qtd > 0)) return;
  if (!ator.ppPorTipo) sincronizarPpTipos(ator);
  const max = ppMaxDe(ator);
  const mapa = ator.ppPorTipo;
  if (!mapa) return;
  for (const t in mapa) mapa[t] = Math.min(max, (mapa[t] || 0) + qtd);
}

export function mapaPp(ator) {
  const out = Object.create(null);
  const tipos = ator?.ppTipos;
  const mapa = ator?.ppPorTipo;
  if (!tipos || !mapa) return out;
  for (let i = 0; i < tipos.length; i++) {
    const t = tipos[i];
    out[t] = mapa[t] || 0;
  }
  return out;
}
