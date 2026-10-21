/**
 * Relógio lógico: limpo → nublado → precip | vendaval.
 */
import { CLIMA_CFG } from "./config.js";
import {
  CLIMA,
  CLIMA_LOGICO,
  INTENSIDADE,
  displayPrecip,
  kindLogicoDe,
} from "./kinds.js";
import { calcularVentoGlobal } from "./vento.js";

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function mulberry32(a) {
  return function rng() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rng, lo, hi) {
  return lo + (hi - lo) * rng();
}

export function pickNext(from, rng, opts = {}) {
  const wrap = opts.wrapPrecipWithGale === true;
  const logico = kindLogicoDe(from);
  if (logico === CLIMA_LOGICO.NUBLADO) {
    const r = rng();
    if (wrap) return r < 0.5 ? CLIMA_LOGICO.VENDAVAL : CLIMA_LOGICO.LIMPO;
    if (r < 0.32) return CLIMA_LOGICO.PRECIP;
    if (r < 0.5) return CLIMA_LOGICO.VENDAVAL;
    return CLIMA_LOGICO.LIMPO;
  }
  if (logico === CLIMA_LOGICO.PRECIP) {
    return wrap ? CLIMA_LOGICO.VENDAVAL : CLIMA_LOGICO.NUBLADO;
  }
  if (logico === CLIMA_LOGICO.VENDAVAL) {
    if (wrap) return rng() < 0.55 ? CLIMA_LOGICO.PRECIP : CLIMA_LOGICO.NUBLADO;
    return CLIMA_LOGICO.NUBLADO;
  }
  return CLIMA_LOGICO.NUBLADO;
}

export function pickPrev(to, rng, opts = {}) {
  const wrap = opts.wrapPrecipWithGale === true;
  const logico = kindLogicoDe(to);
  if (logico === CLIMA_LOGICO.LIMPO) return CLIMA_LOGICO.NUBLADO;
  if (logico === CLIMA_LOGICO.PRECIP) {
    return wrap ? CLIMA_LOGICO.VENDAVAL : CLIMA_LOGICO.NUBLADO;
  }
  if (logico === CLIMA_LOGICO.VENDAVAL) {
    if (wrap) return rng() < 0.45 ? CLIMA_LOGICO.PRECIP : CLIMA_LOGICO.NUBLADO;
    return CLIMA_LOGICO.NUBLADO;
  }
  const r = rng();
  if (wrap) return r < 0.45 ? CLIMA_LOGICO.LIMPO : CLIMA_LOGICO.VENDAVAL;
  if (r < 0.45) return CLIMA_LOGICO.LIMPO;
  if (r < 0.72) return CLIMA_LOGICO.PRECIP;
  return CLIMA_LOGICO.VENDAVAL;
}

function durationFor(kind, cfg, rng) {
  const logico = kindLogicoDe(kind);
  const ranges = {
    [CLIMA_LOGICO.LIMPO]: cfg.clearDurationSec ?? [90, 200],
    [CLIMA_LOGICO.NUBLADO]: cfg.cloudyDurationSec ?? [55, 140],
    [CLIMA_LOGICO.PRECIP]: cfg.precipDurationSec ?? [35, 100],
    [CLIMA_LOGICO.VENDAVAL]: cfg.galeDurationSec ?? [28, 80],
  };
  const [lo, hi] = ranges[logico] ?? [60, 120];
  return randRange(rng, lo, hi);
}

function targetsFor(kind) {
  const logico = kindLogicoDe(kind);
  if (logico === CLIMA_LOGICO.PRECIP) return { cloud: 1, storm: 1 };
  if (logico === CLIMA_LOGICO.VENDAVAL) return { cloud: 0.62, storm: 1 };
  if (logico === CLIMA_LOGICO.NUBLADO) return { cloud: 0.95, storm: 0 };
  return { cloud: 0, storm: 0 };
}

function sortearIntensidade(kind, cfg, rng) {
  const logico = kindLogicoDe(kind);
  if (logico !== CLIMA_LOGICO.PRECIP && logico !== CLIMA_LOGICO.VENDAVAL) {
    return INTENSIDADE.FRACO;
  }
  const p = clamp01(Number(cfg.strongChance) || 0.3);
  return rng() < p ? INTENSIDADE.FORTE : INTENSIDADE.FRACO;
}

export class SistemaClima {
  /** @param {object} [cfg] */
  constructor(cfg = {}) {
    this.cfg = { ...CLIMA_CFG, ...cfg };
    this.enabled = this.cfg.enabled !== false;
    this._rng = mulberry32(Number.isFinite(this.cfg.seed) ? this.cfg.seed : 0x57454154);
    this.kind = CLIMA_LOGICO.LIMPO;
    this._nextKind = CLIMA_LOGICO.NUBLADO;
    this.intensity = INTENSIDADE.FRACO;
    this._nextIntensity = INTENSIDADE.FRACO;
    this._holdMax = durationFor(this.kind, this.cfg, this._rng);
    this._hold = this._holdMax;
    this._blend = 1;
    this._fromCloud = 0;
    this._fromStorm = 0;
    this._toCloud = 0;
    this._toStorm = 0;
    this.cloudCover = 0;
    this.storm = 0;
    this._dayPhase = 0.4;
    this._wrapGale = this.cfg.wrapPrecipWithGale === true;
    this._upcoming = [];
    this._history = [];
    this._historyInt = [];
    this._historyMax = Math.max(0, Math.min(6, this.cfg.forecastPast | 0 || 3));
    this._fillUpcoming(2);
    this._prewarmHistory();
    this.vento = { intensidade: 0.42, angulo: 0, vx: 0, vy: 0 };
  }

  _opts() {
    return this._wrapGale ? { wrapPrecipWithGale: true } : {};
  }

  _entrada(kind, intensity) {
    return {
      kind: kindLogicoDe(kind),
      intensity:
        intensity === INTENSIDADE.FORTE || intensity === INTENSIDADE.FRACO
          ? intensity
          : sortearIntensidade(kind, this.cfg, this._rng),
    };
  }

  _fillUpcoming(n) {
    let cur = this._blend < 1 ? this._nextKind : this.kind;
    while (this._upcoming.length < n) {
      const next = pickNext(cur, this._rng, this._opts());
      this._upcoming.push(this._entrada(next));
      cur = next;
    }
  }

  _prewarmHistory() {
    while (this._history.length < this._historyMax) {
      const anchor = this._history[0] ?? this.kind;
      const prev = pickPrev(anchor, this._rng, this._opts());
      this._history.unshift(prev);
      this._historyInt.unshift(sortearIntensidade(prev, this.cfg, this._rng));
    }
  }

  _pushHistory(kind, intensity) {
    this._history.push(kindLogicoDe(kind));
    this._historyInt.push(intensity === INTENSIDADE.FORTE ? INTENSIDADE.FORTE : INTENSIDADE.FRACO);
    while (this._history.length > this._historyMax) {
      this._history.shift();
      this._historyInt.shift();
    }
  }

  _beginTransition(kind) {
    this._fromCloud = this.cloudCover;
    this._fromStorm = this.storm;
    const logico = kindLogicoDe(kind);
    const t = targetsFor(logico);
    this._toCloud = t.cloud;
    this._toStorm = t.storm;
    this._nextKind = logico;
    this._nextIntensity = sortearIntensidade(logico, this.cfg, this._rng);
    this._blend = 0;
  }

  /**
   * @param {number} dt
   * @param {{ dayPhase?: number }} [opts]
   */
  update(dt, opts = {}) {
    if (!this.enabled || !(dt > 0)) return;
    if (Number.isFinite(opts.dayPhase)) this._dayPhase = opts.dayPhase;

    const trans = Math.max(1, this.cfg.transitionSec || 8);
    if (this._blend < 1) {
      this._blend = Math.min(1, this._blend + dt / trans);
      const u = this._blend;
      this.cloudCover = this._fromCloud + (this._toCloud - this._fromCloud) * u;
      this.storm = this._fromStorm + (this._toStorm - this._fromStorm) * u;
      if (this._blend >= 1) {
        this._pushHistory(this.kind, this.intensity);
        this.kind = this._nextKind;
        this.intensity = this._nextIntensity;
        this._holdMax = durationFor(this.kind, this.cfg, this._rng);
        this._hold = this._holdMax;
        if (this._upcoming.length && this._upcoming[0].kind === this.kind) {
          this._upcoming.shift();
        }
        this._fillUpcoming(2);
      }
    } else {
      this._hold -= dt;
      if (this._hold <= 0) {
        const next = this._upcoming.shift()?.kind ?? pickNext(this.kind, this._rng, this._opts());
        this._fillUpcoming(2);
        this._beginTransition(next);
      }
    }
    this._aplicarVento();
  }

  _aplicarVento() {
    const kind = this._blend < 1 ? this._nextKind : this.kind;
    const inten = this._blend < 1 ? this._nextIntensity : this.intensity;
    this.vento = calcularVentoGlobal(
      this.cfg,
      this._dayPhase,
      this.cloudCover,
      this.storm,
      kind,
      inten,
      null,
    );
  }

  /** Força kind lógico (debug). */
  setKind(kind) {
    const logico = kindLogicoDe(kind);
    this._beginTransition(logico);
    this._upcoming.length = 0;
    this._fillUpcoming(2);
    this._aplicarVento();
  }

  /**
   * Scroll da previsão: past + now + upcoming.
   * @param {number} minIcons
   */
  getForecastScroll(minIcons = 7) {
    const past = this._historyMax;
    const icons = [];
    for (let i = 0; i < past; i++) {
      icons.push({
        kind: this._history[i] ?? CLIMA_LOGICO.LIMPO,
        intensity: this._historyInt[i] ?? INTENSIDADE.FRACO,
        role: "past",
      });
    }
    icons.push({
      kind: this._blend < 1 ? this._nextKind : this.kind,
      intensity: this._blend < 1 ? this._nextIntensity : this.intensity,
      role: "now",
      blend: this._blend,
    });
    let cur = icons[icons.length - 1].kind;
    const need = Math.max(minIcons, past + 1 + 2);
    let ui = 0;
    while (icons.length < need) {
      const entry = this._upcoming[ui] || this._entrada(pickNext(cur, this._rng, this._opts()));
      icons.push({ kind: entry.kind, intensity: entry.intensity, role: "future" });
      cur = entry.kind;
      ui += 1;
    }
    const holdMax = Math.max(0.001, this._holdMax);
    const holdT = this._blend < 1 ? 0 : 1 - clamp01(this._hold / holdMax);
    const progress = this._blend < 1 ? this._blend * 0.5 : 0.5 + holdT * 0.5;
    return { icons, past, progress, blend: this._blend };
  }

  amostraDisplay(familia) {
    const logico = this._blend < 1 ? this._nextKind : this.kind;
    let display = CLIMA.LIMPO;
    if (logico === CLIMA_LOGICO.NUBLADO) display = CLIMA.NUBLADO;
    else if (logico === CLIMA_LOGICO.PRECIP) display = displayPrecip(familia);
    else if (logico === CLIMA_LOGICO.VENDAVAL) display = CLIMA.VENDAVAL;
    return {
      logicalKind: logico,
      display,
      intensity: this._blend < 1 ? this._nextIntensity : this.intensity,
      cloudCover: this.cloudCover,
      storm: this.storm,
      vento: this.vento,
      familia,
    };
  }
}
