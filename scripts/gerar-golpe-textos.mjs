/**
 * Baixa flavor/efeito de golpes da PokeAPI (CSV) e gera js/pokemon/dados/golpeTextos.js.
 * Uso: node scripts/gerar-golpe-textos.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAIZ_REF = process.env.RAIZ_REF
  ? path.resolve(process.env.RAIZ_REF)
  : path.resolve(ROOT, "..", "Pokemon AI");
const OUT = path.join(ROOT, "js", "pokemon", "dados", "golpeTextos.js");
const CSV_BASE =
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv";

const LANG = Object.freeze({
  en: 9,
  es: 7,
  fr: 5,
  de: 6,
  ja: 11,
  jaHrkt: 1,
  zh: 12,
});
const LANG_KEYS = Object.freeze(["en", "es", "fr", "de", "ja", "zh"]);

/** Preferência: gens recentes com texto completo → clássicos. */
const FLAVOR_VG_PRIORITY = Object.freeze([
  20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3,
]);

const JS_RESERVED = new Set([
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "null",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "enum",
  "await",
  "let",
  "static",
]);

function toCamelKey(name) {
  const parts = String(name ?? "")
    .replace(/['.]/g, "")
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
  if (!parts.length) return "";
  return parts
    .map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join("");
}

function emitJsKey(key) {
  const k = String(key);
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) && !JS_RESERVED.has(k)) return k;
  return JSON.stringify(k);
}

function cleanFlavor(text) {
  return String(text ?? "")
    .replace(/\f/g, " ")
    .replace(/[\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** CSV mínimo (campos entre aspas com quebra de linha). */
function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;
  let headers = null;

  const readRow = () => {
    const cells = [];
    while (i < len) {
      if (text[i] === '"') {
        i += 1;
        let cell = "";
        while (i < len) {
          if (text[i] === '"') {
            if (text[i + 1] === '"') {
              cell += '"';
              i += 2;
              continue;
            }
            i += 1;
            break;
          }
          cell += text[i];
          i += 1;
        }
        cells.push(cell);
        if (text[i] === ",") {
          i += 1;
          continue;
        }
        if (text[i] === "\r") i += 1;
        if (text[i] === "\n") i += 1;
        break;
      }
      const start = i;
      while (i < len && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") {
        i += 1;
      }
      cells.push(text.slice(start, i));
      if (text[i] === ",") {
        i += 1;
        continue;
      }
      if (text[i] === "\r") i += 1;
      if (text[i] === "\n") i += 1;
      break;
    }
    return cells;
  };

  while (i < len) {
    if (text[i] === "\r" || text[i] === "\n") {
      i += 1;
      continue;
    }
    const cells = readRow();
    if (!headers) {
      headers = cells;
      continue;
    }
    if (cells.length === 1 && cells[0] === "") continue;
    const row = {};
    for (let c = 0; c < headers.length; c += 1) {
      row[headers[c]] = cells[c] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

function emitLangDict(dict) {
  const parts = [];
  for (const key of LANG_KEYS) {
    if (dict[key]) parts.push(`${key}: ${JSON.stringify(dict[key])}`);
  }
  return `Object.freeze({ ${parts.join(", ")} })`;
}

function pickFromVersions(versions) {
  if (!versions) return "";
  for (const vg of FLAVOR_VG_PRIORITY) {
    const hit = versions.get(vg);
    if (hit) return cleanFlavor(hit);
  }
  for (const text of versions.values()) {
    const cleaned = cleanFlavor(text);
    if (cleaned) return cleaned;
  }
  return "";
}

async function main() {
  const movesPath = path.join(RAIZ_REF, "src", "data", "pokemon", "moves.js");
  if (!fs.existsSync(movesPath)) {
    throw new Error(`moves.js não encontrado em ${movesPath} (defina RAIZ_REF)`);
  }
  const movesMod = await import(pathToFileURL(movesPath).href);
  const wanted = new Set(Object.keys(movesMod.GENERATED_MOVES || {}));
  if (!wanted.size) throw new Error("GENERATED_MOVES vazio");

  console.log(`Buscando CSV PokeAPI para ${wanted.size} golpes…`);
  const [movesCsv, flavorCsv, effectCsv] = await Promise.all([
    fetchText(`${CSV_BASE}/moves.csv`),
    fetchText(`${CSV_BASE}/move_flavor_text.csv`),
    fetchText(`${CSV_BASE}/move_effect_prose.csv`),
  ]);

  /** @type {Map<string, number>} */
  const idByKey = new Map();
  /** @type {Map<number, number>} */
  const effectIdByMove = new Map();
  for (const row of parseCsv(movesCsv)) {
    const key = toCamelKey(row.identifier);
    if (!wanted.has(key)) continue;
    const id = Number(row.id);
    idByKey.set(key, id);
    effectIdByMove.set(id, Number(row.effect_id) || 0);
  }

  const idSet = new Set(idByKey.values());
  /** flavor[moveId][langId][vgId] */
  /** @type {Map<number, Map<number, Map<number, string>>>} */
  const flavorByMove = new Map();
  for (const row of parseCsv(flavorCsv)) {
    const id = Number(row.move_id);
    if (!idSet.has(id)) continue;
    const lang = Number(row.language_id);
    const vg = Number(row.version_group_id);
    if (!flavorByMove.has(id)) flavorByMove.set(id, new Map());
    const byLang = flavorByMove.get(id);
    if (!byLang.has(lang)) byLang.set(lang, new Map());
    byLang.get(lang).set(vg, row.flavor_text ?? "");
  }

  /** effect[effectId][langId] = short_effect */
  /** @type {Map<number, Map<number, string>>} */
  const effectById = new Map();
  for (const row of parseCsv(effectCsv)) {
    const eid = Number(row.move_effect_id);
    const lang = Number(row.local_language_id);
    if (!effectById.has(eid)) effectById.set(eid, new Map());
    effectById.get(eid).set(lang, row.short_effect ?? "");
  }

  function pickFlavor(moveId, langId, fallbackLangId = 0) {
    const byLang = flavorByMove.get(moveId);
    return (
      pickFromVersions(byLang?.get(langId)) ||
      pickFromVersions(byLang?.get(fallbackLangId))
    );
  }

  function pickEffect(moveId, langId) {
    const eid = effectIdByMove.get(moveId) || 0;
    const byLang = effectById.get(eid);
    if (!byLang) return "";
    return (
      cleanFlavor(byLang.get(langId) || "") ||
      cleanFlavor(byLang.get(LANG.en) || "")
    );
  }

  const keys = [...wanted].sort((a, b) => a.localeCompare(b));
  let comTexto = 0;
  let body = `/** Auto-gerado da PokeAPI (flavor + short effect). Não editar à mão.
 * Regenerar: node scripts/gerar-golpe-textos.mjs
 */
import { pickDexText } from "./golpeLocale.js";

export const GOLPE_TEXTOS = Object.freeze({
`;

  for (const key of keys) {
    const id = idByKey.get(key);
    if (!id) continue;
    /** @type {Record<string, string>} */
    const flavor = {};
    const en = pickFlavor(id, LANG.en) || pickEffect(id, LANG.en);
    if (en) flavor.en = en;
    for (const langKey of LANG_KEYS) {
      if (langKey === "en") continue;
      const fallback = langKey === "ja" ? LANG.jaHrkt : 0;
      const text =
        pickFlavor(id, LANG[langKey], fallback) || pickEffect(id, LANG[langKey]);
      if (text) flavor[langKey] = text;
    }
    if (!Object.keys(flavor).length) continue;
    comTexto += 1;
    body += `  ${emitJsKey(key)}: ${emitLangDict(flavor)},\n`;
  }

  body += `});

/**
 * @param {string} key
 * @param {string} [locale]
 */
export function getGolpeTexto(key, locale = "en") {
  return pickDexText(GOLPE_TEXTOS[key], locale) || "";
}
`;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  // golpeLocale: espelho enxuto do dexLocale (pt-BR → en)
  const localePath = path.join(path.dirname(OUT), "golpeLocale.js");
  fs.writeFileSync(
    localePath,
    `/** Locale → chave de texto de golpe (PokeAPI não tem pt-BR). */
export function golpeLocaleLang(locale = "en") {
  switch (String(locale ?? "en")) {
    case "es":
      return "es";
    case "fr":
      return "fr";
    case "de":
      return "de";
    case "ja":
      return "ja";
    case "zh-CN":
    case "zh":
      return "zh";
    default:
      return "en";
  }
}

/**
 * @param {Record<string, string> | null | undefined} dict
 * @param {string} [locale]
 */
export function pickDexText(dict, locale) {
  if (!dict) return "";
  const lang = golpeLocaleLang(locale);
  return dict[lang] || dict.en || dict.es || "";
}
`,
    "utf8",
  );
  fs.writeFileSync(OUT, body, "utf8");
  console.log(
    `OK: ${comTexto}/${wanted.size} golpes com texto → ${path.relative(ROOT, OUT)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
