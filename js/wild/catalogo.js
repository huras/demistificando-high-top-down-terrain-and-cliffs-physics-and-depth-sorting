/** Catálogos de item, loja, craft e móvel. Dados no formato do jogo de origem. */

import { MATERIAIS_DROP } from "./materiaisDrop.js";

export const TIPO_ITEM = Object.freeze({
  BOLA: "ball",
  BERRY: "berry",
  REMEDIO: "medicine",
  FERRAMENTA: "tool",
  MATERIAL: "material",
  CHAVE: "key",
  BLOCO: "block",
});

export const SLOTS_HOTBAR = 6;

const HOTBAR_TECLAS = Object.freeze([
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
  "Digit6",
]);

export function teclaDoSlot(indice) {
  return HOTBAR_TECLAS[indice] || null;
}

export function slotDaTecla(codigo) {
  const i = HOTBAR_TECLAS.indexOf(codigo);
  return i;
}

function berry(key, nome, cor, efeito) {
  const base = efeito ? { ...efeito } : {};
  if (!base.curaHp && !base.curaFrac && !base.pp) base.curaHp = 2;
  return Object.freeze({
    key,
    nome,
    nameKey: `berries.${key}`,
    tipo: TIPO_ITEM.BERRY,
    cor,
    plantavel: true,
    efeito: Object.freeze(base),
    compra: 80,
    venda: 20,
  });
}

export const BERRIES = Object.freeze({
  cheri: berry("cheri", "Cheri Berry", "#ef4444", { cura: "paralysis" }),
  chesto: berry("chesto", "Chesto Berry", "#6366f1", { cura: "sleep" }),
  pecha: berry("pecha", "Pecha Berry", "#f472b6", { cura: "poison" }),
  rawst: berry("rawst", "Rawst Berry", "#fb923c", { cura: "burn" }),
  aspear: berry("aspear", "Aspear Berry", "#facc15", { cura: "freeze" }),
  persim: berry("persim", "Persim Berry", "#f97316", { cura: "confusion" }),
  lum: berry("lum", "Lum Berry", "#84cc16", { cura: "all" }),
  oran: berry("oran", "Oran Berry", "#3b82f6", { curaHp: 10 }),
  sitrus: berry("sitrus", "Sitrus Berry", "#eab308", { curaFrac: 0.25 }),
  figy: berry("figy", "Figy Berry", "#d97706", { curaFrac: 0.125 }),
  wiki: berry("wiki", "Wiki Berry", "#a855f7", { curaFrac: 0.125 }),
  mago: berry("mago", "Mago Berry", "#ec4899", { curaFrac: 0.125 }),
  aguav: berry("aguav", "Aguav Berry", "#22c55e", { curaFrac: 0.125 }),
  iapapa: berry("iapapa", "Iapapa Berry", "#ca8a04", { curaFrac: 0.125 }),
  leppa: berry("leppa", "Leppa Berry", "#dc2626", { pp: 10 }),
  razz: berry("razz", "Razz Berry", "#dc2626"),
  bluk: berry("bluk", "Bluk Berry", "#4f46e5"),
  pinap: berry("pinap", "Pinap Berry", "#eab308"),
  cornn: berry("cornn", "Cornn Berry", "#6366f1"),
  magost: berry("magost", "Magost Berry", "#f472b6"),
  rabuta: berry("rabuta", "Rabuta Berry", "#65a30d"),
  nomel: berry("nomel", "Nomel Berry", "#facc15"),
  spelon: berry("spelon", "Spelon Berry", "#e11d48"),
  pamtre: berry("pamtre", "Pamtre Berry", "#78716c"),
  watmel: berry("watmel", "Watmel Berry", "#2dd4bf"),
  durin: berry("durin", "Durin Berry", "#4d7c0f"),
  belue: berry("belue", "Belue Berry", "#1d4ed8"),
  pomeg: berry("pomeg", "Pomeg Berry", "#e11d48"),
  kelpsy: berry("kelpsy", "Kelpsy Berry", "#2563eb"),
  qualot: berry("qualot", "Qualot Berry", "#f59e0b"),
  hondew: berry("hondew", "Hondew Berry", "#16a34a"),
  grepa: berry("grepa", "Grepa Berry", "#eab308"),
  tamato: berry("tamato", "Tamato Berry", "#dc2626"),
});

export const REMEDIOS = Object.freeze({
  potion: Object.freeze({ key: "potion", nome: "Poção", nameKey: "medicine.potion", tipo: TIPO_ITEM.REMEDIO, compra: 300, venda: 150, efeito: Object.freeze({ curaHp: 20 }) }),
  superPotion: Object.freeze({ key: "superPotion", nome: "Super Poção", nameKey: "medicine.superPotion", tipo: TIPO_ITEM.REMEDIO, compra: 700, venda: 350, efeito: Object.freeze({ curaHp: 50 }) }),
  hyperPotion: Object.freeze({ key: "hyperPotion", nome: "Hiper Poção", nameKey: "medicine.hyperPotion", tipo: TIPO_ITEM.REMEDIO, compra: 1200, venda: 600, efeito: Object.freeze({ curaHp: 200 }) }),
  antidote: Object.freeze({ key: "antidote", nome: "Antídoto", nameKey: "medicine.antidote", tipo: TIPO_ITEM.REMEDIO, compra: 100, venda: 50, efeito: Object.freeze({ cura: "poison" }) }),
  paralyzeHeal: Object.freeze({ key: "paralyzeHeal", nome: "Antiparalisia", nameKey: "medicine.paralyzeHeal", tipo: TIPO_ITEM.REMEDIO, compra: 200, venda: 100, efeito: Object.freeze({ cura: "paralysis" }) }),
  awakening: Object.freeze({ key: "awakening", nome: "Despertar", nameKey: "medicine.awakening", tipo: TIPO_ITEM.REMEDIO, compra: 250, venda: 125, efeito: Object.freeze({ cura: "sleep" }) }),
  burnHeal: Object.freeze({ key: "burnHeal", nome: "Cura de Queimadura", nameKey: "medicine.burnHeal", tipo: TIPO_ITEM.REMEDIO, compra: 250, venda: 125, efeito: Object.freeze({ cura: "burn" }) }),
  iceHeal: Object.freeze({ key: "iceHeal", nome: "Cura de Gelo", nameKey: "medicine.iceHeal", tipo: TIPO_ITEM.REMEDIO, compra: 250, venda: 125, efeito: Object.freeze({ cura: "freeze" }) }),
  fullHeal: Object.freeze({ key: "fullHeal", nome: "Cura Total", nameKey: "medicine.fullHeal", tipo: TIPO_ITEM.REMEDIO, compra: 600, venda: 300, efeito: Object.freeze({ cura: "all" }) }),
  revive: Object.freeze({ key: "revive", nome: "Revivir", nameKey: "medicine.revive", tipo: TIPO_ITEM.REMEDIO, compra: 1500, venda: 750, efeito: Object.freeze({ reviver: 0.5 }) }),
});

export const BOLAS = Object.freeze({
  pokeball: Object.freeze({
    key: "pokeball",
    nome: "Pokébola",
    tipo: TIPO_ITEM.BOLA,
    compra: 100,
    venda: 50,
    cor: "#ee3344",
    capturaMul: 1,
    dica: "Bola padrão. No erro fica no chão pra pegar.",
  }),
  greatball: Object.freeze({
    key: "greatball",
    nome: "Grande Bola",
    tipo: TIPO_ITEM.BOLA,
    compra: 400,
    venda: 200,
    cor: "#3b82f6",
    capturaMul: 1.5,
    dica: "Taxa de captura ×1,5.",
  }),
  ultraball: Object.freeze({
    key: "ultraball",
    nome: "Ultra Bola",
    tipo: TIPO_ITEM.BOLA,
    compra: 1200,
    venda: 600,
    cor: "#111111",
    capturaMul: 2,
    dica: "Taxa de captura ×2.",
  }),
  masterball: Object.freeze({
    key: "masterball",
    nome: "Bola Mestra",
    tipo: TIPO_ITEM.BOLA,
    compra: 0,
    venda: 0,
    cor: "#7c3aed",
    capturaMul: 255,
    dica: "Captura sempre. Grátis no Mart (teste).",
  }),
  boomerangball: Object.freeze({
    key: "boomerangball",
    nome: "Bola Bumerangue",
    tipo: TIPO_ITEM.BOLA,
    compra: 50,
    venda: 25,
    cor: "#65a30d",
    capturaMul: 1,
    returnsOnFail: true,
    dica: "Volta pra você se errar ou o Pokémon escapar.",
  }),
  premierball: Object.freeze({
    key: "premierball",
    nome: "Bola Premier",
    tipo: TIPO_ITEM.BOLA,
    compra: -1,
    venda: 50,
    cor: "#f8fafc",
    capturaMul: 1,
    dica: "Brinde: 1 a cada 10 Pokébolas na mesma compra.",
  }),
});

export const FERRAMENTAS = Object.freeze({
  hoe: Object.freeze({ key: "hoe", nome: "Enxada", nameKey: "tools.hoe", tipo: TIPO_ITEM.FERRAMENTA, cor: "#a16207", dica: "Cava grama para plantar." }),
  wateringCan: Object.freeze({ key: "wateringCan", nome: "Regador", nameKey: "tools.wateringCan", tipo: TIPO_ITEM.FERRAMENTA, cor: "#0ea5e9", dica: "Rega a planta para ela crescer." }),
  axe: Object.freeze({ key: "axe", nome: "Machado", nameKey: "tools.axe", tipo: TIPO_ITEM.FERRAMENTA, cor: "#92400e", dica: "Corta a árvore. Ela cai e vira toco." }),
  pickaxe: Object.freeze({ key: "pickaxe", nome: "Picareta", nameKey: "tools.pickaxe", tipo: TIPO_ITEM.FERRAMENTA, cor: "#64748b", dica: "Clique esquerdo quebra o bloco a até 5 tiles; aproxime para coletar. Também quebra pedra." }),
  bow: Object.freeze({ key: "bow", nome: "Arco", nameKey: "tools.bow", tipo: TIPO_ITEM.FERRAMENTA, cor: "#b45309", dica: "LMB = tiro rápido. Segure RMB para mirar/carregar; LMB ou soltar RMB dispara. Escape ou troque o slot cancela. Flechas infinitas." }),
  hammer: Object.freeze({ key: "hammer", nome: "Martelo", nameKey: "tools.hammer", tipo: TIPO_ITEM.FERRAMENTA, cor: "#78716c", dica: "Abre o catálogo dentro de casa." }),
});

export const MATERIAIS = Object.freeze({
  wood: Object.freeze({ key: "wood", nome: "Madeira", nameKey: "materials.wood", tipo: TIPO_ITEM.MATERIAL, compra: 36, venda: 18, cor: "#a16207" }),
  coal: Object.freeze({ key: "coal", nome: "Carvão", nameKey: "materials.coal", tipo: TIPO_ITEM.MATERIAL, compra: 0, venda: 28, cor: "#44403c" }),
  stone: Object.freeze({ key: "stone", nome: "Pedra", nameKey: "materials.stone", tipo: TIPO_ITEM.MATERIAL, compra: 30, venda: 15, cor: "#78716c" }),
  plantFiber: Object.freeze({ key: "plantFiber", nome: "Fibra", nameKey: "materials.plantFiber", tipo: TIPO_ITEM.MATERIAL, compra: 20, venda: 10, cor: "#65a30d" }),
  blueCrystal: Object.freeze({ key: "blueCrystal", nome: "Cristal azul", nameKey: "materials.blueCrystal", tipo: TIPO_ITEM.MATERIAL, compra: 0, venda: 40, cor: "#38bdf8" }),
  redCrystal: Object.freeze({ key: "redCrystal", nome: "Cristal vermelho", nameKey: "materials.redCrystal", tipo: TIPO_ITEM.MATERIAL, compra: 0, venda: 40, cor: "#f43f5e" }),
  yellowCrystal: Object.freeze({ key: "yellowCrystal", nome: "Cristal amarelo", nameKey: "materials.yellowCrystal", tipo: TIPO_ITEM.MATERIAL, compra: 0, venda: 40, cor: "#facc15" }),
  purpleCrystal: Object.freeze({ key: "purpleCrystal", nome: "Cristal roxo", nameKey: "materials.purpleCrystal", tipo: TIPO_ITEM.MATERIAL, compra: 0, venda: 40, cor: "#a855f7" }),
  greenCrystal: Object.freeze({ key: "greenCrystal", nome: "Cristal verde", nameKey: "materials.greenCrystal", tipo: TIPO_ITEM.MATERIAL, compra: 0, venda: 40, cor: "#22c55e" }),
  pinkCrystal: Object.freeze({ key: "pinkCrystal", nome: "Cristal rosa", nameKey: "materials.pinkCrystal", tipo: TIPO_ITEM.MATERIAL, compra: 0, venda: 40, cor: "#f9a8d4" }),
});

export const CHAVES = Object.freeze({
  pokedex: Object.freeze({
    key: "pokedex",
    nome: "Pokédex",
    tipo: TIPO_ITEM.CHAVE,
    compra: 0,
    venda: 0,
    dica: "Registra os Pokémon encontrados.",
  }),
  ballMagnet: Object.freeze({
    key: "ballMagnet",
    nome: "Ímã de Bola",
    tipo: TIPO_ITEM.CHAVE,
    compra: 200,
    venda: 0,
    unica: true,
    dica: "Puxa de volta as bolas que erram o alvo.",
  }),
  asaDelta: Object.freeze({
    key: "asaDelta",
    nome: "Asa-delta",
    tipo: TIPO_ITEM.CHAVE,
    compra: 100,
    venda: 0,
    unica: true,
    dica: "Planar a partir de precipícios.",
  }),
  expShare: Object.freeze({
    key: "expShare",
    nome: "Compartilhar EXP",
    tipo: TIPO_ITEM.CHAVE,
    compra: 200,
    venda: 0,
    unica: true,
    dica: "Divide a EXP com o time.",
  }),
});

export const ESTOQUE_LOJA = Object.freeze([
  { tipo: TIPO_ITEM.BOLA, key: "pokeball" },
  { tipo: TIPO_ITEM.BOLA, key: "greatball" },
  { tipo: TIPO_ITEM.BOLA, key: "ultraball" },
  { tipo: TIPO_ITEM.BOLA, key: "masterball" },
  { tipo: TIPO_ITEM.BOLA, key: "boomerangball" },
  { tipo: TIPO_ITEM.CHAVE, key: "ballMagnet" },
  { tipo: TIPO_ITEM.CHAVE, key: "asaDelta" },
  { tipo: TIPO_ITEM.CHAVE, key: "expShare" },
  { tipo: TIPO_ITEM.REMEDIO, key: "potion" },
  { tipo: TIPO_ITEM.REMEDIO, key: "superPotion" },
  { tipo: TIPO_ITEM.REMEDIO, key: "hyperPotion" },
  { tipo: TIPO_ITEM.REMEDIO, key: "antidote" },
  { tipo: TIPO_ITEM.REMEDIO, key: "paralyzeHeal" },
  { tipo: TIPO_ITEM.REMEDIO, key: "awakening" },
  { tipo: TIPO_ITEM.REMEDIO, key: "burnHeal" },
  { tipo: TIPO_ITEM.REMEDIO, key: "iceHeal" },
  { tipo: TIPO_ITEM.REMEDIO, key: "fullHeal" },
  { tipo: TIPO_ITEM.REMEDIO, key: "revive" },
  { tipo: TIPO_ITEM.MATERIAL, key: "wood" },
  { tipo: TIPO_ITEM.MATERIAL, key: "stone" },
]);

export const MOVEIS = Object.freeze({
  cama: Object.freeze({ key: "cama", nome: "Cama", cor: "#b45309", custo: Object.freeze({ wood: 8 }), cura: true }),
  mesa: Object.freeze({ key: "mesa", nome: "Mesa", cor: "#92400e", custo: Object.freeze({ wood: 4 }) }),
  cadeira: Object.freeze({ key: "cadeira", nome: "Cadeira", cor: "#a8a29e", custo: Object.freeze({ wood: 2 }) }),
  planta: Object.freeze({ key: "planta", nome: "Vaso", cor: "#16a34a", custo: Object.freeze({ plantFiber: 2 }) }),
  bancada: Object.freeze({ key: "bancada", nome: "Bancada", cor: "#44403c", custo: Object.freeze({ wood: 6, stone: 2 }), craft: true }),
});

export const RECEITAS_BOLA = Object.freeze({
  pokeball: Object.freeze({ key: "pokeball", nome: "Pokébola", custo: Object.freeze({ anyCrystal: 1 }) }),
  greatball: Object.freeze({ key: "greatball", nome: "Grande Bola", custo: Object.freeze({ anyCrystal: 3 }) }),
  ultraball: Object.freeze({ key: "ultraball", nome: "Ultra Bola", custo: Object.freeze({ anyCrystal: 7 }) }),
});

export const CRISTAIS = Object.freeze([
  "blueCrystal",
  "redCrystal",
  "yellowCrystal",
  "purpleCrystal",
  "greenCrystal",
  "pinkCrystal",
]);

export const PREMIER_A_CADA = 10;

export const BLOCOS = Object.freeze({
  blocoGrama: Object.freeze({ key: "blocoGrama", nome: "Bloco de grama", tipo: TIPO_ITEM.BLOCO, cor: "#5c9a45", bloco: 1 }),
  blocoTerra: Object.freeze({ key: "blocoTerra", nome: "Bloco de terra", tipo: TIPO_ITEM.BLOCO, cor: "#8a5a32", bloco: 2 }),
  blocoPedra: Object.freeze({ key: "blocoPedra", nome: "Bloco de pedra", tipo: TIPO_ITEM.BLOCO, cor: "#94a3b8", bloco: 3 }),
});

export function defItem(tipo, key) {
  if (tipo === TIPO_ITEM.BOLA) return BOLAS[key] || null;
  if (tipo === TIPO_ITEM.BERRY) return BERRIES[key] || null;
  if (tipo === TIPO_ITEM.REMEDIO) return REMEDIOS[key] || null;
  if (tipo === TIPO_ITEM.FERRAMENTA) return FERRAMENTAS[key] || null;
  if (tipo === TIPO_ITEM.MATERIAL) return MATERIAIS[key] || MATERIAIS_DROP[key] || null;
  if (tipo === TIPO_ITEM.CHAVE) return CHAVES[key] || null;
  if (tipo === TIPO_ITEM.BLOCO) return BLOCOS[key] || null;
  return null;
}

export function classificarChave(key) {
  if (BOLAS[key]) return TIPO_ITEM.BOLA;
  if (BERRIES[key]) return TIPO_ITEM.BERRY;
  if (REMEDIOS[key]) return TIPO_ITEM.REMEDIO;
  if (FERRAMENTAS[key]) return TIPO_ITEM.FERRAMENTA;
  if (MATERIAIS[key] || MATERIAIS_DROP[key]) return TIPO_ITEM.MATERIAL;
  if (CHAVES[key]) return TIPO_ITEM.CHAVE;
  if (BLOCOS[key]) return TIPO_ITEM.BLOCO;
  return TIPO_ITEM.MATERIAL;
}

export function precoCompra(tipo, key) {
  const def = defItem(tipo, key);
  if (!def) return -1;
  if (def.compra == null) return -1;
  return def.compra;
}

export function materiaisDaBolsa() {
  const mapa = {};
  const drop = Object.keys(MATERIAIS_DROP);
  for (let i = 0; i < drop.length; i++) mapa[drop[i]] = MATERIAIS_DROP[drop[i]];
  const base = Object.keys(MATERIAIS);
  for (let i = 0; i < base.length; i++) mapa[base[i]] = MATERIAIS[base[i]];
  return mapa;
}

export function precoVenda(tipo, key) {
  const def = defItem(tipo, key);
  if (!def) return 0;
  if (def.venda != null) return def.venda;
  return 0;
}
