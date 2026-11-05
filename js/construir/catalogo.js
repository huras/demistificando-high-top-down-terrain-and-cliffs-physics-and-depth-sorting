/**
 * Catálogo de construção: casas (modelos 3D do destino), móveis, cercas.
 */
import { MOVEIS } from "../wild/catalogo.js";
import {
  CASA_SITE,
  MODELO_CASA_SITE,
  pegadaDoModeloSite,
} from "../mundo/sites/catalogo.js";
import { listarIdsCasaJogador } from "./modelosCasa.js";
import { custosDoRecipe, podePagar, gastarCusto, reembolsarCusto } from "./custos.js";
import {
  FENCE_CATALOG_ID,
  FENCE_KIND,
  receitaCercaPorId,
} from "./cerca/tipos.js";

export const TIPO_CONSTRUIR = Object.freeze({
  CASA: "house",
  MOVEL: "furniture",
  CERCA: "fence",
});

export const SUB_CASA = Object.freeze({
  CIDADE: "city",
  SITE: "site",
});

export const SUB_CASA_ORDEM = Object.freeze([SUB_CASA.CIDADE, SUB_CASA.SITE]);

export const SUB_MOVEL = Object.freeze({
  CAMAS: "beds",
  MESAS: "tables",
  ASSENTOS: "seating",
  DECOR: "decor",
  CRAFT: "machines",
  OUTRO: "other",
});

export const SUB_MOVEL_ORDEM = Object.freeze([
  SUB_MOVEL.CAMAS,
  SUB_MOVEL.ASSENTOS,
  SUB_MOVEL.MESAS,
  SUB_MOVEL.CRAFT,
  SUB_MOVEL.DECOR,
  SUB_MOVEL.OUTRO,
]);

const CUSTO_CASA_PADRAO = Object.freeze({ wood: 60, stone: 20 });

const CUSTO_CASA_POR_ID = Object.freeze({
  "moomoo-farm": Object.freeze({ wood: 90, stone: 30, plantFiber: 20 }),
  "pokemon-day-care": Object.freeze({ wood: 80, stone: 40 }),
  "moomoo-farm-silo": Object.freeze({ wood: 40, stone: 50 }),
  "windmill-1": Object.freeze({ wood: 50, stone: 25, plantFiber: 15 }),
  ruina: Object.freeze({ wood: 30, stone: 80 }),
});

const SITE_IDS = Object.freeze([
  ...new Set(Object.values(MODELO_CASA_SITE)),
]);

/**
 * @param {string} buildingId
 */
export function pegadaCasa(buildingId) {
  const esp = pegadaDoModeloSite(buildingId);
  if (esp) return { cols: esp.cols | 0, rows: esp.rows | 0 };
  return { cols: CASA_SITE.cols, rows: CASA_SITE.rows };
}

/**
 * @param {string} buildingId
 */
export function subCasaDe(buildingId) {
  if (SITE_IDS.includes(buildingId)) return SUB_CASA.SITE;
  return SUB_CASA.CIDADE;
}

function receitaCasa(buildingId) {
  const fp = pegadaCasa(buildingId);
  const costs = CUSTO_CASA_POR_ID[buildingId] || CUSTO_CASA_PADRAO;
  return {
    kind: TIPO_CONSTRUIR.CASA,
    id: buildingId,
    buildingId,
    label: buildingId,
    cols: fp.cols,
    rows: fp.rows,
    floors: 1,
    enterable: !["moomoo-farm-silo", "windmill-1", "ruina"].includes(buildingId),
    costs: { ...costs },
  };
}

function subMovelDe(key) {
  if (key === "cama") return SUB_MOVEL.CAMAS;
  if (key === "cadeira") return SUB_MOVEL.ASSENTOS;
  if (key === "mesa") return SUB_MOVEL.MESAS;
  if (key === "bancada" || key === "maquinaCura" || key === "pc") return SUB_MOVEL.CRAFT;
  if (key === "planta") return SUB_MOVEL.DECOR;
  return SUB_MOVEL.OUTRO;
}

function receitaMovel(key) {
  const def = MOVEIS[key];
  if (!def) return null;
  return {
    kind: TIPO_CONSTRUIR.MOVEL,
    id: key,
    label: def.nome,
    cols: 1,
    rows: 1,
    costs: { ...(def.custo || { wood: 2 }) },
    indoor: true,
    outdoor: !def.indoorOnly,
    wall: false,
    cura: !!def.cura,
    craft: !!def.craft,
    maquinaCura: !!def.maquinaCura,
    pc: !!def.pc,
  };
}

function receitaCerca(id) {
  const base = receitaCercaPorId(id);
  if (!base) return null;
  return {
    kind: TIPO_CONSTRUIR.CERCA,
    id,
    label: id === FENCE_CATALOG_ID.GATE ? "Portão" : "Cerca",
    cols: 1,
    rows: 1,
    fenceKind: id === FENCE_CATALOG_ID.GATE ? FENCE_KIND.GATE : FENCE_KIND.SEGMENT,
    costs: { ...base },
  };
}

/**
 * @param {string} kind
 * @param {string} id
 */
export function receitaConstruir(kind, id) {
  if (kind === TIPO_CONSTRUIR.CASA) return receitaCasa(id);
  if (kind === TIPO_CONSTRUIR.MOVEL) return receitaMovel(id);
  if (kind === TIPO_CONSTRUIR.CERCA) return receitaCerca(id);
  return null;
}

export function listarCasasConstruiveis(sub) {
  const ids = listarIdsCasaJogador();
  const out = [];
  for (const id of ids) {
    if (sub && subCasaDe(id) !== sub) continue;
    out.push(receitaCasa(id));
  }
  return out;
}

export function listarMoveisConstruiveis(sub) {
  const out = [];
  for (const key of Object.keys(MOVEIS)) {
    if (sub && subMovelDe(key) !== sub) continue;
    const r = receitaMovel(key);
    // Catálogo outdoor: só o que pode no campo (cura/PC/bancada são indoor).
    if (r && r.outdoor !== false) out.push(r);
  }
  return out;
}

export function listarCercasConstruiveis() {
  return [
    receitaCerca(FENCE_CATALOG_ID.SEGMENT),
    receitaCerca(FENCE_CATALOG_ID.GATE),
  ].filter(Boolean);
}

export function listarSubcasas() {
  return SUB_CASA_ORDEM.slice();
}

export function listarSubmoveis() {
  return SUB_MOVEL_ORDEM.slice();
}

export function ehMovelParede(id) {
  return false;
}

export {
  custosDoRecipe,
  podePagar,
  gastarCusto,
  reembolsarCusto,
};
