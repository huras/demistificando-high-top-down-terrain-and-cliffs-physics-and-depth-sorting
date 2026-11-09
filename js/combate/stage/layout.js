/**
 * Âncoras de formação no disco da arena (aliados −X, foes +X).
 */

export const STAGE_SLOT_CAP = 5;

/**
 * @param {"aliado"|"foe"} lado
 * @param {number} index 0-based
 * @param {number} total
 */
export function poseSlot(lado, index, total) {
  const n = Math.max(1, Math.min(STAGE_SLOT_CAP, total | 0));
  const i = Math.max(0, Math.min(n - 1, index | 0));
  const baseX = lado === "aliado" ? -5.2 : 5.2;
  const dirX = lado === "aliado" ? 1 : -1;
  const spread = n <= 1 ? 0 : Math.min(1.55, 2.8 / Math.max(1, n - 1));
  const mid = (n - 1) * 0.5;
  return {
    x: baseX,
    y: (i - mid) * spread,
    dirX,
    dirY: 0,
  };
}

/**
 * @param {object[]} aliados
 * @param {object[]} foes
 */
export function aplicarFormacao(aliados, foes) {
  const a = Array.isArray(aliados) ? aliados : [];
  const f = Array.isArray(foes) ? foes : [];
  for (let i = 0; i < a.length; i++) {
    const slot = poseSlot("aliado", i, a.length);
    const ator = a[i];
    if (!ator) continue;
    ator.x = slot.x;
    ator.y = slot.y;
    ator.z = 0;
    ator.elevacao = 0;
    ator.casaX = slot.x;
    ator.casaY = slot.y;
    ator.casaZ = 0;
    ator.casaChronoX = slot.x;
    ator.casaChronoY = slot.y;
    ator.dirX = slot.dirX;
    ator.dirY = slot.dirY;
    ator.vx = 0;
    ator.vy = 0;
  }
  for (let i = 0; i < f.length; i++) {
    const slot = poseSlot("foe", i, f.length);
    const ator = f[i];
    if (!ator) continue;
    ator.x = slot.x;
    ator.y = slot.y;
    ator.z = 0;
    ator.elevacao = 0;
    ator.casaX = slot.x;
    ator.casaY = slot.y;
    ator.casaZ = 0;
    ator.casaChronoX = slot.x;
    ator.casaChronoY = slot.y;
    ator.dirX = slot.dirX;
    ator.dirY = slot.dirY;
    ator.vx = 0;
    ator.vy = 0;
  }
}

/** Lista plana aliados + foes vivos para o renderer (ordem de slots). */
export function listaAtoresStage(aliados, foes) {
  const out = [];
  const a = Array.isArray(aliados) ? aliados : [];
  const f = Array.isArray(foes) ? foes : [];
  for (let i = 0; i < a.length; i++) if (a[i]) out.push(a[i]);
  for (let i = 0; i < f.length; i++) if (f[i]) out.push(f[i]);
  return out;
}
