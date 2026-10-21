import * as THREE from "three";
import { obterClimaJogo } from "../../../clima/amostra.js";
import { obterClima } from "./controleCeu.js";

/**
 * Alvo de cada clima. A mistura é contínua pra não estourar exposição nem fog.
 * sol: multiplicador da luz do dia. limiar baixo = céu mais fechado.
 */
export const PRESETS = {
  limpo: {
    limiar: 0.58,
    forcaSombra: 0.62,
    vento: 3.4,
    sol: 1,
    umidade: 0,
    chuva: 0,
    areia: 0,
    neve: 0,
    raio: 0,
    neblinaPerto: 1,
    neblinaLonge: 1,
    pesoNeblina: 0,
    pesoZenite: 0,
    neblina: 0x9eb0b8,
  },
  chuva: {
    limiar: 0.18,
    forcaSombra: 0.8,
    vento: 13,
    sol: 0.32,
    umidade: 0.78,
    chuva: 1,
    areia: 0,
    neve: 0,
    raio: 1,
    neblinaPerto: 0.55,
    neblinaLonge: 0.5,
    pesoNeblina: 0.78,
    pesoZenite: 0.36,
    neblina: 0x5a6570,
  },
  areia: {
    limiar: 0.62,
    forcaSombra: 0.28,
    vento: 26,
    sol: 0.48,
    umidade: 0,
    chuva: 0,
    areia: 1,
    neve: 0,
    raio: 0.22,
    neblinaPerto: 0.28,
    neblinaLonge: 0.34,
    pesoNeblina: 0.9,
    pesoZenite: 0.55,
    neblina: 0xc48848,
  },
  nevasca: {
    limiar: 0.26,
    forcaSombra: 0.66,
    vento: 16,
    sol: 0.4,
    umidade: 0,
    chuva: 0,
    areia: 0,
    neve: 1,
    raio: 0.08,
    neblinaPerto: 0.38,
    neblinaLonge: 0.4,
    pesoNeblina: 0.7,
    pesoZenite: 0.28,
    neblina: 0xd5dee8,
  },
};

const CAMPOS = [
  "limiar",
  "forcaSombra",
  "vento",
  "sol",
  "umidade",
  "chuva",
  "areia",
  "neve",
  "raio",
  "neblinaPerto",
  "neblinaLonge",
  "pesoNeblina",
  "pesoZenite",
];

const atual = {
  ...PRESETS.limpo,
  neblina: new THREE.Color(PRESETS.limpo.neblina).convertSRGBToLinear(),
};
const corAlvo = new THREE.Color();

/** Mistura já integrada. O áudio lê daqui sem dar outro passo. */
export function lerMixClima() {
  return { chuva: atual.chuva, raio: atual.raio };
}

/** Integra o preset escolhido. Chamar uma vez por frame. */
export function avaliarClima(dt) {
  const preset = PRESETS[obterClima()] || PRESETS.limpo;
  const jogo = obterClimaJogo();
  const nevoaFamilia =
    jogo?.familia === "nevoa" &&
    (jogo.display === "nevoa" || jogo.logicalKind === "precip" || jogo.display === "nublado");
  const k = dt > 0 ? 1 - Math.exp(-dt / 3.4) : 1;
  for (let i = 0; i < CAMPOS.length; i++) {
    const campo = CAMPOS[i];
    let alvo = preset[campo];
    if (nevoaFamilia) {
      if (campo === "pesoNeblina") alvo = Math.max(alvo, 0.62);
      else if (campo === "neblinaPerto") alvo = Math.min(alvo, 0.72);
      else if (campo === "neblinaLonge") alvo = Math.min(alvo, 0.68);
      else if (campo === "pesoZenite") alvo = Math.max(alvo, 0.22);
      else if (campo === "sol") alvo = Math.min(alvo, 0.72);
    }
    atual[campo] += (alvo - atual[campo]) * k;
  }
  corAlvo.setHex(nevoaFamilia ? 0xa8b4bc : preset.neblina).convertSRGBToLinear();
  atual.neblina.lerp(corAlvo, k);
  return atual;
}
