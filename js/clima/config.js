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
  /** Alpha por pingo quase constante — densidade vem do instanceCount. */
  chuvaAlphaMin: 0.42,
  chuvaAlphaSpan: 0.28,
  /** Fração mínima de pingos no começo da chuva. */
  chuvaDensidadeMin: 0.035,
  /** Curva de densidade (1 = linear; >1 = poucos pingos no início/fim). */
  chuvaDensidadePow: 1.85,
  /** Tau (s) do mix chuva/areia/neve — sobe/desce pingos com suavidade. */
  chuvaDensidadeTau: 5.5,
  /** Impactos no chão por segundo em chuva cheia. */
  pingoTaxaCheia: 34,
  /** Curva própria: a dos fios (1.85) deixava o chão quase vazio. */
  pingoDensidadePow: 1.15,
  /** Raio do disco de spawn, em blocos, em volta do jogador. */
  pingoRaioDisco: 14,
  pingoRaioMin: 0.24,
  pingoRaioMax: 0.52,
  pingoDurMin: 0.5,
  pingoDurMax: 0.85,
  /** Pico de alpha do anel. */
  pingoAlpha: 0.72,
  /** Alongamento extra no eixo do vento com vento cheio (escala = 1 + isto). */
  pingoAlongaVento: 0.35,
  areiaQueda: 2.4,
  areiaVentoMul: 34,
  /** Alpha no pico. A rampa com o mix fica em precipitacao.js. */
  areiaAlpha: 0.12,
  /** Fração do instanceCount da chuva — areia é véu, não cortina. */
  areiaDensidade: 0.4,
  /** Largura no mundo. Baixa pra o grão não virar mancha no zoom. */
  areiaLargura: 0.04,
  areiaLarguraPx: 2.4,
  /** Piso do peso em pixel na mira (orto 0); no top-down o orto cobre o resto. */
  areiaPesoLarguraPx: 0.45,
  /** Fade da lente: some até ~1.5 m e só fecha por volta de 8 m. */
  areiaFadePerto0: 1.5,
  areiaFadePerto1: 8,
  neveQueda: 3.1,
  neveVentoMul: 12,
  /**
   * Corte residual de exposição sob névoa. Baixo de propósito:
   * clima fosco deve dessaturar / achatar, não escurecer como noite.
   */
  chuvaExposicaoMul: 0.05,
  /** Piso extra de ambient sob umidade/chuva (flatten fill). */
  chuvaAmbienteExtra: 0.14,
  /** Quanto o fosco puxa chroma → cinza (0..1 escala fosco). */
  foscoDesat: 0.72,
  /** Quanto o fosco eleva ambient/fill relativos ao sol fraco. */
  foscoFillLift: 0.22,
  /** Quanto o fosco suaviza brilhoSol sem matar midtones. */
  foscoBrilhoSol: 0.28,
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
