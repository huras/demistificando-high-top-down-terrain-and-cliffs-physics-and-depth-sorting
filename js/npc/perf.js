/** Contadores leves de NPC — ative com ?npcPerf=1 */

const ativo =
  typeof location !== "undefined" &&
  /(?:^|[?&])npcPerf=1(?:&|$)/.test(location.search || "");

const contadores = Object.create(null);

export function npcPerfAtivo() {
  return ativo;
}

export function npcPerfCount(chave, n = 1) {
  if (!ativo) return;
  contadores[chave] = (contadores[chave] || 0) + n;
}

export function npcPerfMeasure(chave, fn) {
  if (!ativo) return fn();
  const t0 = performance.now();
  const out = fn();
  contadores[`${chave}Ms`] = (contadores[`${chave}Ms`] || 0) + (performance.now() - t0);
  contadores[`${chave}N`] = (contadores[`${chave}N`] || 0) + 1;
  return out;
}

export function npcPerfSnapshot() {
  return { ...contadores };
}

export function npcPerfReset() {
  for (const k of Object.keys(contadores)) delete contadores[k];
}
