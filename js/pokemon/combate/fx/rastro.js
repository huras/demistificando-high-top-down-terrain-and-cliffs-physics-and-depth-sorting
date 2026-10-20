import { emitir } from "./poolParticulas3d.js";

/**
 * Emite rastro elemental ao longo do movimento.
 * @param {import('./elementos.js').ConfigElemento} el
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} vx
 * @param {number} vy
 * @param {number} dt
 * @param {number} [escala]
 */
export function emitirRastro(el, x, y, z, vx, vy, dt, escala = 1) {
  if (!el) return;
  const taxa = (el.rastro.taxa || 20) * Math.max(0.35, escala);
  const n = Math.max(1, Math.min(6, Math.round(taxa * dt)));
  const vel = Math.hypot(vx, vy) || 1;
  const nx = -vy / vel;
  const ny = vx / vel;
  const disp = el.rastro.dispersao || 0.8;
  for (let i = 0; i < n; i++) {
    const j = (Math.random() - 0.5) * disp * 0.35;
    emitir({
      x: x + nx * j,
      y: y + ny * j,
      z: z + (Math.random() - 0.3) * 0.15,
      vx: nx * j * 2 + (Math.random() - 0.5) * 0.4,
      vy: ny * j * 2 + (Math.random() - 0.5) * 0.4,
      vz: 0.4 + Math.random() * 0.8,
      cor: Math.random() < 0.35 ? el.nucleo : el.primaria,
      vida: el.rastro.vida * (0.7 + Math.random() * 0.5),
      tam: (0.1 + Math.random() * 0.1) * escala,
      modo: "faisca",
      drag: 0.88,
    });
  }
}
