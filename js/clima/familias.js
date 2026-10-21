import { CLIMA_CFG } from "./config.js";
import { SistemaClima } from "./ciclo.js";
import { FAMILIA_PRECIP } from "./kinds.js";

export const FAMILIA_CLOCK_IDS = Object.freeze([
  FAMILIA_PRECIP.CHUVA,
  FAMILIA_PRECIP.NEVE,
  FAMILIA_PRECIP.AREIA,
  FAMILIA_PRECIP.NEVOA,
]);

const SEED_OFF = Object.freeze({
  [FAMILIA_PRECIP.CHUVA]: 0,
  [FAMILIA_PRECIP.NEVE]: 0x51,
  [FAMILIA_PRECIP.AREIA]: 0xa3,
  [FAMILIA_PRECIP.NEVOA]: 0xf7,
});

export class BancoFamilias {
  /** @param {object} [cfg] */
  constructor(cfg = {}) {
    this.cfg = { ...CLIMA_CFG, ...cfg };
    this.enabled = this.cfg.enabled !== false;
    /** @type {Record<string, SistemaClima>} */
    this.clocks = {};
    const baseSeed = Number.isFinite(this.cfg.seed) ? this.cfg.seed : 0x57454154;
    for (const id of FAMILIA_CLOCK_IDS) {
      this.clocks[id] = new SistemaClima({
        ...this.cfg,
        seed: (baseSeed ^ (SEED_OFF[id] * 0x10001)) >>> 0,
        wrapPrecipWithGale: id === FAMILIA_PRECIP.AREIA,
      });
    }
    this._activeFamilia = FAMILIA_PRECIP.CHUVA;
  }

  clockFor(familia) {
    return this.clocks[familia] ?? this.clocks[FAMILIA_PRECIP.CHUVA];
  }

  get activeClock() {
    return this.clockFor(this._activeFamilia);
  }

  syncActive(familia) {
    if (FAMILIA_CLOCK_IDS.includes(familia)) this._activeFamilia = familia;
    return this._activeFamilia;
  }

  /** @param {number} dt @param {{ dayPhase?: number }} [opts] */
  update(dt, opts = {}) {
    for (const id of FAMILIA_CLOCK_IDS) this.clocks[id].update(dt, opts);
  }

  getForecastScroll(minIcons = 7) {
    return this.activeClock.getForecastScroll(minIcons);
  }

  amostra() {
    return this.activeClock.amostraDisplay(this._activeFamilia);
  }

  setKind(kind) {
    this.activeClock.setKind(kind);
  }
}
