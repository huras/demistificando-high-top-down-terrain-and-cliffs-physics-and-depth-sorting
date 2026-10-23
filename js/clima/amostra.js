/**
 * Amostra de clima no player + API pública.
 */
import { CLIMA_CFG } from "./config.js";
import { BancoFamilias } from "./familias.js";
import { familiaNoMundo } from "./familiaPrecip.js";
import {
  CLIMA,
  CLIMA_LOGICO,
  INTENSIDADE,
  kindLogicoDe,
  nomeClimaDisplay,
  presetCeuDe,
} from "./kinds.js";
import { definirClima, obterHora } from "../render/3d/ceu/controleCeu.js";

const banco = new BancoFamilias(CLIMA_CFG);

/** @type {{ display: string, logicalKind: string, intensity: string, familia: string, preset: string, vento: object, cloudCover: number, storm: number } | null} */
let amostraAtual = null;
let forcarAte = 0;
let forcarPreset = null;

function dayPhaseDeHora(hora) {
  return ((hora / 24) % 1 + 1) % 1;
}

/**
 * @param {number} dt
 * @param {{ x?: number, y?: number, interior?: boolean }} [ctx]
 */
export function tickClima(dt, ctx = {}) {
  if (!CLIMA_CFG.enabled) return obterClimaJogo();
  const agora = performance.now() / 1000;
  const hora = obterHora();
  const phase = dayPhaseDeHora(hora);

  if (!(ctx.interior === true) && Number.isFinite(ctx.x) && Number.isFinite(ctx.y)) {
    banco.syncActive(familiaNoMundo(ctx.x, ctx.y));
  }

  if (agora >= forcarAte) {
    forcarAte = 0;
    forcarPreset = null;
  }
  banco.update(dt, { dayPhase: phase });

  const raw = banco.amostra();
  const display = raw.display;
  const preset = forcarPreset || presetCeuDe(display, raw.familia);
  definirClima(preset);

  amostraAtual = {
    display,
    logicalKind: raw.logicalKind,
    intensity: raw.intensity,
    familia: raw.familia,
    preset,
    vento: raw.vento,
    cloudCover: raw.cloudCover,
    storm: raw.storm,
    nome: nomeClimaDisplay(display),
    forte: raw.intensity === INTENSIDADE.FORTE,
  };
  return amostraAtual;
}

export function obterClimaJogo() {
  if (amostraAtual) return amostraAtual;
  return {
    display: CLIMA.LIMPO,
    logicalKind: CLIMA_LOGICO.LIMPO,
    intensity: INTENSIDADE.FRACO,
    familia: "chuva",
    preset: "limpo",
    vento: { intensidade: 0.42, angulo: 2.6, vx: 0.34, vy: 0.24 },
    cloudCover: 0,
    storm: 0,
    nome: "Limpo",
    forte: false,
  };
}

export function obterVentoMundo() {
  return obterClimaJogo().vento;
}

export function obterForecastScroll(minIcons = 7) {
  return banco.getForecastScroll(minIcons);
}

export function obterBancoClima() {
  return banco;
}

/**
 * Override debug (G / painel). TTL em segundos.
 * @param {string} presetCeu limpo|chuva|areia|nevasca|vendaval
 * @param {number} [seg]
 */
export function forcarClimaPreset(presetCeu, seg = CLIMA_CFG.forcarSeg) {
  forcarPreset = presetCeu;
  forcarAte = performance.now() / 1000 + Math.max(5, seg || 45);
  definirClima(presetCeu);
  const map = {
    limpo: CLIMA_LOGICO.LIMPO,
    chuva: CLIMA_LOGICO.PRECIP,
    areia: CLIMA_LOGICO.PRECIP,
    nevasca: CLIMA_LOGICO.PRECIP,
    vendaval: CLIMA_LOGICO.VENDAVAL,
  };
  banco.setKind(map[presetCeu] || CLIMA_LOGICO.LIMPO);
}

export function iconeClimaDisplay(kindLogico, familia) {
  const logico = kindLogicoDe(kindLogico);
  if (logico === CLIMA_LOGICO.VENDAVAL) return CLIMA.VENDAVAL;
  if (logico === CLIMA_LOGICO.PRECIP) {
    if (familia === "neve") return CLIMA.NEVASCA;
    if (familia === "areia") return CLIMA.AREIA;
    if (familia === "nevoa") return CLIMA.NEVOA;
    return CLIMA.CHUVA;
  }
  if (logico === CLIMA_LOGICO.NUBLADO) return CLIMA.NUBLADO;
  return CLIMA.LIMPO;
}
