/**
 * Catálogo dos sítios outdoor (farm, cemitério, posto, doca, mirante).
 * IDs estáveis — o plano mundial e os templates apontam pra cá.
 */

export const TIPO_SITE = Object.freeze({
  FAZENDA: "farm",
  CEMITERIO: "graveyard",
  POSTO: "outpost",
  DOCA: "dock",
  MIRANTE: "lookout",
});

export const PROP_SITE = Object.freeze({
  fenoGrande: "fenoGrande",
  fenoMedio: "fenoMedio",
  fenoPequeno: "fenoPequeno",
  carroca: "carroca",
  poco: "poco",
  lampiao: "lampiao",
  toras: "toras",
  sacos: "sacos",
  plantacao: "plantacao",
  lapideLimpa: "lapideLimpa",
  lapideMusgo: "lapideMusgo",
  lapideRachada: "lapideRachada",
});

/** Chave de recorte em assets/props/sites/recortes.json. */
export const RECORTE_DO_PROP = Object.freeze({
  [PROP_SITE.fenoGrande]: "big-hay-stack-a",
  [PROP_SITE.fenoMedio]: "medium-hay-stack-a",
  [PROP_SITE.fenoPequeno]: "small-hay-stack-a",
  [PROP_SITE.carroca]: "wooden-cart-to-the-left",
  [PROP_SITE.poco]: "poço-de-agua-com-telhado",
  [PROP_SITE.lampiao]: "farm-lamp-to-the-right",
  [PROP_SITE.toras]: "3-wooden-log-stack",
  [PROP_SITE.sacos]: "4-sacos-de-farm-produce-stacked",
  [PROP_SITE.plantacao]: "mature-planted-cabage",
  [PROP_SITE.lapideLimpa]: "lapide-clean",
  [PROP_SITE.lapideMusgo]: "lapide-mossy",
  [PROP_SITE.lapideRachada]: "lapide-mossy-cracked",
});

export const LAPIDES = Object.freeze([
  PROP_SITE.lapideMusgo,
  PROP_SITE.lapideLimpa,
  PROP_SITE.lapideRachada,
]);

/** Pegada padrão de casa outdoor (células). */
export const CASA_SITE = Object.freeze({ cols: 6, rows: 5 });

/** Modelos 3D reaproveitados do hub (catalogoCasas). */
export const MODELO_CASA_SITE = Object.freeze({
  palha: "casa-bark",
  cinza: "casa-amigo",
  branca: "casa-cherry",
  madeira: "casa-guia",
  cabana: "casa-bark",
  farol: "ruina",
});

/** Raio de colisão dos props (fallback se o recorte não informar). */
export const RAIO_PROP_SITE = Object.freeze({
  [PROP_SITE.fenoGrande]: 0.55,
  [PROP_SITE.fenoMedio]: 0.45,
  [PROP_SITE.fenoPequeno]: 0.28,
  [PROP_SITE.carroca]: 0.55,
  [PROP_SITE.poco]: 0.7,
  [PROP_SITE.lampiao]: 0.22,
  [PROP_SITE.toras]: 0.4,
  [PROP_SITE.sacos]: 0.35,
  [PROP_SITE.plantacao]: 0.2,
  [PROP_SITE.lapideLimpa]: 0.32,
  [PROP_SITE.lapideMusgo]: 0.32,
  [PROP_SITE.lapideRachada]: 0.32,
});

export function raioDoPropSite(propId) {
  return RAIO_PROP_SITE[propId] ?? 0.35;
}

export function lapideDoSlot(slot = 0) {
  const i = Math.abs(slot | 0);
  return LAPIDES[i % LAPIDES.length];
}

/** Anéis Chebyshev do avental (degraus) ao redor do pad. */
export const SITE_AVENTAL = 3;
export const SITE_AVENTAL_MONTANHA = 6;

/** Desnível máx. (blocos) aceito na amostragem natural do pad. */
export const SITE_DESNIVEL = 4;
export const SITE_DESNIVEL_CEMITERIO = 5;
export const SITE_DESNIVEL_MIRANTE = 6;
