/**
 * Áreas lógicas do overworld procedural (fora da ilha authored).
 * Escala continental: clima estável → paleta curta → Voronoi só varia dentro.
 */
import { SEED_MUNDO } from "../../config.js";
import { LADO_MUNDO, distAssinadaKanto } from "../bounds.js";
import { fbm2 } from "../voxel/ruido.js";

/** @typedef {{ id: string, nome: string, precip: string, paleta: readonly string[], encontro: string, berry: string, camada: "terra"|"mar", escalaMul: number }} AreaMundo */

/** @type {readonly AreaMundo[]} */
export const AREAS_MUNDO = Object.freeze([
  Object.freeze({
    id: "mundo-temperate",
    nome: "Temperado",
    precip: "chuva",
    paleta: Object.freeze(["light-grass", "lush-grass", "autum-forest"]),
    encontro: "light-grass",
    berry: "light-grass",
    camada: "terra",
    escalaMul: 2.8,
  }),
  Object.freeze({
    id: "mundo-forest",
    nome: "Floresta profunda",
    precip: "chuva",
    paleta: Object.freeze(["lush-grass", "jungle", "autum-forest"]),
    encontro: "lush-grass",
    berry: "lush-grass",
    camada: "terra",
    escalaMul: 2.6,
  }),
  Object.freeze({
    id: "mundo-savanna",
    nome: "Savana",
    precip: "chuva",
    paleta: Object.freeze(["savanna", "light-grass", "honey-trees-flower-fields"]),
    encontro: "savanna",
    berry: "savanna",
    camada: "terra",
    escalaMul: 3.0,
  }),
  Object.freeze({
    id: "mundo-desert",
    nome: "Deserto",
    precip: "areia",
    paleta: Object.freeze(["faroeste-desert", "dirty-sand", "rift-ground"]),
    encontro: "faroeste-desert",
    berry: "faroeste-desert",
    camada: "terra",
    escalaMul: 3.2,
  }),
  Object.freeze({
    id: "mundo-mountain",
    nome: "Cordilheira",
    precip: "chuva",
    paleta: Object.freeze(["stone", "rift-ground"]),
    encontro: "stone",
    berry: "stone",
    camada: "terra",
    escalaMul: 2.4,
  }),
  Object.freeze({
    id: "mundo-tundra",
    nome: "Tundra",
    precip: "neve",
    paleta: Object.freeze(["snow", "tundra", "stone"]),
    encontro: "snow",
    berry: "snow",
    camada: "terra",
    escalaMul: 3.0,
  }),
  Object.freeze({
    id: "mundo-marsh",
    nome: "Pântano",
    precip: "nevoa",
    paleta: Object.freeze(["marsh", "lush-grass", "jungle"]),
    encontro: "marsh",
    berry: "marsh",
    camada: "terra",
    escalaMul: 2.5,
  }),
  Object.freeze({
    id: "mundo-floral",
    nome: "Campos floridos",
    precip: "chuva",
    paleta: Object.freeze(["honey-trees-flower-fields", "light-grass", "savanna"]),
    encontro: "honey-trees-flower-fields",
    berry: "honey-trees-flower-fields",
    camada: "terra",
    escalaMul: 2.7,
  }),
  Object.freeze({
    id: "mundo-shelf",
    nome: "Plataforma oceânica",
    precip: "chuva",
    paleta: Object.freeze(["sandy-shelf", "kelp-forest"]),
    encontro: "sandy-shelf",
    berry: "dirty-sand",
    camada: "mar",
    escalaMul: 3.4,
  }),
  Object.freeze({
    id: "mundo-trench",
    nome: "Fossa oceânica",
    precip: "chuva",
    paleta: Object.freeze(["deep-trench", "sandy-shelf"]),
    encontro: "deep-trench",
    berry: "dirty-sand",
    camada: "mar",
    escalaMul: 3.6,
  }),
]);

const POR_ID = new Map(AREAS_MUNDO.map((a) => [a.id, a]));

/** Kits landmark de Kanto — nunca no saco random global do exterior. */
export const BLACKLIST_LANDMARK_KANTO = Object.freeze([
  "moon-ridge",
  "tunnel-hills",
  "ghost-forest",
  "pewter-massif",
  "amber-rock",
  "johto-past",
]);

function suave01(t) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/**
 * Espelho leve da máscara de continente (mesmos seeds/escalas do catálogo)
 * para precip/encontros sem importar catalogo.js (evita ciclo).
 */
function pareceMar(wx, wy, seed) {
  const escala = 880;
  const largo = fbm2(wx / escala, wy / escala, seed + 901, 5);
  const costa = fbm2(wx / (escala * 0.34), wy / (escala * 0.34), seed + 1409, 3);
  let terra = largo * 0.7 + costa * 0.3;
  const d = distAssinadaKanto(wx, wy);
  if (d > 0) {
    const anel = 320;
    const puxa = 1 - suave01(Math.min(1, d / anel));
    terra *= 1 - 0.58 * puxa;
  }
  return terra < 0.5;
}

function areaMar(wx, wy, seed) {
  const n = fbm2(wx / 1400, wy / 1400, seed + 2201, 3);
  const d = distAssinadaKanto(wx, wy);
  // Perto de Kanto: plataforma; longe + ruído baixo: fossa.
  if (d < 900 || n > 0.42) return POR_ID.get("mundo-shelf");
  return POR_ID.get("mundo-trench");
}

function areaTerra(wx, wy, seed) {
  const d = distAssinadaKanto(wx, wy);
  // Anel próximo à ilha: temperado estável (costura visual com Kanto).
  if (d >= 0 && d < 720) return POR_ID.get("mundo-temperate");

  const lat = Math.max(0, Math.min(1, wy / LADO_MUNDO));
  const clima = fbm2(wx / 1600, wy / 1600, seed + 3307, 4);
  const relevo = fbm2(wx / 920, wy / 920, seed + 4411, 3);
  const umidade = fbm2(wx / 1100, wy / 1100, seed + 5523, 3);

  if (lat < 0.22 || (lat < 0.32 && clima < 0.38)) return POR_ID.get("mundo-tundra");
  if (relevo > 0.72) return POR_ID.get("mundo-mountain");
  if (lat > 0.72 && clima < 0.4) return POR_ID.get("mundo-desert");
  if (lat > 0.55 && clima < 0.48) return POR_ID.get("mundo-savanna");
  if (umidade > 0.7 && clima > 0.45) return POR_ID.get("mundo-marsh");
  if (umidade > 0.58) return POR_ID.get("mundo-forest");
  if (clima > 0.62 && umidade > 0.4 && umidade < 0.58) return POR_ID.get("mundo-floral");
  return POR_ID.get("mundo-temperate");
}

export function areaPorId(id) {
  return POR_ID.get(id) || null;
}

/**
 * Área lógica do ponto no overworld procedural.
 * @param {number} wx
 * @param {number} wy
 * @param {{ mar?: boolean, seed?: number }} [opts]
 *   `mar` força camada oceânica; se omitido, estima pela máscara espelhada.
 */
export function areaLogicaNoMundo(wx, wy, opts = {}) {
  const seed = (opts.seed ?? SEED_MUNDO) | 0;
  const mar = opts.mar != null ? !!opts.mar : pareceMar(wx, wy, seed);
  return mar ? areaMar(wx, wy, seed) : areaTerra(wx, wy, seed);
}

/**
 * Resolve ids da paleta contra o catálogo carregado.
 * Filtra blacklist e entradas inexistentes.
 * @param {AreaMundo|null} area
 * @param {object|null} catalogo
 * @returns {object[]}
 */
export function biomasDaPaleta(area, catalogo) {
  const todos = catalogo?.biomas || [];
  if (!todos.length) return [];
  const porId = new Map();
  for (let i = 0; i < todos.length; i++) {
    const b = todos[i];
    if (b?.id) porId.set(b.id, b);
  }
  const ids = area?.paleta?.length ? area.paleta : ["light-grass"];
  const saida = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (BLACKLIST_LANDMARK_KANTO.includes(id)) continue;
    const b = porId.get(id);
    if (b) saida.push(b);
  }
  if (saida.length) return saida;
  // Fallback seguro: biomas terra genéricos do catálogo, sem landmarks.
  for (let i = 0; i < todos.length; i++) {
    const b = todos[i];
    if (!b?.id || BLACKLIST_LANDMARK_KANTO.includes(b.id)) continue;
    if (b.camada === "mar") continue;
    if (
      b.id === "light-grass" ||
      b.id === "lush-grass" ||
      b.id === "savanna" ||
      b.id === "autum-forest"
    ) {
      saida.push(b);
    }
  }
  return saida.length ? saida : todos.filter((b) => b?.id && !BLACKLIST_LANDMARK_KANTO.includes(b.id));
}
