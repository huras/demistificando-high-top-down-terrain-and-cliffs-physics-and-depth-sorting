/**
 * Layouts relativos. dx/dy = canto NW do item em relação à âncora do sítio.
 */
import {
  CASA_SITE,
  MODELO_CASA_SITE,
  PROP_SITE,
  TIPO_SITE,
} from "./catalogo.js";

function casa(dx, dy, modelo) {
  return Object.freeze({
    dx,
    dy,
    cols: CASA_SITE.cols,
    rows: CASA_SITE.rows,
    modelo,
  });
}

function prop(propId, dx, dy) {
  return Object.freeze({ propId, dx, dy });
}

export const TEMPLATES_SITE = Object.freeze({
  fazenda: Object.freeze({
    id: "fazenda",
    tipo: TIPO_SITE.FAZENDA,
    biomas: Object.freeze(["terra"]),
    limpaVeg: 1,
    largura: 16,
    altura: 12,
    edificios: Object.freeze([
      casa(0, 0, MODELO_CASA_SITE.palha),
      casa(6, 0, MODELO_CASA_SITE.cinza),
      casa(12, 0, MODELO_CASA_SITE.branca),
    ]),
    props: Object.freeze([
      prop(PROP_SITE.poco, 2, 7),
      prop(PROP_SITE.carroca, 8, 7),
      prop(PROP_SITE.fenoGrande, 12, 7),
      prop(PROP_SITE.fenoMedio, 14, 9),
      prop(PROP_SITE.sacos, 0, 7),
      prop(PROP_SITE.lampiao, 5, 6),
      prop(PROP_SITE.plantacao, 6, 9),
      prop(PROP_SITE.plantacao, 7.2, 9),
      prop(PROP_SITE.plantacao, 8.4, 9),
      prop(PROP_SITE.plantacao, 6, 10.2),
      prop(PROP_SITE.plantacao, 7.2, 10.2),
      prop(PROP_SITE.plantacao, 8.4, 10.2),
    ]),
  }),

  cemiterio: Object.freeze({
    id: "cemiterio",
    tipo: TIPO_SITE.CEMITERIO,
    biomas: Object.freeze(["terra", "floresta"]),
    limpaVeg: 2,
    largura: 28,
    altura: 24,
    edificios: Object.freeze([
      casa(2, 0, MODELO_CASA_SITE.cinza),
      casa(22, 0, MODELO_CASA_SITE.branca),
    ]),
    labirintoLapides: true,
    labirintoDx: 1,
    labirintoDy: 6,
    labirintoCols: 13,
    labirintoRows: 9,
    labirintoPasso: 2,
    lootMin: 2,
    lootMax: 3,
    props: Object.freeze([]),
  }),

  posto: Object.freeze({
    id: "posto",
    tipo: TIPO_SITE.POSTO,
    biomas: Object.freeze(["terra", "floresta"]),
    limpaVeg: 1,
    largura: 16,
    altura: 8,
    edificios: Object.freeze([
      casa(0, 0, MODELO_CASA_SITE.madeira),
      casa(8, 0, MODELO_CASA_SITE.cinza),
    ]),
    props: Object.freeze([
      prop(PROP_SITE.lampiao, 6, 2),
      prop(PROP_SITE.sacos, 5, 6),
      prop(PROP_SITE.toras, 14, 6),
      prop(PROP_SITE.fenoPequeno, 0, 6),
    ]),
  }),

  doca: Object.freeze({
    id: "doca",
    tipo: TIPO_SITE.DOCA,
    biomas: Object.freeze(["agua", "terra"]),
    limpaVeg: 1,
    largura: 14,
    altura: 14,
    edificios: Object.freeze([
      casa(0, 0, MODELO_CASA_SITE.farol),
      casa(9, 7, MODELO_CASA_SITE.cinza),
    ]),
    props: Object.freeze([
      prop(PROP_SITE.toras, 8, 12),
      prop(PROP_SITE.lampiao, 10, 5),
      prop(PROP_SITE.sacos, 12, 12),
      prop(PROP_SITE.carroca, 9, 13),
    ]),
  }),

  mirante: Object.freeze({
    id: "mirante",
    tipo: TIPO_SITE.MIRANTE,
    biomas: Object.freeze(["montanha"]),
    limpaVeg: 1,
    largura: 16,
    altura: 10,
    edificios: Object.freeze([
      casa(0, 0, MODELO_CASA_SITE.cabana),
      casa(9, 1, MODELO_CASA_SITE.madeira),
    ]),
    props: Object.freeze([
      prop(PROP_SITE.toras, 7, 8),
      prop(PROP_SITE.toras, 14, 7),
      prop(PROP_SITE.lampiao, 8, 6),
      prop(PROP_SITE.fenoPequeno, 0, 8),
    ]),
  }),
});

export const LISTA_TEMPLATES = Object.freeze(Object.values(TEMPLATES_SITE));

/**
 * @param {string} bioma terra|agua|montanha|floresta
 * @returns {readonly object[]}
 */
export function templatesDoBioma(bioma) {
  const chave = String(bioma || "terra");
  return LISTA_TEMPLATES.filter((t) => t.biomas.includes(chave));
}
