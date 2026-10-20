/**
 * Cores por altura — cada z lê diferente sem depender de sheet.
 * z1 chão … z17 cume (montanha 16 degraus).
 */
export const CORES = Object.freeze({
  topo: {
    1: { a: "#5aad3a", b: "#4f9e32" },
    2: { a: "#c4b14a", b: "#b5a23e" },
    3: { a: "#d9a35c", b: "#c8924a" },
    4: { a: "#d4846a", b: "#c4735a" },
  },
  bordaTopo: {
    1: "#2f7a24",
    2: "#7a6a22",
    3: "#8a5a28",
    4: "#8a3a2a",
  },
  faceTopo: "#a67c52",
  faceMeio: "#8b6340",
  faceBase: "#6e4a2e",
  faceSombra: "#4a3220",
  faceLateral: "#7a5635",
  grade: "rgba(0, 0, 0, 0.08)",
  debug: "rgba(255, 220, 80, 0.9)",
  debugStroke: "rgba(255, 220, 80, 0.5)",
  celulaJogador: "rgba(255, 255, 255, 0.95)",
  celulaJogadorGlow: "rgba(120, 220, 255, 0.35)",
});

/** Gradiente procedural acima de z4 (montanha alta). */
function topoPorAltura(z) {
  const n = Math.max(1, z | 0);
  if (n <= 4 && CORES.topo[n]) return CORES.topo[n];
  // z5…17: terra → pedra → neve
  const t = Math.min(1, (n - 4) / 13);
  const r = Math.round(0xd4 + (0xe8 - 0xd4) * t);
  const g = Math.round(0x84 + (0xe8 - 0x84) * t);
  const b = Math.round(0x6a + (0xf0 - 0x6a) * t);
  const a = `#${hex(r)}${hex(g)}${hex(b)}`;
  const bb = `#${hex(r - 18)}${hex(g - 18)}${hex(b - 14)}`;
  return { a, b: bb };
}

function bordaPorAltura(z) {
  const n = Math.max(1, z | 0);
  if (n <= 4 && CORES.bordaTopo[n]) return CORES.bordaTopo[n];
  const t = Math.min(1, (n - 4) / 13);
  const r = Math.round(0x8a + (0x90 - 0x8a) * t);
  const g = Math.round(0x3a + (0x90 - 0x3a) * t);
  const b = Math.round(0x2a + (0xa0 - 0x2a) * t);
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function hex(v) {
  return Math.max(0, Math.min(255, v | 0))
    .toString(16)
    .padStart(2, "0");
}

export function coresDoTopo(z) {
  return topoPorAltura(z);
}

export function bordaDoTopo(z) {
  return bordaPorAltura(z);
}
