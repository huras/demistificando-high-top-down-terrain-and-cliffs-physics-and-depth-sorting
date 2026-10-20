/** Nível 1 do BattleParticles, em unidades da arena (1 tile de lá = 1 unidade). */

const TILE = 96;
const VEL = 1170 / TILE;

const POR_CHAVE = {
  ember: { tipo: "leque", n: 3, graus: 8 },
  razorLeaf: { tipo: "leque", n: 3, graus: 8, vel: VEL, giro: 4.8 },
  bubble: { tipo: "leque", n: 2, graus: 10, vel: VEL * 0.85, amp: 22 / TILE, freq: 2.1 },
  flamethrower: { tipo: "jato", n: 8, dur: 0.55, intervalo: 0.07, graus: 8, vel: VEL, cresce: 6, distCresce: 7 },
  waterGun: { tipo: "unico", vel: VEL * 1.05 },
  swift: { tipo: "leque", n: 5, graus: 18, vel: VEL * 1.1 },
};

export function receitaRajada(chave) {
  return POR_CHAVE[chave] || null;
}

export function angulosLeque(n, graus) {
  const total = (graus * Math.PI) / 180;
  const lista = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0.5 : i / (n - 1);
    lista[i] = -total / 2 + total * t;
  }
  return lista;
}

export function desvioJato(graus) {
  return (Math.random() - 0.5) * ((graus * Math.PI) / 180);
}
