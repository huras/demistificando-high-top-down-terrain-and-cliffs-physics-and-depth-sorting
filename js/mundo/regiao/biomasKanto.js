/**
 * Chão visual de Kanto. A área lógica define a paleta; ruído local
 * só varia dentro dela. Bordas entre áreas fazem soft blend O(1).
 */
import { AREA_KANTO } from "./grafoKanto.js";
import { areaEm, vizinhoAreaBorda } from "./areasKanto.js";
import { fbm2 } from "../voxel/ruido.js";

const SEMENTE = 1337;

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
  kelp: bioma("kelp-forest", "kelp-forest", "terra", "#1a5c4a", "mar"),
  fossa: bioma("deep-trench", "deep-trench", "pedra", "#1e3a5f", "mar"),
});

/** id de catálogo → stub Kanto */
const POR_ID = new Map([
  ["light-grass", BIOMA_KANTO.grama],
  ["lush-grass", BIOMA_KANTO.mata],
  ["brown-earth", BIOMA_KANTO.caminho],
  ["stone", BIOMA_KANTO.pedra],
  ["pewter-massif", BIOMA_KANTO.montanha],
  ["moon-ridge", BIOMA_KANTO.lua],
  ["tunnel-hills", BIOMA_KANTO.tunel],
  ["ghost-forest", BIOMA_KANTO.fantasma],
  ["marsh", BIOMA_KANTO.pantano],
  ["amber-rock", BIOMA_KANTO.ambar],
  ["dirty-sand", BIOMA_KANTO.praia],
  ["sandy-shelf", BIOMA_KANTO.areiaFundo],
  ["savanna", BIOMA_KANTO.savana],
  ["autum-forest", BIOMA_KANTO.outono],
  ["kelp-forest", BIOMA_KANTO.kelp],
  ["deep-trench", BIOMA_KANTO.fossa],
]);

const UNICO = new Map();

function stubDe(id) {
  return POR_ID.get(id) || BIOMA_KANTO.grama;
}

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

function parSobre(lugar, base, peso) {
  if (!(peso > 0) || !lugar) return parUnico(base);
  if (peso >= 1 || lugar === base) return parUnico(lugar);
  if (peso >= 0.5) return { bioma: lugar, biomaB: base, dominio: peso };
  return { bioma: base, biomaB: lugar, dominio: 1 - peso };
}

function visualDaPaleta(area, x, y) {
  const paleta = area?.paleta;
  if (!paleta?.length) return BIOMA_KANTO.grama;
  if (paleta.length === 1) return stubDe(paleta[0]);
  const n = fbm2(x * 0.0075, y * 0.0075, SEMENTE + (area.id.length * 17), 2);
  const detalhe = fbm2(x * 0.018, y * 0.018, SEMENTE + 91, 2);
  const t = suave01(n * 0.72 + detalhe * 0.28);
  const idx = Math.min(paleta.length - 1, (t * paleta.length) | 0);
  return stubDe(paleta[idx]);
}

function visualPrimario(area) {
  return stubDe(area?.paleta?.[0] || "light-grass");
}

function baseDaTerra(area, x, y, dentroMonte, floresta) {
  if (dentroMonte > 24) {
    if (area?.id === "mt-moon") return BIOMA_KANTO.lua;
    if (area?.id === "rock-tunnel-hills") return BIOMA_KANTO.tunel;
    return BIOMA_KANTO.montanha;
  }
  if (floresta || area?.id === "viridian-forest") {
    const mancha = fbm2(x * 0.02, y * 0.02, SEMENTE + 5, 2);
    if (mancha > 0.28 || area?.id === "viridian-forest") return BIOMA_KANTO.mata;
  }
  return visualDaPaleta(area, x, y);
}

function baseDoMar(area) {
  if (area?.id === "north-kelp") return BIOMA_KANTO.kelp;
  if (area?.id === "west-trench") return BIOMA_KANTO.fossa;
  return BIOMA_KANTO.areiaFundo;
}

function comBorda(ax, ay, lx, ly, base) {
  const borda = vizinhoAreaBorda(ax, ay, lx, ly);
  if (!borda || !(borda.peso > 0.08)) return parUnico(base);
  const outro =
    borda.vizinha.camada === "mar"
      ? baseDoMar(borda.vizinha)
      : visualPrimario(borda.vizinha);
  return parSobre(outro, base, borda.peso * 0.55);
}

/**
 * Par do ponto. `dominio` é o peso do bioma dominante.
 * Rua, prédio e a costa ficam por cima da área lógica.
 */
export function parBiomaKanto(x, y, perfilU, dentroMonte, floresta, predio, rua) {
  if (predio) return parUnico(BIOMA_KANTO.pedra);
  if (rua) return parUnico(BIOMA_KANTO.caminho);

  const ax = (x / AREA_KANTO) | 0;
  const ay = (y / AREA_KANTO) | 0;
  const lx = x - ax * AREA_KANTO;
  const ly = y - ay * AREA_KANTO;
  const area = areaEm(ax, ay);
  const u = Number.isFinite(perfilU) ? perfilU : 1;

  if (u < 0.34) {
    const base = baseDoMar(area);
    return comBorda(ax, ay, lx, ly, base);
  }
  if (u < 0.72) return parUnico(BIOMA_KANTO.praia);

  const base = baseDaTerra(area, x, y, dentroMonte, floresta);
  return comBorda(ax, ay, lx, ly, base);
}
