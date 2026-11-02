/**
 * Parse AnimData.xml PMD (CopyOf) — compartilhado audit/pack/bake.
 */
import fs from "node:fs";
import path from "node:path";

export const CADEIA_VOO = Object.freeze(["FlapAround", "Hover", "Hop", "Float"]);
export const DENY_COPY = Object.freeze(new Set(["Twirl", "Rotate", "Dance"]));
export const SHEET_SUFFIXES = Object.freeze(["-Anim.png", "-Offsets.png", "-Shadow.png"]);

/**
 * @param {string} xmlText
 * @returns {Record<string, string|null>}
 */
export function parseAnimCopyMap(xmlText) {
  const map = Object.create(null);
  const animRe = /<Anim>([\s\S]*?)<\/Anim>/g;
  let m;
  while ((m = animRe.exec(xmlText))) {
    const block = m[1];
    const name = block.match(/<Name>\s*([^<]+?)\s*<\/Name>/)?.[1]?.trim();
    if (!name) continue;
    map[name] = block.match(/<CopyOf>\s*([^<]+?)\s*<\/CopyOf>/)?.[1]?.trim() || null;
  }
  return map;
}

/**
 * @param {string} name
 * @param {Record<string, string|null>} copyMap
 */
export function resolveAnimAssetName(name, copyMap) {
  const seen = new Set();
  let n = name;
  while (n && !seen.has(n)) {
    seen.add(n);
    const next = copyMap[n];
    if (!next) break;
    n = next;
  }
  return n;
}

/**
 * @param {string} dir
 * @param {string} pose
 */
export function poseInfo(dir, pose) {
  const xmlPath = path.join(dir, "AnimData.xml");
  if (!fs.existsSync(xmlPath)) {
    return { has: false, asset: null, copyOf: null, sheet: false, denied: false };
  }
  const map = parseAnimCopyMap(fs.readFileSync(xmlPath, "utf8"));
  if (!(pose in map)) {
    return { has: false, asset: null, copyOf: null, sheet: false, denied: false };
  }
  const copyOf = map[pose];
  const asset = resolveAnimAssetName(pose, map);
  const denied = !!(copyOf && DENY_COPY.has(copyOf)) || DENY_COPY.has(asset);
  const sheet = fs.existsSync(path.join(dir, `${asset}-Anim.png`));
  return { has: true, asset, copyOf, sheet, denied };
}

/**
 * Melhor pose aérea válida (sheet real, não denylist).
 * @param {string} dir
 * @returns {{ pose: string, asset: string } | null}
 */
export function melhorPoseVoo(dir) {
  for (let i = 0; i < CADEIA_VOO.length; i++) {
    const pose = CADEIA_VOO[i];
    const info = poseInfo(dir, pose);
    if (!info.has || info.denied || !info.sheet) continue;
    return { pose, asset: info.asset };
  }
  return null;
}

export function padDex3(dex) {
  return String(parseInt(dex, 10) || 0).padStart(3, "0");
}

export function padDex4(dex) {
  return String(parseInt(dex, 10) || 0).padStart(4, "0");
}
