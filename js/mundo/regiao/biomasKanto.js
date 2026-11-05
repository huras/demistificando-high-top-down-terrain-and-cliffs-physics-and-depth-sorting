/**
 * Chão de Kanto: províncias grandes (estilo Minecraft) + sub-lugares + mar.
 * Hot path: 1–2 FBM + 2 vizinhos Voronoi — sem varrer a ilha.
 */
import { AREA_KANTO, CENTRO_AREA } from "./grafoKanto.js";
import { fbm2 } from "../voxel/ruido.js";

const SEMENTE = 1337;
const FAIXA = 42;

function bioma(id, kit, superficie, cor, camada) {
  return Object.freeze({ id, kit, superficie, cor, camada });
}

export const BIOMA_KANTO = Object.freeze({
  grama: bioma("light-grass", "light-grass", "grama", "#7dce6a", "terra"),
  mata: bioma("lush-grass", "lush-grass", "grama", "#3e8f45", "terra"),
  selva: bioma("jungle", "jungle", "grama", "#1f6b3a", "terra"),
  floral: bioma("honey-trees-flower-fields", "honey-trees-flower-fields", "grama", "#c9a84a", "terra"),
  caminho: bioma("brown-earth", "brown-earth", "terra", "#a67c52", "terra"),
  pedra: bioma("stone", "stone", "pedra", "#8d8680", "terra"),
  montanha: bioma("pewter-massif", "pewter-massif", "pedra", "#6e6874", "terra"),
  lua: bioma("moon-ridge", "moon-ridge", "pedra", "#6a8098", "terra"),
  tunel: bioma("tunnel-hills", "tunnel-hills", "pedra", "#4a4e56", "terra"),
  fantasma: bioma("ghost-forest", "ghost-forest", "grama", "#c4a86a", "terra"),
  pantano: bioma("marsh", "marsh", "grama", "#1a5c3a", "terra"),
  ambar: bioma("amber-rock", "amber-rock", "terra", "#c4b060", "terra"),
  praia: bioma("dirty-sand", "dirty-sand", "terra", "#d6c48a", "terra"),
  areiaFundo: bioma("sandy-shelf", "sandy-shelf", "terra", "#c9b07a", "mar"),
  savana: bioma("savanna", "savanna", "grama", "#c4a24a", "terra"),
  outono: bioma("autum-forest", "autum-forest", "grama", "#b07840", "terra"),
  seco: bioma("brown-earth", "brown-earth", "terra", "#8d6844", "terra"),
  kelp: bioma("kelp-forest", "kelp-forest", "terra", "#1a5c4a", "mar"),
  fossa: bioma("deep-trench", "deep-trench", "pedra", "#1e3a5f", "mar"),
});

/** Resolve id de kit/bioma para o objeto Kanto. */
export function biomaKantoPorId(id) {
  if (!id) return BIOMA_KANTO.grama;
  const vals = Object.values(BIOMA_KANTO);
  for (let i = 0; i < vals.length; i++) {
    if (vals[i].id === id || vals[i].kit === id) return vals[i];
  }
  return BIOMA_KANTO.grama;
}

function cel(ax, ay) {
  return {
    x: ax * AREA_KANTO + CENTRO_AREA,
    y: ay * AREA_KANTO + CENTRO_AREA,
  };
}

function centro(ax, ay, item, raio, folga, semente) {
  return Object.freeze({
    bioma: item,
    x: ax * AREA_KANTO + CENTRO_AREA,
    y: ay * AREA_KANTO + CENTRO_AREA,
    raio,
    folga,
    semente,
  });
}

/** Sub-províncias locais (por cima do Voronoi). */
const TERRA = Object.freeze([
  centro(16, 5, BIOMA_KANTO.lua, 600, 160, 11),
  centro(25, 7.5, BIOMA_KANTO.tunel, 430, 120, 23),
  centro(26, 11, BIOMA_KANTO.fantasma, 210, 80, 37),
  centro(20, 24, BIOMA_KANTO.pantano, 260, 100, 53),
  centro(10, 26, BIOMA_KANTO.ambar, 200, 70, 71),
]);

/** Fundos marinhos — Pallet / leste / fossa oeste. */
const MAR = Object.freeze([
  centro(25, 2, BIOMA_KANTO.kelp, 360, 140, 89),
  centro(4, 18, BIOMA_KANTO.fossa, 420, 160, 97),
]);

/**
 * Províncias grandes (~Minecraft). Centros em células do grafo;
 * escala típica AREA*2.5–4.
 */
const PROVINCIAS = Object.freeze([
  { ...cel(10, 5), bioma: BIOMA_KANTO.montanha }, // Pewter / mt
  { ...cel(16, 4), bioma: BIOMA_KANTO.lua },
  { ...cel(22, 5), bioma: BIOMA_KANTO.mata }, // Cerulean norte
  { ...cel(26, 5), bioma: BIOMA_KANTO.tunel },
  { ...cel(10, 8), bioma: BIOMA_KANTO.selva }, // Viridian forest
  { ...cel(10, 12), bioma: BIOMA_KANTO.mata },
  { ...cel(16, 11), bioma: BIOMA_KANTO.floral }, // Celadon
  { ...cel(20, 11), bioma: BIOMA_KANTO.pedra }, // Saffron
  { ...cel(26, 11), bioma: BIOMA_KANTO.fantasma }, // Lavender
  { ...cel(10, 17), bioma: BIOMA_KANTO.grama }, // Pallet
  { ...cel(20, 17), bioma: BIOMA_KANTO.praia }, // Vermilion
  { ...cel(20, 24), bioma: BIOMA_KANTO.pantano }, // Fuchsia
  { ...cel(16, 22), bioma: BIOMA_KANTO.savana }, // Safari approach
  { ...cel(10, 26), bioma: BIOMA_KANTO.ambar }, // Cinnabar
  { ...cel(14, 16), bioma: BIOMA_KANTO.outono },
  { ...cel(6, 14), bioma: BIOMA_KANTO.seco },
  { ...cel(28, 16), bioma: BIOMA_KANTO.savana },
  { ...cel(18, 8), bioma: BIOMA_KANTO.grama },
]);

const UNICO = new Map();

function parUnico(item) {
  let par = UNICO.get(item);
  if (par) return par;
  par = Object.freeze({ bioma: item, biomaB: item, dominio: 1 });
  UNICO.set(item, par);
  return par;
}

function suave01(t) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

function warpProvincia(x, y) {
  const e = Math.max(280, AREA_KANTO * 0.9);
  const a = AREA_KANTO * 0.55;
  const ox = (fbm2(x / e, y / e, SEMENTE + 501, 3) * 2 - 1) * a;
  const oy = (fbm2(x / e + 9.1, y / e - 4.2, SEMENTE + 607, 3) * 2 - 1) * a;
  return { x: x + ox, y: y + oy };
}

/** Dois centros Voronoi mais próximos → bioma + blend. */
function provinciaEm(x, y) {
  const p = warpProvincia(x, y);
  let melhor = PROVINCIAS[0];
  let d0 = Infinity;
  let segundo = PROVINCIAS[1] || PROVINCIAS[0];
  let d1 = Infinity;
  for (let i = 0; i < PROVINCIAS.length; i++) {
    const c = PROVINCIAS[i];
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const d = dx * dx + dy * dy;
    if (d < d0) {
      segundo = melhor;
      d1 = d0;
      melhor = c;
      d0 = d;
    } else if (d < d1) {
      segundo = c;
      d1 = d;
    }
  }
  const a = Math.sqrt(d0);
  const b = Math.sqrt(d1);
  const faixa = Math.max(120, AREA_KANTO * 0.35);
  const dominio = b - a >= faixa ? 1 : suave01(0.5 + (b - a) / (2 * faixa));
  if (dominio >= 0.92 || melhor.bioma === segundo.bioma) return parUnico(melhor.bioma);
  return { bioma: melhor.bioma, biomaB: segundo.bioma, dominio };
}

function biomaFloresta(x, y, densa) {
  const mancha = fbm2(x * 0.008, y * 0.008, SEMENTE + 5, 3);
  if (densa) {
    if (mancha > 0.28) return BIOMA_KANTO.selva;
    if (mancha > 0.12) return BIOMA_KANTO.mata;
    return BIOMA_KANTO.outono;
  }
  if (mancha > 0.38) return BIOMA_KANTO.selva;
  if (mancha > 0.18) return BIOMA_KANTO.mata;
  return BIOMA_KANTO.outono;
}

function baseDaTerra(x, y, dentroMonte, floresta, densa) {
  if (dentroMonte > 24) return parUnico(BIOMA_KANTO.montanha);
  if (floresta) return parUnico(biomaFloresta(x, y, densa));
  return provinciaEm(x, y);
}

function pesoDe(x, y, c) {
  const dx = x - c.x;
  const dy = y - c.y;
  const alcance = c.raio + c.folga;
  if (dx * dx + dy * dy > alcance * alcance) return 0;
  const n = fbm2(x * 0.0065, y * 0.0065, c.semente, 3);
  const dist = Math.hypot(dx, dy) + (n - 0.5) * 2 * c.folga;
  if (dist >= c.raio) return 0;
  const interno = c.raio - FAIXA;
  if (dist <= interno) return 1;
  return suave01((c.raio - dist) / FAIXA);
}

function maisForte(x, y, lista) {
  let item = null;
  let peso = 0;
  for (let i = 0; i < lista.length; i++) {
    const p = pesoDe(x, y, lista[i]);
    if (p > peso) {
      peso = p;
      item = lista[i].bioma;
    }
  }
  return { item, peso };
}

function parSobre(lugar, basePar, peso) {
  if (!(peso > 0) || !lugar) return basePar;
  const base = basePar.bioma;
  if (peso >= 1 || lugar === base) return parUnico(lugar);
  if (peso >= 0.5) return { bioma: lugar, biomaB: base, dominio: peso };
  return { bioma: base, biomaB: lugar, dominio: 1 - peso };
}

/**
 * Par do ponto. `dominio` é o peso do bioma dominante.
 * @param {object|null} biomaCidade — chão característico da cidade (fora de rua/prédio).
 * @param {boolean} [densa] — floresta densa (Viridian).
 */
export function parBiomaKanto(x, y, perfilU, dentroMonte, floresta, predio, rua, biomaCidade = null, densa = false) {
  if (predio) return parUnico(BIOMA_KANTO.pedra);
  if (rua) return parUnico(BIOMA_KANTO.caminho);
  // Chão urbano manda sobre praia/mar — a cidade é terra preenchida.
  if (biomaCidade) return parUnico(biomaCidade);
  const u = Number.isFinite(perfilU) ? perfilU : 1;
  if (u < 0.34) {
    const mar = maisForte(x, y, MAR);
    return parSobre(mar.item, parUnico(BIOMA_KANTO.areiaFundo), mar.peso);
  }
  if (u < 0.72) return parUnico(BIOMA_KANTO.praia);
  const base = baseDaTerra(x, y, dentroMonte, floresta, densa);
  const terra = maisForte(x, y, TERRA);
  return parSobre(terra.item, base, terra.peso);
}
