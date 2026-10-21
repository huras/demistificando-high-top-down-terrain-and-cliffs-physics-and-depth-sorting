import { CLIMA, CLIMA_LOGICO, INTENSIDADE, kindLogicoDe } from "./kinds.js";
import { CLIMA_CFG } from "./config.js";

export function zerarVento(out) {
  out.intensidade = 0;
  out.angulo = 0;
  out.vx = 0;
  out.vy = 0;
}

/**
 * Vento global a partir da fase do dia + clima.
 * @param {object} [cfg]
 * @param {number} dayPhase 0..1
 * @param {number} cover
 * @param {number} storm
 * @param {string} kindLogico
 * @param {string} intensidade
 * @param {string} [kindDisplay]
 */
export function calcularVentoGlobal(
  cfg,
  dayPhase,
  cover,
  storm,
  kindLogico,
  intensidade = INTENSIDADE.FRACO,
  kindDisplay = null,
) {
  const c = cfg || CLIMA_CFG;
  const base = c.wind ?? 0.42;
  const turns = c.windDayTurns ?? 1.15;
  const ang0 = c.windAngle0 ?? 2.6;
  const phase = ((dayPhase % 1) + 1) % 1;

  const ang =
    ang0 +
    phase * turns * Math.PI * 2 +
    Math.sin(phase * Math.PI * 2) * 0.55 +
    Math.sin(phase * Math.PI * 5.2 + cover * 1.4) * 0.28;

  const forte = intensidade === INTENSIDADE.FORTE;
  const display = kindDisplay ?? kindLogico;
  const logico = kindLogicoDe(kindLogico);
  let weatherMul = 0.82;
  if (logico === CLIMA_LOGICO.VENDAVAL || display === CLIMA.VENDAVAL) {
    weatherMul = forte ? 2.6 : 1.5;
  } else if (logico === CLIMA_LOGICO.PRECIP) {
    weatherMul = forte ? 1.55 : 1.4;
  } else if (display === CLIMA.NEVASCA || display === CLIMA.AREIA) {
    weatherMul = forte ? 1.7 : 1.55;
  } else if (display === CLIMA.CHUVA || display === CLIMA.NEVOA) {
    weatherMul = forte ? 1.55 : 1.4;
  } else if (logico === CLIMA_LOGICO.NUBLADO || display === CLIMA.NUBLADO) {
    weatherMul = 1.12;
  }

  const intensidadeOut = Math.max(
    0.08,
    base * weatherMul * (0.5 + cover * 0.2 + storm * 0.55),
  );

  return {
    intensidade: intensidadeOut,
    angulo: ang,
    vx: Math.cos(ang) * intensidadeOut,
    vy: Math.sin(ang) * intensidadeOut,
  };
}

export function ventoHud01(vento, cfg = CLIMA_CFG) {
  const ref = cfg.galeWindHudRef ?? 0.9;
  const w = vento?.intensidade ?? vento?.wind ?? 0;
  return Math.max(0, Math.min(1, w / (ref || 0.9)));
}

export function ventoHudKmh(vento, cfg = CLIMA_CFG) {
  return ventoHud01(vento, cfg) * (cfg.windHudKmhAtRef ?? 72);
}

export function intervaloSpawnGale(wind01, cfg = CLIMA_CFG) {
  const a = cfg.galeIntervalMax ?? 22;
  const b = cfg.galeIntervalMin ?? 0.28;
  const t = Math.max(0, Math.min(1, wind01));
  return a + (b - a) * t * t;
}
