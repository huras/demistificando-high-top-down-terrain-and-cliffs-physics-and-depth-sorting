/**
 * Chão de Kanto. O miolo continua o ruído antigo. Cada bioma de lugar
 * nasce num centro: a distância, entortada por ruído, decide a troca.
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

const TERRA = Object.freeze([
  centro(16, 5, BIOMA_KANTO.lua, 600, 160, 11),
  centro(25, 7.5, BIOMA_KANTO.tunel, 430, 120, 23),
  centro(26, 11, BIOMA_KANTO.fantasma, 210, 80, 37),
  centro(20, 24, BIOMA_KANTO.pantano, 260, 100, 53),
  centro(10, 26, BIOMA_KANTO.ambar, 200, 70, 71),
]);

const MAR = Object.freeze([
  centro(25, 2, BIOMA_KANTO.kelp, 360, 140, 89),
  centro(4, 18, BIOMA_KANTO.fossa, 420, 160, 97),
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

function biomaDoMiolo(x, y) {
  const n = fbm2(x * 0.0032, y * 0.0032, SEMENTE + 41, 3);
  const detalhe = fbm2(x * 0.012, y * 0.012, SEMENTE + 77, 2);
  if (n > 0.74 && detalhe > 0.5) return BIOMA_KANTO.mata;
  if (n < 0.3) return BIOMA_KANTO.savana;
  if (n < 0.46) return BIOMA_KANTO.outono;
  if (detalhe < 0.2) return BIOMA_KANTO.seco;
  return BIOMA_KANTO.grama;
}

function baseDaTerra(x, y, dentroMonte, floresta) {
  if (dentroMonte > 24) return BIOMA_KANTO.montanha;
  if (floresta) {
    const mancha = fbm2(x * 0.02, y * 0.02, SEMENTE + 5, 2);
    if (mancha > 0.34) return BIOMA_KANTO.mata;
  }
  return biomaDoMiolo(x, y);
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

function parSobre(lugar, base, peso) {
  if (!(peso > 0) || !lugar) return parUnico(base);
  if (peso >= 1 || lugar === base) return parUnico(lugar);
  if (peso >= 0.5) return { bioma: lugar, biomaB: base, dominio: peso };
  return { bioma: base, biomaB: lugar, dominio: 1 - peso };
}

/**
 * Par do ponto. `dominio` é o peso do bioma dominante.
 * Rua, prédio e a costa ficam por cima. O lugar só entra na terra, ou no fundo do mar.
 */
export function parBiomaKanto(x, y, perfilU, dentroMonte, floresta, predio, rua) {
  if (predio) return parUnico(BIOMA_KANTO.pedra);
  if (rua) return parUnico(BIOMA_KANTO.caminho);
  const u = Number.isFinite(perfilU) ? perfilU : 1;
  if (u < 0.34) {
    const mar = maisForte(x, y, MAR);
    return parSobre(mar.item, BIOMA_KANTO.areiaFundo, mar.peso);
  }
  if (u < 0.72) return parUnico(BIOMA_KANTO.praia);
  const base = baseDaTerra(x, y, dentroMonte, floresta);
  const terra = maisForte(x, y, TERRA);
  return parSobre(terra.item, base, terra.peso);
}
