/**
 * Extrai tabelas de evolução do Pokemon AI → js/pokemon/dados/evolucoesNivel.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dirname, "..");
const AI = path.resolve(RAIZ, "..", "Pokemon AI", "src", "data", "pokemon");
const DEST = path.join(RAIZ, "js", "pokemon", "dados", "evolucoesNivel.js");

const evoUrl = pathToFileURL(path.join(AI, "evolutions.js")).href;
const ovUrl = pathToFileURL(path.join(AI, "levelEvolutionOverrides.js")).href;

const { LEVEL_EVOLUTIONS } = await import(evoUrl);
const { LEVEL_EVOLUTION_OVERRIDES, HELD_LEVEL_EVOLUTIONS } = await import(ovUrl);

function toFrozenJs(name, obj) {
  const lines = [`export const ${name} = Object.freeze({`];
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      lines.push(`  ${JSON.stringify(k)}: Object.freeze([`);
      for (const item of v) {
        lines.push(`    Object.freeze(${JSON.stringify(item)}),`);
      }
      lines.push("  ]),");
    } else {
      lines.push(`  ${JSON.stringify(k)}: Object.freeze(${JSON.stringify(v)}),`);
    }
  }
  lines.push("});");
  lines.push("");
  return lines.join("\n");
}

fs.mkdirSync(path.dirname(DEST), { recursive: true });
let out = "/** Tabelas de evolução por nível — port do Pokemon AI. */\n\n";
out += toFrozenJs("EVOLUCOES_NIVEL", LEVEL_EVOLUTIONS);
out += toFrozenJs("EVOLUCOES_OVERRIDE", LEVEL_EVOLUTION_OVERRIDES);
out += toFrozenJs("EVOLUCOES_HELD", HELD_LEVEL_EVOLUTIONS);
fs.writeFileSync(DEST, out);
console.log(
  "escreveu",
  DEST,
  "nivel",
  Object.keys(LEVEL_EVOLUTIONS).length,
  "override",
  Object.keys(LEVEL_EVOLUTION_OVERRIDES).length
);
