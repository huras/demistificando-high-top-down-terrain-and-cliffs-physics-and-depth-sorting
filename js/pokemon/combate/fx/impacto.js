import { emitir, folhaParticula } from "./poolParticulas3d.js";

/**
 * Rajada de impacto elemental (camadas Elemental Free + BP chama no fogo).
 * @param {import('./elementos.js').ConfigElemento} el
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} [escala]
 * @param {{ impacto?: string, faisca?: string, anel?: string }} [opts]
 */
export function emitirImpacto(el, x, y, z, escala = 1, opts = {}) {
  if (!el) return;
  const cfg = el.impacto;
  const id = el.id || "normal";
  const folhaFaisca = opts.faisca || folhaParticula(el, "faisca");
  const folhaImpacto = opts.impacto || folhaParticula(el, "impacto") || folhaFaisca;
  const folhaAnel = opts.anel || folhaParticula(el, "anel");
  const n = Math.max(4, Math.min(48, Math.round((cfg.particulas || 24) * escala)));
  const raio = (cfg.raio || 0.45) * escala;
  const grav = cfg.gravidade || 0;

  // Núcleo explode / burst
  const nucleo = Math.max(3, Math.round(n * 0.35));
  for (let i = 0; i < nucleo; i++) {
    const ang = (i / nucleo) * Math.PI * 2 + Math.random() * 0.3;
    const rap = raio * (1.4 + Math.random() * 2.2);
    emitir({
      x,
      y,
      z,
      vx: Math.cos(ang) * rap,
      vy: Math.sin(ang) * rap,
      vz: (1.2 + Math.random() * 2) * escala,
      cor: i % 2 ? el.nucleo : el.primaria,
      vida: cfg.duracao * (0.55 + Math.random() * 0.4),
      tam: (0.22 + Math.random() * 0.18) * escala,
      modo: "faisca",
      folha: folhaImpacto,
      grav,
      drag: 0.88,
    });
  }

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
      folha: folhaFaisca,
      grav,
      drag: 0.9,
    });
  }

  // Anel expansivo com textura Ring quando disponível
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
      vida: 0.32,
      tam: (folhaAnel ? 0.28 : 0.2) * escala,
      modo: "poeira",
      folha: folhaAnel || "",
      drag: 0.86,
    });
  }

  // Fumaça alpha no impacto de fogo
  if (id === "fire") {
    for (let i = 0; i < 6; i++) {
      emitir({
        x: x + (Math.random() - 0.5) * 0.3,
        y: y + (Math.random() - 0.5) * 0.3,
        z: z + Math.random() * 0.4,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        vz: 0.6 + Math.random(),
        cor: "#9a9a9a",
        vida: 0.55,
        tam: 0.35 * escala,
        modo: "poeira",
        folha: "elf:Smoke_01",
        grav: -0.4,
        drag: 0.92,
      });
    }
  }
}
