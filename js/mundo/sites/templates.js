/**
 * Layouts relativos. dx/dy = canto NW do item em relação à âncora do sítio.
 */
import {
  CASA_SITE,
  MODELO_CASA_SITE,
  PROP_SITE,
  TIPO_SITE,
  pegadaDoModeloSite,
} from "./catalogo.js";

function casa(dx, dy, modelo, opts = null) {
  const pegada = pegadaDoModeloSite(modelo);
  return Object.freeze({
    dx,
    dy,
    cols: opts?.cols ?? pegada?.cols ?? CASA_SITE.cols,
    rows: opts?.rows ?? pegada?.rows ?? CASA_SITE.rows,
    modelo,
  });
}

function prop(propId, dx, dy) {
  return Object.freeze({ propId, dx, dy });
}

/** Grade de plantação (passo ~1.2) no retângulo incluso. */
function plantacaoGrade(x0, y0, cols, rows, passo = 1.2) {
  const lista = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      lista.push(prop(PROP_SITE.plantacao, x0 + c * passo, y0 + r * passo));
    }
  }
  return lista;
}

/** Células de chão arado sob a grade (margem pequena além do último pé). */
function canteiroDeGrade(x0, y0, cols, rows, passo = 1.15) {
  const dx = Math.floor(x0 - 0.2);
  const dy = Math.floor(y0 - 0.2);
  const x1 = Math.ceil(x0 + (cols - 1) * passo + 0.9);
  const y1 = Math.ceil(y0 + (rows - 1) * passo + 0.9);
  return Object.freeze({ dx, dy, cols: x1 - dx, rows: y1 - dy });
}

export const TEMPLATES_SITE = Object.freeze({
  fazenda: Object.freeze({
    id: "fazenda",
    tipo: TIPO_SITE.FAZENDA,
    biomas: Object.freeze(["terra"]),
    limpaVeg: 2,
    largura: 32,
    altura: 24,
    edificios: Object.freeze([
      // Fileira norte: Day Care + MooMoo Farm + silo
      casa(1, 1, MODELO_CASA_SITE.dayCare),
      casa(11, 1, MODELO_CASA_SITE.moomoo),
      casa(23, 1, MODELO_CASA_SITE.silo),
      // Moinhos nos flancos do pasto
      casa(1, 14, MODELO_CASA_SITE.moinho1),
      casa(27, 12, MODELO_CASA_SITE.moinho2),
    ]),
    props: Object.freeze([
      prop(PROP_SITE.poco, 9, 9),
      prop(PROP_SITE.lampiao, 10, 8),
      prop(PROP_SITE.lampiao, 20, 8),
      prop(PROP_SITE.carroca, 21, 10),
      prop(PROP_SITE.fenoGrande, 22, 14),
      prop(PROP_SITE.fenoGrande, 25, 16),
      prop(PROP_SITE.fenoMedio, 20, 16),
      prop(PROP_SITE.fenoPequeno, 18, 15),
      prop(PROP_SITE.sacos, 19, 9),
      prop(PROP_SITE.sacos, 8, 10),
      prop(PROP_SITE.toras, 6, 16),
      ...plantacaoGrade(8, 17, 6, 4, 1.15),
      ...plantacaoGrade(16, 18, 4, 3, 1.15),
    ]),
    canteiros: Object.freeze([
      canteiroDeGrade(8, 17, 6, 4, 1.15),
      canteiroDeGrade(16, 18, 4, 3, 1.15),
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
