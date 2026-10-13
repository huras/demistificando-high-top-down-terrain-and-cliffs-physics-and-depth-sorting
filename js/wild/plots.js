/** Mutação pura de canteiro. Sem mundo e sem desenho. */

import {
  ESTAGIO,
  duracaoEstagioSeg,
  estaCrescendo,
  msEfetivo,
  proximoEstagio,
} from "./estagios.js";

let seq = 1;

export function criarSolo(x, y, agora = Date.now()) {
  return {
    id: `plot-${seq++}`,
    x: x | 0,
    y: y | 0,
    stage: ESTAGIO.SOLO,
    berryKey: null,
    plantedAt: 0,
    lastWateredAt: 0,
    stageStartedAt: agora,
    growthMs: 0,
    lastSimAt: agora,
    wild: false,
  };
}

export function plantar(plot, berryKey, agora = Date.now()) {
  if (!plot || plot.stage !== ESTAGIO.SOLO || plot.berryKey) return false;
  plot.stage = ESTAGIO.SEMENTE;
  plot.berryKey = berryKey;
  plot.plantedAt = agora;
  plot.stageStartedAt = agora;
  plot.growthMs = 0;
  plot.lastSimAt = agora;
  return true;
}

export function regar(plot, agora = Date.now()) {
  if (!plot || plot.stage === ESTAGIO.SOLO || plot.stage === ESTAGIO.MADURA) return false;
  plot.lastWateredAt = agora;
  return true;
}

export function simularPlot(plot, agora = Date.now()) {
  if (!estaCrescendo(plot.stage)) {
    plot.lastSimAt = agora;
    return false;
  }
  const de = plot.lastSimAt || agora;
  plot.growthMs = (plot.growthMs || 0) + msEfetivo(de, agora, plot);
  plot.lastSimAt = agora;
  let mudou = false;
  while (estaCrescendo(plot.stage)) {
    const precisa = duracaoEstagioSeg(plot.stage) * 1000;
    if (plot.growthMs < precisa) break;
    plot.growthMs -= precisa;
    const prox = proximoEstagio(plot.stage);
    if (!prox) break;
    plot.stage = prox;
    plot.stageStartedAt = agora;
    mudou = true;
  }
  return mudou;
}

export function colher(plot, agora = Date.now()) {
  if (!plot || plot.stage !== ESTAGIO.MADURA || !plot.berryKey) return null;
  const key = plot.berryKey;
  plot.stage = ESTAGIO.SOLO;
  plot.berryKey = null;
  plot.plantedAt = 0;
  plot.lastWateredAt = 0;
  plot.growthMs = 0;
  plot.lastSimAt = agora;
  plot.stageStartedAt = agora;
  return key;
}

export function serializarPlot(plot) {
  return {
    id: plot.id,
    x: plot.x,
    y: plot.y,
    stage: plot.stage,
    berryKey: plot.berryKey,
    plantedAt: plot.plantedAt,
    lastWateredAt: plot.lastWateredAt,
    stageStartedAt: plot.stageStartedAt,
    growthMs: plot.growthMs,
    lastSimAt: plot.lastSimAt,
    wild: !!plot.wild,
  };
}

export function hidratarPlot(bruto) {
  if (!bruto || !Number.isFinite(bruto.x) || !Number.isFinite(bruto.y)) return null;
  const plot = criarSolo(bruto.x, bruto.y, bruto.lastSimAt || Date.now());
  plot.id = bruto.id || plot.id;
  plot.stage = bruto.stage || ESTAGIO.SOLO;
  plot.berryKey = bruto.berryKey || null;
  plot.plantedAt = bruto.plantedAt || 0;
  plot.lastWateredAt = bruto.lastWateredAt || 0;
  plot.stageStartedAt = bruto.stageStartedAt || plot.stageStartedAt;
  plot.growthMs = bruto.growthMs || 0;
  plot.lastSimAt = bruto.lastSimAt || Date.now();
  plot.wild = !!bruto.wild;
  return plot;
}
