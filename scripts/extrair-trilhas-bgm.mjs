/**
 * Extrai audio.bgm.tracks do Pokemon AI e gera js/jogo/som/trilhasBgm.js.
 * Uso: node scripts/extrair-trilhas-bgm.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dirname, "..");
const CONFIG_AI = path.resolve(
  RAIZ,
  "..",
  "Pokemon AI",
  "src",
  "config.js"
);
const DEST = path.join(RAIZ, "js", "jogo", "som", "trilhasBgm.js");

const BIOMAS = [
  "dirty-sand",
  "light-grass",
  "lush-grass",
  "brown-earth",
  "stone",
  "snow",
  "savanna",
  "tundra",
  "autum-forest",
  "honey-trees-flower-fields",
  "ghost-forest",
  "jungle",
  "palm-jungle",
  "marsh",
  "faroeste-desert",
  "amber-rock",
  "rift-ground",
  "pewter-massif",
  "moon-ridge",
  "tunnel-hills",
  "johto-past",
  "sandy-shelf",
  "kelp-forest",
  "deep-trench",
];

function querKey(k) {
  if (k.startsWith("hub.") || k.startsWith("shrine.")) return true;
  return BIOMAS.some((b) => k === b || k.startsWith(b + "."));
}

function fixPath(p) {
  p = String(p).replace(/\\/g, "/");
  if (p.startsWith("BGM/")) return p;
  return "BGM/" + p;
}

const src = fs.readFileSync(CONFIG_AI, "utf8");
const bgmIdx = src.indexOf("bgm:");
const tracksIdx = src.indexOf("tracks:", bgmIdx);
if (tracksIdx < 0) throw new Error("tracks não encontrado em config.js");
let i = src.indexOf("{", tracksIdx);
let depth = 0;
const start = i;
for (; i < src.length; i++) {
  const c = src[i];
  if (c === "{") depth++;
  else if (c === "}") {
    depth--;
    if (depth === 0) break;
  }
}
const tracks = eval("(" + src.slice(start, i + 1) + ")");

const out = {};
for (const [k, v] of Object.entries(tracks)) {
  if (!querKey(k)) continue;
  const arr = Array.isArray(v) ? v : [v];
  out[k] = arr.map(fixPath);
}

out.campo = [
  "BGM/pool/Pokemon HeartGold and SoulSilver - Route 29.mp3",
  "BGM/pool/Pokemon Diamond and Pearl - Route 201 (Day).mp3",
  "BGM/pool/Green Plains Journey - Plains Day A.mp3",
];
out.cidade = [
  "BGM/pool/Pokemon Diamond and Pearl - Canalave City (Day).mp3",
  "BGM/pool/Pokemon Diamond and Pearl - Twinleaf Town (Day).mp3",
  "BGM/1-06. Pallet Town.mp3",
];

const keys = Object.keys(out).sort();
let code =
  "/** Catálogo BGM portado do Pokemon AI (audio.bgm.tracks). Paths sob /ref/music. */\n\n";
code += "export const TRILHAS_BGM = Object.freeze({\n";
for (const k of keys) {
  code += `  ${JSON.stringify(k)}: Object.freeze([\n`;
  for (const f of out[k]) code += `    ${JSON.stringify(f)},\n`;
  code += "  ]),\n";
}
code += "});\n\n";
code += "export function temTrilhaBgm(chave) {\n";
code += "  const pool = TRILHAS_BGM[chave];\n";
code += "  return !!(pool && pool.length);\n";
code += "}\n\n";
code += "export function poolTrilhaBgm(chave) {\n";
code += "  return TRILHAS_BGM[chave] || [];\n";
code += "}\n";

fs.mkdirSync(path.dirname(DEST), { recursive: true });
fs.writeFileSync(DEST, code);
console.log("escreveu", DEST, "keys", keys.length);
