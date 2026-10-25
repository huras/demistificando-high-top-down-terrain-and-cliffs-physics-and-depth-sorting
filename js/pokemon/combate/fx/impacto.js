import { emitir, folhaParticula } from "./poolParticulas3d.js";

/**
 * Rajada de impacto elemental.
 * @param {import('./elementos.js').ConfigElemento} el
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} [escala]
 */
export function emitirImpacto(el, x, y, z, escala = 1) {
  if (!el) return;
  const cfg = el.impacto;
  const folha = folhaParticula(el);
  const n = Math.max(4, Math.min(48, Math.round((cfg.particulas || 24) * escala)));
  const raio = (cfg.raio || 0.45) * escala;
  const grav = cfg.gravidade || 0;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const rap = raio * (2.2 + Math.random() * 3.2);
    const cor = i % 3 === 0 ? el.nucleo : i % 2 === 0 ? el.secundaria : el.primaria;
    emitir({
      x,
      y,
      z,
      vx: Math.cos(ang) * rap,
      vy: Math.sin(ang) * rap,
      vz: (1.6 + Math.random() * 2.4) * escala,
      cor,
      vida: cfg.duracao * (0.65 + Math.random() * 0.5),
      tam: (0.12 + Math.random() * 0.14) * escala,
      modo: grav < 0 ? "poeira" : "faisca",
      folha,
      grav: grav,
      drag: 0.9,
    });
  }
  // Anel expansivo (poeira no chão) — sempre círculo, mesmo no fogo.
  const anel = Math.max(6, Math.min(16, Math.round(10 * escala)));
  for (let i = 0; i < anel; i++) {
    const ang = (i / anel) * Math.PI * 2;
    emitir({
      x: x + Math.cos(ang) * raio * 0.2,
      y: y + Math.sin(ang) * raio * 0.2,
      z: Math.max(0.2, z - 0.4),
      vx: Math.cos(ang) * raio * 3.5,
      vy: Math.sin(ang) * raio * 3.5,
      vz: 0.3,
      cor: el.secundaria,
      vida: 0.28,
      tam: 0.2 * escala,
      modo: "poeira",
      drag: 0.86,
    });
  }
}
