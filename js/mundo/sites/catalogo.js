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
  // toras → modelo 3D HGSS (MODELO_PROP_SITE); recorte só fallback/atlas.
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

/** Modelos 3D reaproveitados do hub + HGSS da fazenda (catalogoCasas). */
export const MODELO_CASA_SITE = Object.freeze({
  palha: "casa-bark",
  cinza: "casa-amigo",
  branca: "casa-cherry",
  madeira: "casa-guia",
  cabana: "casa-bark",
  farol: "glitter-lighthouse",
  moomoo: "moomoo-farm",
  dayCare: "pokemon-day-care",
  silo: "moomoo-farm-silo",
  moinho1: "windmill-1",
  moinho2: "windmill-1",
});

/**
 * Pegada/escala por modelo de sítio (células no chão + alvo do molde).
 * Sem entrada → CASA_SITE / lote 6×5 padrão.
 */
export const PEGADA_MODELO_SITE = Object.freeze({
  "moomoo-farm": Object.freeze({ cols: 9, rows: 6, ladoX: 9, ladoZ: 6 }),
  "pokemon-day-care": Object.freeze({ cols: 7, rows: 6, ladoX: 7, ladoZ: 6 }),
  "moomoo-farm-silo": Object.freeze({ cols: 4, rows: 4, ladoX: 3.6, ladoZ: 3.6 }),
  "windmill-1": Object.freeze({ cols: 4, rows: 4, ladoX: 3.2, ladoZ: 3.2 }),
  "glitter-lighthouse": Object.freeze({ cols: 8, rows: 8, ladoX: 7.2, ladoZ: 7.2 }),
});

/** Modelos HGSS com textura própria — sem tint procedural. */
export const MODELO_SITE_SEM_TINT = new Set([
  "moomoo-farm",
  "pokemon-day-care",
  "moomoo-farm-silo",
  "windmill-1",
  "logs",
  "glitter-lighthouse",
]);

/** Decoração / landmark — sem interior jogável. */
export const MODELO_SITE_SEM_ENTRADA = new Set([
  "moomoo-farm-silo",
  "windmill-1",
]);

export function pegadaDoModeloSite(modelo) {
  return PEGADA_MODELO_SITE[modelo] || null;
}

/** Casa/fazenda/farol de sítio com porta de entrada. */
export function modeloSiteEntravel(modelo) {
  return !!modelo && !MODELO_SITE_SEM_ENTRADA.has(modelo);
}

/** Props de sítio com malha 3D (sem billboard). propId → id em catalogoCasas. */
export const MODELO_PROP_SITE = Object.freeze({
  [PROP_SITE.toras]: "logs",
  /** Mesmo poste + luz noturna das cidades. */
  [PROP_SITE.lampiao]: "poste",
});

export const PEGADA_PROP_SITE = Object.freeze({
  logs: Object.freeze({ ladoX: 2.4, ladoZ: 2.2 }),
});

export function modeloDoPropSite(propId) {
  return MODELO_PROP_SITE[propId] || null;
}

export function pegadaDoPropSite(modeloId) {
  return PEGADA_PROP_SITE[modeloId] || null;
}

/** Raio de colisão dos props (fallback se o recorte não informar). */
export const RAIO_PROP_SITE = Object.freeze({
  [PROP_SITE.fenoGrande]: 0.55,
  [PROP_SITE.fenoMedio]: 0.45,
  [PROP_SITE.fenoPequeno]: 0.28,
  [PROP_SITE.carroca]: 0.55,
  [PROP_SITE.poco]: 0.7,
  [PROP_SITE.lampiao]: 0.22,
  [PROP_SITE.toras]: 0.65,
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
