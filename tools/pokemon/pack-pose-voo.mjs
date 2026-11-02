/**
 * Copia strips aéreas (FlapAround/Hover/Hop/Float) do SpriteCollab → overworld.
 * Mescla blocos <Anim> no AnimData.xml existente.
 *
 *   node tools/pokemon/pack-pose-voo.mjs
 *   node tools/pokemon/pack-pose-voo.mjs 21 396 398
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CADEIA_VOO,
  DENY_COPY,
  SHEET_SUFFIXES,
  padDex3,
  padDex4,
  parseAnimCopyMap,
  poseInfo,
  resolveAnimAssetName,
} from "./pmdAnimXml.mjs";
import { FLAP_ENTRIES } from "../../js/pokemon/habitat/flapCatalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dirname, "../..");
const OVERWORLD = path.resolve(RAIZ, "../Pokemon AI/sprites/pokemon/overworld");
const COLLAB = "H:/cursor/Youtube/SpriteCollab/sprite";

function extrairBlocosAnim(xmlText) {
  /** @type {Map<string, string>} */
  const blocos = new Map();
  const animRe = /<Anim>([\s\S]*?)<\/Anim>/g;
  let m;
  while ((m = animRe.exec(xmlText))) {
    const inner = m[1];
    const name = inner.match(/<Name>\s*([^<]+?)\s*<\/Name>/)?.[1]?.trim();
    if (!name) continue;
    blocos.set(name, `<Anim>${inner}</Anim>`);
  }
  return blocos;
}

function mesclarAnimData(destXml, srcXml) {
  const destBlocos = extrairBlocosAnim(destXml);
  const srcBlocos = extrairBlocosAnim(srcXml);
  let mudou = false;
  for (const pose of CADEIA_VOO) {
    const bloco = srcBlocos.get(pose);
    if (!bloco) continue;
    if (destBlocos.has(pose)) continue;
    destBlocos.set(pose, bloco);
    mudou = true;
  }
  if (!mudou) return null;
  const corpo = [...destBlocos.values()].join("\n");
  if (/<Anims>[\s\S]*<\/Anims>/.test(destXml)) {
    return destXml.replace(/<Anims>[\s\S]*<\/Anims>/, `<Anims>\n${corpo}\n</Anims>`);
  }
  return `<?xml version="1.0" ?>\n<AnimData>\n<Anims>\n${corpo}\n</Anims>\n</AnimData>\n`;
}

function copiarSheets(srcDir, destDir, copyMap) {
  let n = 0;
  const assets = new Set();
  for (const pose of CADEIA_VOO) {
    if (!(pose in copyMap)) continue;
    const asset = resolveAnimAssetName(pose, copyMap);
    if (DENY_COPY.has(asset) || (copyMap[pose] && DENY_COPY.has(copyMap[pose]))) continue;
    assets.add(asset);
  }
  for (const asset of assets) {
    for (const suf of SHEET_SUFFIXES) {
      const nome = `${asset}${suf}`;
      const from = path.join(srcDir, nome);
      const to = path.join(destDir, nome);
      if (!fs.existsSync(from)) continue;
      if (fs.existsSync(to)) continue;
      fs.copyFileSync(from, to);
      n += 1;
    }
  }
  return n;
}

function empacotar(dex) {
  const id3 = padDex3(dex);
  const src = path.join(COLLAB, padDex4(dex));
  const dest = path.join(OVERWORLD, id3);
  const srcXml = path.join(src, "AnimData.xml");
  const destXml = path.join(dest, "AnimData.xml");
  if (!fs.existsSync(srcXml)) return { dex, ok: false, motivo: "sem collab" };
  if (!fs.existsSync(destXml)) return { dex, ok: false, motivo: "sem overworld" };

  const srcText = fs.readFileSync(srcXml, "utf8");
  const destText = fs.readFileSync(destXml, "utf8");
  const copyMap = parseAnimCopyMap(srcText);
  fs.mkdirSync(dest, { recursive: true });
  const sheets = copiarSheets(src, dest, copyMap);
  const merged = mesclarAnimData(destText, srcText);
  if (merged) fs.writeFileSync(destXml, merged, "utf8");

  const melhor = CADEIA_VOO.map((p) => ({ p, ...poseInfo(dest, p) })).find(
    (i) => i.sheet && !i.denied,
  );
  return {
    dex,
    ok: !!melhor?.sheet,
    sheets,
    xml: !!merged,
    pose: melhor?.p || null,
  };
}

function main() {
  const args = process.argv.slice(2).map((a) => parseInt(a, 10)).filter((n) => n > 0);
  const dexes = args.length
    ? args
    : FLAP_ENTRIES.map((e) => e.dex);
  console.log(`overworld ← SpriteCollab (${dexes.length} dex)`);
  let ok = 0;
  for (const dex of dexes) {
    const r = empacotar(dex);
    if (r.ok) ok += 1;
    console.log(
      `  #${padDex3(dex)} sheets+${r.sheets || 0}${r.xml ? " xml" : ""} ${r.ok ? "ok" : r.motivo || "falhou"}`,
    );
  }
  console.log(`pronto: ${ok}/${dexes.length}`);
}

main();
