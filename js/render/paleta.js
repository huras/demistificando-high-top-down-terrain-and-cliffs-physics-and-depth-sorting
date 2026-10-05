/**
 * Cores por altura — cada z lê diferente sem depender de sheet.
 * z1 chão, z2 terraço, z3 mirante.
 */
export const CORES = Object.freeze({
  // topos por nível (A/B = checker)
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
});

export function coresDoTopo(z) {
  const nivel = Math.min(4, Math.max(1, z | 0));
  return CORES.topo[nivel] || CORES.topo[1];
}

export function bordaDoTopo(z) {
  const nivel = Math.min(4, Math.max(1, z | 0));
  return CORES.bordaTopo[nivel] || CORES.bordaTopo[1];
}
