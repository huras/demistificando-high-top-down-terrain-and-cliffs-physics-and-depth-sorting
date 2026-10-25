/**
 * Copia texturas Desktop do Elemental Free e gera assets/efeitos/elemental.json
 * com layout de folha (cols/rows) — NÃO trata tudo como frame único.
 * Uso: node scripts/importar-elemental-free.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.resolve(
  raiz,
  "..",
  "..",
  "Unity Projects",
  "SoPraPegarOElementals",
  "Assets",
  "Elemental Free",
  "Desktop",
  "Textures",
);
const dstRoot = path.join(raiz, "assets", "effects", "elemental");
const jsonPath = path.join(raiz, "assets", "efeitos", "elemental.json");

const PASTAS = [
  { de: "Additive", para: "additive", blend: "additive" },
  { de: "Alpha Blended", para: "alpha", blend: "alpha" },
];

/**
 * Layout real das folhas (inspecionado + tilesX/Y dos prefabs Unity).
 * anim:
 *  - flipbook  = cicla frames pela idade
 *  - variacao  = escolhe 1 tile ao emitir (Thunder)
 *  - estatico  = 1x1
 */
const FOLHAS = {
  Thunder_01: { cols: 1, rows: 4, anim: "variacao" },
  Thunder_02: { cols: 1, rows: 4, anim: "variacao" },
  Thunder_03: { cols: 1, rows: 4, anim: "variacao" },
  Fire_01: { cols: 2, rows: 2, anim: "flipbook" },
  Fire_02: { cols: 2, rows: 2, anim: "flipbook" },
  Flame_01: { cols: 2, rows: 2, anim: "flipbook" },
  Explode_01: { cols: 2, rows: 2, anim: "flipbook" },
  Explode_02: { cols: 2, rows: 2, anim: "flipbook" },
  Lava_01: { cols: 2, rows: 2, anim: "flipbook" },
  Burst_01: { cols: 1, rows: 1, anim: "estatico" },
  Burst_02: { cols: 1, rows: 1, anim: "estatico" },
  Crack_01: { cols: 1, rows: 1, anim: "estatico" },
  Wind_01: { cols: 1, rows: 1, anim: "estatico" },
  Heat_01: { cols: 1, rows: 1, anim: "estatico" },
  Fog_01: { cols: 1, rows: 1, anim: "estatico" },
  Glow_01: { cols: 1, rows: 1, anim: "estatico" },
  Ray_01: { cols: 1, rows: 1, anim: "estatico" },
  Ray_02: { cols: 1, rows: 1, anim: "estatico" },
  Ray_03: { cols: 1, rows: 1, anim: "estatico" },
  Ray_04: { cols: 1, rows: 1, anim: "estatico" },
  Ring_01: { cols: 1, rows: 1, anim: "estatico" },
  Ring_02: { cols: 1, rows: 1, anim: "estatico" },
  Ring_03: { cols: 1, rows: 1, anim: "estatico" },
  Sparkle_01: { cols: 1, rows: 1, anim: "estatico" },
  Sparkle_02: { cols: 1, rows: 1, anim: "estatico" },
  Sparkle_03: { cols: 1, rows: 1, anim: "estatico" },
  Flagment_01: { cols: 1, rows: 1, anim: "estatico" },
  SnowFlake_01: { cols: 1, rows: 1, anim: "estatico" },
  Smoke_01: { cols: 1, rows: 1, anim: "estatico" },
  Smoke_02: { cols: 1, rows: 1, anim: "estatico" },
  Stream_01: { cols: 1, rows: 1, anim: "estatico" },
  Water_01: { cols: 1, rows: 1, anim: "estatico" },
  Water_02: { cols: 1, rows: 1, anim: "estatico" },
  Ice_01: { cols: 1, rows: 1, anim: "estatico" },
  Cloud_01: { cols: 1, rows: 1, anim: "estatico" },
  DarkGlow_01: { cols: 1, rows: 1, anim: "estatico" },
  Dust_01: { cols: 1, rows: 1, anim: "estatico" },
  Mud_01: { cols: 1, rows: 1, anim: "estatico" },
  MudRipple_01: { cols: 1, rows: 1, anim: "estatico" },
  RainRipple_01: { cols: 1, rows: 1, anim: "estatico" },
  RainSplash_01: { cols: 1, rows: 1, anim: "estatico" },
  Raindrop_01: { cols: 1, rows: 1, anim: "estatico" },
  Rock_01: { cols: 1, rows: 1, anim: "estatico" },
  SnowFloor_01: { cols: 1, rows: 1, anim: "estatico" },
};

function tamanhoSugerido(id) {
  if (/Thunder|Ray|Stream|Wind/i.test(id)) return 0.55;
  if (/Explode|Burst|Ring|Lava/i.test(id)) return 0.45;
  if (/Fire|Flame|Heat|Glow|Sparkle/i.test(id)) return 0.32;
  if (/Smoke|Fog|Cloud|Dust/i.test(id)) return 0.4;
  if (/Water|Ice|Snow|Mud|Rain/i.test(id)) return 0.35;
  return 0.3;
}

function layoutDa(id) {
  const L = FOLHAS[id] || { cols: 1, rows: 1, anim: "estatico" };
  return {
    cols: L.cols || 1,
    rows: L.rows || 1,
    frames: (L.cols || 1) * (L.rows || 1),
    anim: L.anim || "estatico",
  };
}

if (!fs.existsSync(srcRoot)) {
  console.error("Elemental Free Desktop Textures não encontrado:", srcRoot);
  process.exit(1);
}

fs.mkdirSync(path.join(dstRoot, "additive"), { recursive: true });
fs.mkdirSync(path.join(dstRoot, "alpha"), { recursive: true });
fs.mkdirSync(path.dirname(jsonPath), { recursive: true });

/** @type {Record<string, object>} */
const texturas = {};

for (const pasta of PASTAS) {
  const dir = path.join(srcRoot, pasta.de);
  if (!fs.existsSync(dir)) {
    console.warn("falta pasta", dir);
    continue;
  }
  for (const nome of fs.readdirSync(dir)) {
    if (!nome.toLowerCase().endsWith(".png")) continue;
    const m = /^ETF_Texture_(.+)\.png$/i.exec(nome);
    const id = m ? m[1] : nome.replace(/\.png$/i, "");
    const destNome = `${id}.png`;
    const dest = path.join(dstRoot, pasta.para, destNome);
    fs.copyFileSync(path.join(dir, nome), dest);
    const lay = layoutDa(id);
    texturas[id] = {
      id,
      path: `assets/effects/elemental/${pasta.para}/${destNome}`,
      blend: pasta.blend,
      tam: tamanhoSugerido(id),
      cols: lay.cols,
      rows: lay.rows,
      frames: lay.frames,
      anim: lay.anim,
    };
    console.log(
      nome,
      "→",
      texturas[id].path,
      `${lay.cols}x${lay.rows}`,
      lay.anim,
    );
  }
}

const catalogo = {
  versao: 2,
  origem: "Elemental Free 1.2.6 Desktop",
  quentes: [
    "Fire_01",
    "Fire_02",
    "Flame_01",
    "Heat_01",
    "Explode_01",
    "Explode_02",
    "Burst_01",
    "Burst_02",
    "Ray_01",
    "Ray_02",
    "Ray_03",
    "Ring_01",
    "Ring_02",
    "Sparkle_01",
    "Sparkle_02",
    "Thunder_01",
    "Thunder_02",
    "Thunder_03",
    "Glow_01",
    "Smoke_01",
    "Smoke_02",
    "Stream_01",
    "Water_01",
    "Water_02",
    "Ice_01",
    "Wind_01",
  ],
  porTipo: {
    fire: { rastro: "Flame_01", impacto: "Explode_01", anel: "Ring_01", faisca: "Sparkle_01" },
    water: { rastro: "Stream_01", impacto: "Water_01", anel: "Ring_02", faisca: "Sparkle_02" },
    electric: { rastro: "Thunder_01", impacto: "Thunder_02", anel: "Ring_01", faisca: "Sparkle_01" },
    ice: { rastro: "Ice_01", impacto: "Ice_01", anel: "Ring_03", faisca: "SnowFlake_01" },
    grass: { rastro: "Glow_01", impacto: "Burst_01", anel: "Ring_02", faisca: "Sparkle_02" },
    normal: { rastro: "Glow_01", impacto: "Burst_01", anel: "Ring_01", faisca: "Sparkle_01" },
    psychic: { rastro: "Ray_02", impacto: "Glow_01", anel: "Ring_02", faisca: "Sparkle_03" },
    flying: { rastro: "Wind_01", impacto: "Burst_02", anel: "Ring_01", faisca: "Sparkle_01" },
  },
  texturas,
};

fs.writeFileSync(jsonPath, JSON.stringify(catalogo, null, 2));
console.log("ok", Object.keys(texturas).length, "texturas →", jsonPath);
