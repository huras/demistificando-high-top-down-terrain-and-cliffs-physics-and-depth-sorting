/** Curvas Gen 4 e ganho de XP do overworld: floor(baseExp * nível / 7). */

export const NIVEL_MAX = 100;

export function totalParaNivel(nivel, crescimento = "mediumSlow") {
  const n = Math.max(1, nivel | 0);
  if (n <= 1) return 0;
  switch (crescimento) {
    case "fast":
      return Math.floor((4 * n ** 3) / 5);
    case "mediumFast":
      return n ** 3;
    case "slow":
      return Math.floor((5 * n ** 3) / 4);
    case "erratic":
      if (n <= 50) return Math.floor((n ** 3 * (100 - n)) / 50);
      if (n <= 68) return Math.floor((n ** 3 * (150 - n)) / 100);
      if (n <= 98) return Math.floor((n ** 3 * Math.floor((1911 - 10 * n) / 3)) / 500);
      return Math.floor((n ** 3 * (160 - n)) / 100);
    case "fluctuating":
      if (n <= 15) return Math.floor((n ** 3 * (Math.floor((n + 1) / 3) + 24)) / 50);
      if (n <= 36) return Math.floor((n ** 3 * (n + 14)) / 50);
      return Math.floor((n ** 3 * (Math.floor(n / 2) + 32)) / 50);
    default:
      return Math.floor((6 * n ** 3) / 5 - 15 * n ** 2 + 100 * n - 140);
  }
}

export function ganhoAoDerrotar(baseExp, nivel) {
  const b = baseExp | 0 || 60;
  const lv = Math.max(1, nivel | 0);
  return Math.max(1, Math.floor((b * lv) / 7));
}

export function progressoExp(nivel, exp, crescimento) {
  if (nivel >= NIVEL_MAX) return 1;
  const chao = totalParaNivel(nivel, crescimento);
  const teto = totalParaNivel(nivel + 1, crescimento);
  const faixa = teto - chao;
  if (faixa <= 0) return 1;
  return Math.min(1, Math.max(0, (exp - chao) / faixa));
}
