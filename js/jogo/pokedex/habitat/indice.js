/**
 * Índice espécie → locais de encontro.
 * Rebuild único quando a distribuição de bioma está pronta.
 */

import { AREAS_MUNDO } from "../../../mundo/bioma/areasMundo.js";
import { idsDeKit, obterKit } from "../../../mundo/bioma/kits.js";
import { ORIGEM_KANTO_X, ORIGEM_KANTO_Y } from "../../../mundo/bounds.js";
import { amostraKanto } from "../../../mundo/regiao/amostraKanto.js";
import { BIOMA_KANTO } from "../../../mundo/regiao/biomasKanto.js";
import {
  AREA_KANTO,
  CENTRO_AREA,
  LADO_KANTO,
  zonaEm,
} from "../../../mundo/regiao/grafoKanto.js";
import { distribuicaoPronta, poolDoBioma } from "../../../pokemon/distribuicao/indice.js";
import { findShrineSlotForSpecies } from "../../../santuario/colocacao.js";
import { nomeTemplo } from "../../../santuario/nomes.js";

/** @typedef {'casa' | 'extra' | 'santuario'} PapelHabitat */

/**
 * @typedef {Object} LocalHabitat
 * @property {string} id
 * @property {string} nome
 * @property {PapelHabitat} papel
 * @property {string | null} biomaId
 * @property {number | null} wx
 * @property {number | null} wy
 */

const ORDEM_PAPEL = Object.freeze({ casa: 0, extra: 1, santuario: 2 });
const PESO_CASA = 3;
const PESO_EXTRA = 1;

/** @type {Map<string, LocalHabitat[]> | null} */
let porEspecie = null;
/** @type {Map<string, Map<string, number>> | null} */
let porBiomaPeso = null;
let geracao = 0;

const MAPA_VAZIO = new Map();

function rotuloBioma(id) {
  const kit = obterKit(id);
  if (kit?.nome) return kit.nome;
  if (kit?.label) return kit.label;
  return String(id || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function compararLocais(a, b) {
  const d = ORDEM_PAPEL[a.papel] - ORDEM_PAPEL[b.papel];
  if (d) return d;
  return a.nome.localeCompare(b.nome, "pt-BR");
}

function chavesDoPool(lista) {
  const saida = [];
  if (!lista) return saida;
  for (let i = 0; i < lista.length; i++) {
    const item = lista[i];
    const chave = typeof item === "string" ? item : item?.key || item?.species || "";
    if (chave) saida.push(chave);
  }
  return saida;
}

/**
 * @param {Map<string, Map<string, LocalHabitat>>} mapa
 * @param {string} especie
 * @param {LocalHabitat} local
 */
function registrarLocal(mapa, especie, local) {
  let locais = mapa.get(especie);
  if (!locais) {
    locais = new Map();
    mapa.set(especie, locais);
  }
  const prev = locais.get(local.id);
  if (!prev) {
    locais.set(local.id, local);
    return;
  }
  if (ORDEM_PAPEL[local.papel] < ORDEM_PAPEL[prev.papel]) prev.papel = local.papel;
  if (!prev.biomaId && local.biomaId) prev.biomaId = local.biomaId;
}

function registrarPool(mapa, biomaId, idLocal, nome) {
  const pool = poolDoBioma(biomaId);
  const casa = chavesDoPool(pool.casa);
  const extras = chavesDoPool(pool.extras);
  for (let i = 0; i < casa.length; i++) {
    registrarLocal(mapa, casa[i], {
      id: idLocal,
      nome,
      papel: "casa",
      biomaId,
      wx: null,
      wy: null,
    });
  }
  for (let i = 0; i < extras.length; i++) {
    registrarLocal(mapa, extras[i], {
      id: idLocal,
      nome,
      papel: "extra",
      biomaId,
      wx: null,
      wy: null,
    });
  }
}

function registrarPeso(mapa, especie, biomaId, peso) {
  let pesos = mapa.get(especie);
  if (!pesos) {
    pesos = new Map();
    mapa.set(especie, pesos);
  }
  const prev = pesos.get(biomaId) || 0;
  if (peso > prev) pesos.set(biomaId, peso);
}

function idsBiomaConhecidos() {
  const ids = new Set();
  for (let i = 0; i < AREAS_MUNDO.length; i++) {
    const area = AREAS_MUNDO[i];
    if (area.encontro) ids.add(area.encontro);
    const paleta = area.paleta || [];
    for (let p = 0; p < paleta.length; p++) ids.add(paleta[p]);
  }
  const kanto = Object.values(BIOMA_KANTO);
  for (let i = 0; i < kanto.length; i++) {
    if (kanto[i]?.id) ids.add(kanto[i].id);
  }
  const kits = idsDeKit();
  for (let i = 0; i < kits.length; i++) ids.add(kits[i]);
  return ids;
}

function reconstruir() {
  /** @type {Map<string, Map<string, LocalHabitat>>} */
  const locais = new Map();
  /** @type {Map<string, Map<string, number>>} */
  const pesos = new Map();
  const biomasComLocal = new Set();

  for (let i = 0; i < AREAS_MUNDO.length; i++) {
    const area = AREAS_MUNDO[i];
    if (!area.encontro) continue;
    registrarPool(locais, area.encontro, area.id, area.nome);
    biomasComLocal.add(area.encontro);
  }

  for (let ay = 0; ay < LADO_KANTO; ay++) {
    for (let ax = 0; ax < LADO_KANTO; ax++) {
      const zona = zonaEm(ax, ay);
      if (!zona || zona.tipo === "cidade") continue;
      const wx = ORIGEM_KANTO_X + ax * AREA_KANTO + CENTRO_AREA;
      const wy = ORIGEM_KANTO_Y + ay * AREA_KANTO + CENTRO_AREA;
      const biomaId = amostraKanto(wx, wy)?.bioma?.id || "light-grass";
      const generico = !zona.nome || zona.nome === "Mato";
      const id = generico ? `kanto-bioma:${biomaId}` : `kanto:${zona.nome}`;
      const nome = generico ? rotuloBioma(biomaId) : zona.nome;
      registrarPool(locais, biomaId, id, nome);
      biomasComLocal.add(biomaId);
    }
  }

  const ids = idsBiomaConhecidos();
  for (const id of ids) {
    const pool = poolDoBioma(id);
    const casa = chavesDoPool(pool.casa);
    const extras = chavesDoPool(pool.extras);
    for (let i = 0; i < casa.length; i++) registrarPeso(pesos, casa[i], id, PESO_CASA);
    for (let i = 0; i < extras.length; i++) registrarPeso(pesos, extras[i], id, PESO_EXTRA);
    if (biomasComLocal.has(id)) continue;
    if (!casa.length && !extras.length) continue;
    registrarPool(locais, id, `bioma:${id}`, rotuloBioma(id));
  }

  /** @type {Map<string, LocalHabitat[]>} */
  const listas = new Map();
  for (const [chave, mapa] of locais) {
    listas.set(chave, [...mapa.values()].sort(compararLocais));
  }
  porEspecie = listas;
  porBiomaPeso = pesos;
}

function garantir() {
  if (!distribuicaoPronta()) return false;
  if (!porEspecie) reconstruir();
  return true;
}

export function habitatsProntos() {
  return distribuicaoPronta();
}

export function geracaoHabitat() {
  return geracao;
}

/**
 * @param {string} speciesKey
 * @returns {LocalHabitat[]}
 */
export function consultarHabitats(speciesKey) {
  const chave = String(speciesKey || "");
  if (!chave || !garantir()) return [];
  const base = porEspecie.get(chave);
  const lista = base ? base.slice() : [];
  const slot = findShrineSlotForSpecies(chave);
  if (slot && Number.isFinite(slot.x) && Number.isFinite(slot.y)) {
    lista.push({
      id: String(slot.id),
      nome: nomeTemplo(slot.id, slot.element),
      papel: "santuario",
      biomaId: null,
      wx: slot.x,
      wy: slot.y,
    });
    lista.sort(compararLocais);
  }
  return lista;
}

/**
 * Biomas em que a espécie entra no sorteio. Peso 3 = casa, 1 = extra.
 * @param {string} speciesKey
 * @returns {Map<string, number>}
 */
export function biomassDaEspecie(speciesKey) {
  const chave = String(speciesKey || "");
  if (!chave || !garantir()) return MAPA_VAZIO;
  return porBiomaPeso.get(chave) || MAPA_VAZIO;
}

/**
 * Nomes únicos, na ordem casa → extra → santuário.
 * @param {string} speciesKey
 * @returns {string[]}
 */
export function listarHabitats(speciesKey) {
  const locais = consultarHabitats(speciesKey);
  const nomes = [];
  const vistos = new Set();
  for (let i = 0; i < locais.length; i++) {
    const nome = locais[i].nome;
    if (!nome || vistos.has(nome)) continue;
    vistos.add(nome);
    nomes.push(nome);
  }
  return nomes;
}

export function invalidarHabitats() {
  porEspecie = null;
  porBiomaPeso = null;
  geracao += 1;
}
