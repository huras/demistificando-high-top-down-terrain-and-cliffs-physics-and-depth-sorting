/**
 * Arbusto silvestre por bioma. A lista é a do Pokémon AI:
 * hash estável, grade, e a espécie sai do bioma da célula.
 */

import { BERRIES } from "../../wild/catalogo.js";
import { dentroDoTerrenoSala } from "../cidade/sala3d.js";
import { hash2 } from "../voxel/ruido.js";
import {
  alturaDoRelevo,
  biomaDominante,
  nivelMarBlocos,
  obterSementeBioma,
} from "./catalogo.js";
import { areaLogicaNoMundo } from "./areasMundo.js";
import { amostraKanto, dentroDoKanto } from "../regiao/amostraKanto.js";

const PASSO = 4;
const CHANCE = 0.04;
export const MAX_ARBUSTO_CHUNK = 2;
const ESPACO = 2;
const MASCARA = 0xbe27;

export const MS_ARBUSTO = 440000;
export const MS_FLOR = 40000;
export const ALCANCE_COLHER = 1.8;

/** @type {Readonly<Record<string, readonly string[]>>} */
const BERRIES_POR_BIOMA = Object.freeze({
  "dirty-sand": Object.freeze(["oran", "pinap", "nomel", "pamtre", "kelpsy"]),
  "light-grass": Object.freeze(["oran", "pecha", "cheri", "razz", "sitrus", "leppa"]),
  "lush-grass": Object.freeze(["sitrus", "lum", "hondew", "watmel", "magost", "aguav"]),
  "brown-earth": Object.freeze(["chesto", "figy", "tamato", "persim", "pomeg"]),
  stone: Object.freeze(["wiki", "chesto", "belue", "kelpsy"]),
  snow: Object.freeze(["aspear", "bluk", "grepa"]),
  savanna: Object.freeze(["cornn", "figy", "nomel", "tamato", "rawst", "qualot"]),
  tundra: Object.freeze(["aspear", "bluk", "belue"]),
  "autum-forest": Object.freeze(["persim", "pomeg", "grepa", "qualot", "spelon", "leppa"]),
  "honey-trees-flower-fields": Object.freeze(["hondew", "magost", "watmel", "rabuta", "oran", "sitrus"]),
  "ghost-forest": Object.freeze(["wiki", "durin", "belue", "chesto", "mago"]),
  jungle: Object.freeze(["pinap", "mago", "iapapa", "rabuta", "lum", "durin"]),
  "palm-jungle": Object.freeze(["pinap", "pamtre", "nomel", "oran", "iapapa", "lum"]),
  marsh: Object.freeze(["oran", "pecha", "lum", "durin", "pinap", "aguav"]),
  "faroeste-desert": Object.freeze(["rawst", "figy", "nomel", "iapapa", "pamtre"]),
  "amber-rock": Object.freeze(["rawst", "figy", "nomel", "kelpsy"]),
  "rift-ground": Object.freeze(["wiki", "durin", "mago", "belue"]),
  "pewter-massif": Object.freeze(["wiki", "chesto", "belue", "kelpsy"]),
  "moon-ridge": Object.freeze(["aspear", "bluk", "belue", "wiki"]),
  "tunnel-hills": Object.freeze(["wiki", "chesto", "belue", "kelpsy"]),
});

export function spriteBerry(chave, estagio) {
  return `berry:${chave}:${estagio || "maduro"}`;
}

export function berriesDoBioma(id) {
  const lista = BERRIES_POR_BIOMA[id];
  if (!lista) return [];
  const saida = [];
  for (let i = 0; i < lista.length; i++) {
    if (BERRIES[lista[i]]) saida.push(lista[i]);
  }
  return saida;
}

function sementeRolagem() {
  return (obterSementeBioma() ^ MASCARA) | 0;
}

function naGrade(x, y) {
  const mx = ((x % PASSO) + PASSO) % PASSO;
  const my = ((y % PASSO) + PASSO) % PASSO;
  return mx === 0 && my === 0;
}

function idBiomaPlantavel(x, y) {
  if (dentroDoTerrenoSala(x, y)) return "";
  if (dentroDoKanto(x, y)) {
    const amostra = amostraKanto(x, y);
    if (!amostra || amostra.rua || amostra.predio || amostra.entradaLab) return "";
    if (amostra.h < nivelMarBlocos()) return "";
    const bioma = amostra.bioma;
    if (!bioma || bioma.camada === "mar") return "";
    return bioma.id || "";
  }
  const bioma = biomaDominante(x, y);
  if (!bioma || bioma.camada === "mar") return "";
  if (alturaDoRelevo(x, y) < nivelMarBlocos()) return "";
  const area = areaLogicaNoMundo(x, y, { mar: false });
  if (area?.berry && berriesDoBioma(area.berry).length) return area.berry;
  return bioma.id || "";
}

function candidato(x, y) {
  if (!naGrade(x, y)) return false;
  if (hash2(x, y, sementeRolagem()) > CHANCE) return false;
  const id = idBiomaPlantavel(x, y);
  return berriesDoBioma(id).length > 0;
}

function ganhaEspaco(x, y) {
  const eu = hash2(x, y, sementeRolagem());
  for (let dy = -ESPACO; dy <= ESPACO; dy++) {
    for (let dx = -ESPACO; dx <= ESPACO; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (!naGrade(nx, ny) || !candidato(nx, ny)) continue;
      const outro = hash2(nx, ny, sementeRolagem());
      if (outro < eu || (outro === eu && (ny < y || (ny === y && nx < x)))) return false;
    }
  }
  return true;
}

/** Chave da berry, ou null. A célula precisa estar na grade e livre de mar, rua e prédio. */
export function arbustoNaCelula(wx, wy) {
  const x = wx | 0;
  const y = wy | 0;
  if (!candidato(x, y) || !ganhaEspaco(x, y)) return null;
  const keys = berriesDoBioma(idBiomaPlantavel(x, y));
  if (!keys.length) return null;
  const indice = Math.floor(hash2(x, y, (sementeRolagem() + 99) | 0) * keys.length);
  return keys[Math.min(keys.length - 1, indice)];
}
