/** Knobs do clima / vento / rajadas. */

export const CLIMA_CFG = Object.freeze({
  enabled: true,
  seed: 0x57454154,
  wind: 0.42,
  windDayTurns: 1.15,
  windAngle0: 2.6,
  windHudKmhAtRef: 72,
  galeWindHudRef: 0.9,
  galeWindSparse: 0.12,
  /** Alvo de rajadas vivas em vento cheio (escala com wind01). */
  galeGouges: 28,
  /** Cap do pool sim + faixas 3D (≥ galeGouges × 1.45). */
  galePoolMax: 48,
  /** Intervalos ~metade do antigo: densidade 2× sem encher mais lento. */
  galeIntervalMax: 11,
  galeIntervalMin: 0.14,
  galeSteerPerSec: 1.6,
  galeTailLag: 0.42,
  galeWander: 0.055,
  /** Meia-extensão da faixa em blocos (comprimento total ≈ 2×). */
  galeHalfLenMin: 7.2,
  galeHalfLenMax: 16,
  /** Meia-largura no centro (fina, estilo Wind Waker). */
  galeHalfWidth: 0.11,
  galeHalfWidthMax: 0.2,
  /** Altura sobre o chão da praça (min = metade do piso antigo 0.9). */
  galeAlturaMin: 0.45,
  galeAlturaMax: 2.3,
  clearDurationSec: Object.freeze([90, 200]),
  cloudyDurationSec: Object.freeze([55, 140]),
  precipDurationSec: Object.freeze([35, 100]),
  galeDurationSec: Object.freeze([28, 80]),
  transitionSec: 8,
  strongChance: 0.3,
  forecastPast: 3,
  /** Override manual (G / painel) dura estes segundos antes do ciclo retomar. */
  forcarSeg: 45,
  asaEmpuxo: 2.8,
  asaGaleExtra: 1.4,
  asaRajada: 0.35,
  asaSinkAlinhar: 0.22,
});
