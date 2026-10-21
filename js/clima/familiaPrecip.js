import { FAMILIA_PRECIP } from "./kinds.js";
import { biomaDominante, biomaPorId } from "../mundo/bioma/catalogo.js";
import { areaLogicaNoMundo } from "../mundo/bioma/areasMundo.js";
import { dentroDoKanto } from "../mundo/bounds.js";

function familiaPadrao(biomeId) {
  if (!biomeId || typeof biomeId !== "string") return FAMILIA_PRECIP.CHUVA;
  if (biomeId === "snow" || biomeId === "tundra") return FAMILIA_PRECIP.NEVE;
  if (
    biomeId === "dirty-sand" ||
    biomeId.includes("desert") ||
    biomeId.includes("sand") ||
    biomeId === "amber-rock" ||
    biomeId === "faroeste-desert"
  ) {
    return FAMILIA_PRECIP.AREIA;
  }
  if (
    biomeId.includes("ghost") ||
    biomeId.includes("rift") ||
    biomeId.includes("swamp") ||
    biomeId.includes("marsh")
  ) {
    return FAMILIA_PRECIP.NEVOA;
  }
  return FAMILIA_PRECIP.CHUVA;
}

const TAG_OK = new Set([
  FAMILIA_PRECIP.CHUVA,
  FAMILIA_PRECIP.NEVE,
  FAMILIA_PRECIP.AREIA,
  FAMILIA_PRECIP.NEVOA,
  "rain",
  "snow",
  "sand",
  "fog",
]);

function normalizarTag(tag) {
  if (tag === "rain") return FAMILIA_PRECIP.CHUVA;
  if (tag === "snow") return FAMILIA_PRECIP.NEVE;
  if (tag === "sand") return FAMILIA_PRECIP.AREIA;
  if (tag === "fog") return FAMILIA_PRECIP.NEVOA;
  return tag;
}

/** Família de precip do bioma (tag `precip` opcional no JSON). */
export function familiaPrecipitacao(biomeId) {
  const id = typeof biomeId === "string" ? biomeId : biomeId?.id;
  const def = biomaPorId(id);
  const tag = def?.precip;
  if (tag && TAG_OK.has(tag)) return normalizarTag(tag);
  return familiaPadrao(id);
}

export function familiaNoMundo(wx, wy) {
  // Exterior: clima da área lógica. Interior Kanto: bioma visual.
  if (!dentroDoKanto(wx, wy)) {
    const area = areaLogicaNoMundo(wx, wy);
    if (area?.precip && TAG_OK.has(area.precip)) return normalizarTag(area.precip);
  }
  const bioma = biomaDominante(wx, wy);
  return familiaPrecipitacao(bioma?.id);
}
