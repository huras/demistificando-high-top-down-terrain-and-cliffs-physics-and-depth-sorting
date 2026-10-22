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

function clamp01(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Campânula suave: 1 no centro, 0 fora de [centro±largura]. */
function pico(valor, centro, largura) {
  const t = Math.abs(valor - centro) / Math.max(1e-6, largura);
  if (t >= 1) return 0;
  const u = 1 - t;
  return u * u * (3 - 2 * u);
}

/** Rampa: sobe de 0→1 entre a e b. */
function rampa(valor, a, b) {
  if (!(b > a)) return valor >= b ? 1 : 0;
  return suave01((valor - a) / (b - a));
}

/**
 * Domain warp continental — quebra faixas de latitude e o anel AABB
 * sem mudar o hot path (2–4 FBMs, sem busca).
 */
function warpContinente(wx, wy, seed) {
  const e1 = 1100;
  const a1 = 480;
  const e2 = 480;
  const a2 = 200;
  const ox =
    (fbm2(wx / e1, wy / e1, seed + 101, 4) * 2 - 1) * a1 +
    (fbm2(wx / e2, wy / e2, seed + 303, 3) * 2 - 1) * a2;
  const oy =
    (fbm2(wx / e1 + 19.7, wy / e1 - 8.3, seed + 202, 4) * 2 - 1) * a1 +
    (fbm2(wx / e2 + 5.1, wy / e2 + 13.4, seed + 404, 3) * 2 - 1) * a2;
  return { x: wx + ox, y: wy + oy };
}

/** Distância a Kanto entortada — o halo deixa de ser retângulo. */
function distKantoOrganica(wx, wy, seed) {
  const d = distAssinadaKanto(wx, wy);
  const n = fbm2(wx / 360, wy / 360, seed + 8801, 3) - 0.5;
  const n2 = fbm2(wx / 180, wy / 180, seed + 8911, 2) - 0.5;
  return d + n * 340 + n2 * 140;
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
  const d = distKantoOrganica(wx, wy, seed);
  if (d > 0) {
    const anel = 320;
    const puxa = 1 - suave01(Math.min(1, d / anel));
    terra *= 1 - 0.58 * puxa;
  }
  return terra < 0.5;
}

function escolherPorScore(candidatos, wx, wy, seed) {
  let melhor = candidatos[0];
  let segundo = candidatos[1] || candidatos[0];
  for (let i = 1; i < candidatos.length; i++) {
    const c = candidatos[i];
    if (c.score > melhor.score) {
      segundo = melhor;
      melhor = c;
    } else if (c.score > segundo.score) {
      segundo = c;
    }
  }
  // Fronteira contestada: ruído fino decide — borda meandrante, não reta.
  const margem = melhor.score - segundo.score;
  if (margem < 0.16 && segundo.id !== melhor.id) {
    const n = fbm2(wx / 95, wy / 95, seed + 9901, 2);
    const vies = 0.5 + (melhor.score - segundo.score) / 0.32;
    if (n > clamp01(vies)) return POR_ID.get(segundo.id);
  }
  return POR_ID.get(melhor.id);
}

function areaMar(wx, wy, seed) {
  const p = warpContinente(wx, wy, seed);
  const d = distKantoOrganica(wx, wy, seed);
  const n = fbm2(p.x / 1400, p.y / 1400, seed + 2201, 4);
  const shelf =
    0.55 +
    (1 - rampa(d, 500, 1600)) * 0.7 +
    n * 0.45 +
    pico(d, 200, 700) * 0.35;
  const trench = rampa(d, 700, 1800) * (1.15 - n) + (1 - n) * 0.25;
  return escolherPorScore(
    [
      { id: "mundo-shelf", score: shelf },
      { id: "mundo-trench", score: trench },
    ],
    p.x,
    p.y,
    seed,
  );
}

function areaTerra(wx, wy, seed) {
  const p = warpContinente(wx, wy, seed);
  const d = distKantoOrganica(wx, wy, seed);

  // Temperatura mistura latitude + clima — mata a faixa horizontal pura.
  const lat = clamp01(p.y / LADO_MUNDO);
  const clima = fbm2(p.x / 1600, p.y / 1600, seed + 3307, 4);
  const relevo = fbm2(p.x / 920, p.y / 920, seed + 4411, 3);
  const umidade = fbm2(p.x / 1100, p.y / 1100, seed + 5523, 3);
  const detalhe = fbm2(p.x / 520, p.y / 520, seed + 6631, 3);
  const temp = clamp01(lat * 0.5 + clima * 0.38 + (detalhe - 0.5) * 0.22);

  // Halo de costura com Kanto: temperado ganha perto, sem corte duro.
  const anelKanto = (1 - rampa(d, 180, 980)) * (d > -80 ? 1 : 0.35);

  const candidatos = [
    {
      id: "mundo-tundra",
      score: pico(temp, 0.14, 0.22) * 1.35 + (1 - umidade) * 0.25 + (1 - rampa(temp, 0.2, 0.38)) * 0.4,
    },
    {
      id: "mundo-mountain",
      score: rampa(relevo, 0.58, 0.86) * 1.55 + pico(relevo, 0.78, 0.2) * 0.5,
    },
    {
      id: "mundo-desert",
      score: rampa(temp, 0.62, 0.92) * (1.1 - umidade) * 1.4 + pico(temp, 0.82, 0.2) * 0.45,
    },
    {
      id: "mundo-savanna",
      score: pico(temp, 0.62, 0.22) * (0.55 + (1 - umidade) * 0.7) + pico(umidade, 0.38, 0.22) * 0.35,
    },
    {
      id: "mundo-marsh",
      score: rampa(umidade, 0.62, 0.92) * pico(temp, 0.52, 0.28) * 1.45 + rampa(umidade, 0.7, 0.95) * 0.4,
    },
    {
      id: "mundo-forest",
      score: rampa(umidade, 0.48, 0.78) * pico(temp, 0.45, 0.32) * 1.25 + pico(umidade, 0.66, 0.2) * 0.4,
    },
    {
      id: "mundo-floral",
      score: pico(clima, 0.68, 0.2) * pico(umidade, 0.48, 0.18) * 1.35 + pico(temp, 0.5, 0.2) * 0.3,
    },
    {
      id: "mundo-temperate",
      score: 0.55 + pico(temp, 0.42, 0.28) * 0.7 + anelKanto * 1.85 + (1 - Math.abs(umidade - 0.5)) * 0.2,
    },
  ];

  return escolherPorScore(candidatos, p.x, p.y, seed);
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
