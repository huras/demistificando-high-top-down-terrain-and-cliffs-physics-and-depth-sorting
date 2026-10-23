/** Kinds de display, lógicos e famílias de precipitação. */

export const CLIMA = Object.freeze({
  LIMPO: "limpo",
  NUBLADO: "nublado",
  CHUVA: "chuva",
  NEVASCA: "nevasca",
  AREIA: "areia",
  NEVOA: "nevoa",
  VENDAVAL: "vendaval",
});

export const CLIMA_LOGICO = Object.freeze({
  LIMPO: "limpo",
  NUBLADO: "nublado",
  PRECIP: "precip",
  VENDAVAL: "vendaval",
});

export const FAMILIA_PRECIP = Object.freeze({
  CHUVA: "chuva",
  NEVE: "neve",
  AREIA: "areia",
  NEVOA: "nevoa",
});

export const INTENSIDADE = Object.freeze({
  FRACO: "fraco",
  FORTE: "forte",
});

export function kindLogicoDe(kind) {
  if (
    kind === CLIMA.CHUVA ||
    kind === CLIMA.NEVASCA ||
    kind === CLIMA.AREIA ||
    kind === CLIMA.NEVOA ||
    kind === CLIMA_LOGICO.PRECIP
  ) {
    return CLIMA_LOGICO.PRECIP;
  }
  if (kind === CLIMA.VENDAVAL || kind === CLIMA_LOGICO.VENDAVAL) {
    return CLIMA_LOGICO.VENDAVAL;
  }
  if (kind === CLIMA.NUBLADO || kind === CLIMA_LOGICO.NUBLADO) {
    return CLIMA_LOGICO.NUBLADO;
  }
  return CLIMA_LOGICO.LIMPO;
}

/** Display de precip pela família ativa. */
export function displayPrecip(familia) {
  if (familia === FAMILIA_PRECIP.NEVE) return CLIMA.NEVASCA;
  if (familia === FAMILIA_PRECIP.AREIA) return CLIMA.AREIA;
  if (familia === FAMILIA_PRECIP.NEVOA) return CLIMA.NEVOA;
  return CLIMA.CHUVA;
}

/** Preset GPU do céu 3D a partir do display. */
export function presetCeuDe(display, familia) {
  // Vendaval = gales (ribbons), sem partículas de areia/chuva/neve.
  if (display === CLIMA.VENDAVAL) return "vendaval";
  if (display === CLIMA.NEVASCA) return "nevasca";
  if (display === CLIMA.AREIA) return "areia";
  if (display === CLIMA.CHUVA) return "chuva";
  if (display === CLIMA.NEVOA) return "limpo";
  return "limpo";
}

export function nomeClimaDisplay(display) {
  const map = {
    [CLIMA.LIMPO]: "Limpo",
    [CLIMA.NUBLADO]: "Nublado",
    [CLIMA.CHUVA]: "Chuva",
    [CLIMA.NEVASCA]: "Neve",
    [CLIMA.AREIA]: "Areia",
    [CLIMA.NEVOA]: "Névoa",
    [CLIMA.VENDAVAL]: "Vendaval",
  };
  return map[display] || display;
}
