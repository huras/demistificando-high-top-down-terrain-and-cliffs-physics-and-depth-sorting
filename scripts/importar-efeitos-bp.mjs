/**
 * Copia folhas autoradas + banco BattleParticles para assets/effects.
 * Uso: node scripts/importar-efeitos-bp.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.resolve(
  raiz,
  "..",
  "..",
  "Boardgame Projects",
  "BattleParticles",
  "assets",
  "sprites",
  "effects",
);
const dstGolpes = path.join(raiz, "assets", "effects", "golpes");
const dstBanco = path.join(raiz, "assets", "effects", "banco");

const MAPA = {
  "208_x241_y1164_w32_h160.png": "ember.png",
  "166_x274_y994_w16_h144.png": "razor-leaf.png",
  "223_x407_y1449_w32_h160.png": "bubble.png",
  "118_x150_y733_w32_h128.png": "flamethrower.png",
  "238_x66_y1667_w64_h64.png": "gust.png",
  "frozen-things-ice-block.png": "ice-block.png",
};

if (!fs.existsSync(src)) {
  console.error("BattleParticles effects não encontrado:", src);
  process.exit(1);
}
fs.mkdirSync(dstGolpes, { recursive: true });
fs.mkdirSync(dstBanco, { recursive: true });

for (const [de, para] of Object.entries(MAPA)) {
  const a = path.join(src, de);
  const b = path.join(dstGolpes, para);
  if (!fs.existsSync(a)) {
    console.warn("falta", de);
    continue;
  }
  fs.copyFileSync(a, b);
  console.log(de, "→ golpes/" + para);
}

let n = 0;
for (const nome of fs.readdirSync(src)) {
  if (!/^\d{3}_.+\.png$/i.test(nome)) continue;
  fs.copyFileSync(path.join(src, nome), path.join(dstBanco, nome));
  n += 1;
}
console.log("banco:", n, "folhas →", dstBanco);
console.log("ok");
