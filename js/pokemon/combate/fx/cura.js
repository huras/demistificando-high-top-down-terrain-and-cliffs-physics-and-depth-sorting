/**
 * VFX 3D de cura (poções, berries, revive).
 * Camadas leves no pool GPU: bloom + anel + faíscas mint ascendentes.
 */

import { emitir } from "./poolParticulas3d.js";

const COR_PRIM = "#4ade80";
const COR_SOFT = "#a7f3d0";
const COR_NUC = "#ecfdf5";
const COR_OURO = "#fef08a";

/**
 * Altura de peito / núcleo do ator (elevação de voxel).
 * @param {object} alvo
 */
function peito(alvo) {
  if (!alvo) return 1.2;
  return (alvo.elevacao ?? alvo.z ?? 0) + (alvo.hopLift || 0) + 1.15;
}

/**
 * @param {object|null|undefined} alvo
 * @returns {{ x: number, y: number, z: number, r: number } | null}
 */
function ancora(alvo) {
  if (!alvo) return null;
  const x = Number(alvo.x);
  const y = Number(alvo.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const r = Math.max(0.28, Math.min(0.85, Number(alvo.raio) || Number(alvo.radius) || 0.42));
  return { x, y, z: peito(alvo), r };
}

/**
 * Anel expansivo no chão (bloom soft).
 * @param {number} x
 * @param {number} y
 * @param {number} zPe
 * @param {number} r
 * @param {number} escala
 * @param {string} cor
 * @param {string} folha
 */
function anelChao(x, y, zPe, r, escala, cor, folha) {
  const n = Math.max(6, Math.min(14, Math.round(10 * escala)));
  const z = Math.max(0.18, zPe - 0.95);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const rap = r * (2.4 + Math.random() * 1.6) * escala;
    emitir({
      x: x + Math.cos(ang) * r * 0.25,
      y: y + Math.sin(ang) * r * 0.25,
      z,
      vx: Math.cos(ang) * rap,
      vy: Math.sin(ang) * rap,
      vz: 0.15 + Math.random() * 0.25,
      cor,
      vida: 0.38 + Math.random() * 0.18,
      tam: (folha ? 0.26 : 0.16) * escala,
      modo: "poeira",
      folha,
      drag: 0.88,
    });
  }
}

/**
 * Coluna de faíscas / glow subindo ao redor do corpo.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} r
 * @param {{
 *   n: number,
 *   cor: string,
 *   soft: string,
 *   vida: number,
 *   escala: number,
 *   folha: string,
 *   folhaGlow: string,
 *   ouro?: boolean,
 * }} cfg
 */
function faixasAscendentes(x, y, z, r, cfg) {
  const { n, cor, soft, vida, escala, folha, folhaGlow, ouro } = cfg;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.45;
    const rad = r * (0.35 + Math.random() * 0.85);
    const baseZ = z - 0.55 + Math.random() * 0.7;
    const mint = i % 3 !== 0;
    emitir({
      x: x + Math.cos(ang) * rad,
      y: y + Math.sin(ang) * rad,
      z: baseZ,
      vx: (Math.random() - 0.5) * 0.55 * escala,
      vy: (Math.random() - 0.5) * 0.55 * escala,
      vz: (1.15 + Math.random() * 2.2) * escala,
      cor: ouro && i % 4 === 0 ? COR_OURO : mint ? cor : soft,
      vida: vida * (0.7 + Math.random() * 0.45),
      tam: (0.09 + Math.random() * 0.11) * escala,
      modo: "faisca",
      folha,
      grav: -0.65,
      drag: 0.91,
    });
  }

  const glow = Math.max(3, Math.round(n * 0.35));
  for (let i = 0; i < glow; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = r * (0.15 + Math.random() * 0.55);
    emitir({
      x: x + Math.cos(ang) * rad,
      y: y + Math.sin(ang) * rad,
      z: z - 0.35 + Math.random() * 0.5,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      vz: (0.7 + Math.random() * 1.4) * escala,
      cor: soft,
      vida: vida * 0.9,
      tam: (0.18 + Math.random() * 0.16) * escala,
      modo: "poeira",
      folha: folhaGlow,
      grav: -0.45,
      drag: 0.93,
    });
  }
}

/**
 * Núcleo branco-mint no peito (flash curto).
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} escala
 * @param {string} folha
 */
function nucleoFlash(x, y, z, escala, folha) {
  const n = Math.max(4, Math.min(10, Math.round(6 * escala)));
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    emitir({
      x,
      y,
      z,
      vx: Math.cos(ang) * 0.7 * escala,
      vy: Math.sin(ang) * 0.7 * escala,
      vz: 0.4 + Math.random() * 0.9,
      cor: i % 2 ? COR_NUC : COR_SOFT,
      vida: 0.28 + Math.random() * 0.16,
      tam: (0.2 + Math.random() * 0.14) * escala,
      modo: "faisca",
      folha,
      grav: -0.3,
      drag: 0.86,
    });
  }
}

/**
 * Dispara o VFX de cura no alvo (ator / treinador com x,y).
 * @param {object} alvo
 * @param {{
 *   big?: boolean,
 *   revive?: boolean,
 *   escala?: number,
 *   fallback?: object|null,
 * }} [opts]
 */
export function emitirCura(alvo, opts = {}) {
  // Na pokébola / sem coords: sobe no fallback (treinador).
  const noCampo = alvo && !alvo.capturado && Number.isFinite(alvo.x) && Number.isFinite(alvo.y);
  const a = (noCampo ? ancora(alvo) : null) || ancora(opts.fallback) || ancora(alvo);
  if (!a) return false;

  const big = !!opts.big || !!opts.revive;
  const revive = !!opts.revive;
  const escala = opts.escala > 0 ? opts.escala : big ? 1.35 : 1;
  const { x, y, z, r } = a;

  anelChao(x, y, z, r, escala, COR_SOFT, "elf:Ring_02");
  anelChao(x, y, z, r * 0.85, escala * 0.9, COR_PRIM, "elf:Ring_01");

  nucleoFlash(x, y, z, escala, "elf:Glow_01");

  faixasAscendentes(x, y, z, r, {
    n: big ? 18 : 12,
    cor: COR_PRIM,
    soft: COR_SOFT,
    vida: big ? 0.62 : 0.52,
    escala,
    folha: "elf:Sparkle_02",
    folhaGlow: "elf:Glow_01",
    ouro: revive,
  });

  // Segunda leva mais baixa / mais soft (profundidade)
  faixasAscendentes(x, y, z - 0.25, r * 0.9, {
    n: big ? 8 : 5,
    cor: COR_SOFT,
    soft: COR_NUC,
    vida: 0.45,
    escala: escala * 0.85,
    folha: "elf:Sparkle_03",
    folhaGlow: "elf:Glow_01",
    ouro: revive,
  });

  if (revive) {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      emitir({
        x: x + Math.cos(ang) * r * 0.4,
        y: y + Math.sin(ang) * r * 0.4,
        z: z + 0.2,
        vx: Math.cos(ang) * 1.4,
        vy: Math.sin(ang) * 1.4,
        vz: 1.8 + Math.random(),
        cor: COR_OURO,
        vida: 0.55,
        tam: 0.16 + Math.random() * 0.1,
        modo: "faisca",
        folha: "elf:Sparkle_01",
        grav: -0.7,
        drag: 0.9,
      });
    }
  }

  return true;
}

/**
 * Atalho: cura no peito do ator (mesmo contrato de impactoFx).
 * @param {object} alvo
 * @param {{ big?: boolean, revive?: boolean, escala?: number }} [opts]
 */
export function curaFx(alvo, opts = {}) {
  return emitirCura(alvo, opts);
}
