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
  /** Intervalos: frequência 2× vs densificação anterior. */
  galeIntervalMax: 5.5,
  galeIntervalMin: 0.07,
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
  /**
   * Precipitação visual (mundo/s). Vento horizontal = vento.vx/vy * mul
   * (mesma amostra do HUD / asa). Em ~60 km/h, chuvaVentoMul≈28 e
   * chuvaQueda≈30 ⇒ inclinção ~35°.
   */
  chuvaQueda: 30,
  chuvaVentoMul: 28,
  chuvaStreakMundo: 0.9,
  chuvaStreakPx: 10,
  chuvaStreakVelK: 0.055,
  chuvaStreakPxVelK: 0.42,
  chuvaLarguraPx: 0.95,
  chuvaAlphaMin: 0.32,
  chuvaAlphaSpan: 0.48,
  areiaQueda: 2.4,
  areiaVentoMul: 34,
  neveQueda: 3.1,
  neveVentoMul: 12,
  /** Quão forte a neblina corta exposição (ciclo). */
  chuvaExposicaoMul: 0.16,
  /** Piso extra de ambient sob umidade/chuva. */
  chuvaAmbienteExtra: 0.08,
  /** Morph puff→manto no domo (0..1 escala uUmidade). */
  chuvaNuvemMorph: 1,
  /** Alongamento UV stratus — baixo pra não parecer o céu deslizando na troca. */
  chuvaNuvemEstica: 0.08,
  /** Widen do soft-edge da cobertura sob umidade. */
  chuvaNuvemBorda: 0.28,
  /**
   * Deriva UV das nuvens (offset mundo/s). Independente de clima.vento do preset
   * pra troca de clima não acelerar o céu.
   */
  nuvemDerivaBase: 0.55,
  nuvemDerivaVento: 0.9,
  nuvemDerivaMax: 1.6,
  /** Tau (s) só de limiar/umidade — cobertura enche mais devagar que a luz. */
  nuvemCoberturaTau: 7,
});
