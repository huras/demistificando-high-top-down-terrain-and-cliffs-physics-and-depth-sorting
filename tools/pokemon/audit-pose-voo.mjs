/**
 * Audita poses aéreas (FlapAround/Hover/Hop/Float) no SpriteCollab + overworld.
 *
 *   node tools/pokemon/audit-pose-voo.mjs
 *   node tools/pokemon/audit-pose-voo.mjs --write
 *
 * --write regenera js/pokemon/habitat/flapCatalog.js com entradas que têm sheet real.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CADEIA_VOO,
  melhorPoseVoo,
  padDex3,
  padDex4,
  poseInfo,
} from "./pmdAnimXml.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dirname, "../..");
const OVERWORLD = path.resolve(RAIZ, "../Pokemon AI/sprites/pokemon/overworld");
const COLLAB = "H:/cursor/Youtube/SpriteCollab/sprite";
const CATALOGO = path.join(RAIZ, "js/pokemon/habitat/flapCatalog.js");

/** Candidatos conhecidos (sky + HIGH); audit confirma sheet. */
const CANDIDATOS = Object.freeze([
  { dex: 12, key: "butterfree" },
  { dex: 16, key: "pidgey" },
  { dex: 17, key: "pidgeotto" },
  { dex: 18, key: "pidgeot" },
  { dex: 21, key: "spearow" },
  { dex: 22, key: "fearow" },
  { dex: 41, key: "zubat" },
  { dex: 42, key: "golbat" },
  { dex: 49, key: "venomoth" },
  { dex: 142, key: "aerodactyl" },
  { dex: 169, key: "crobat" },
  { dex: 176, key: "togetic" },
  { dex: 198, key: "murkrow" },
  { dex: 226, key: "mantine" },
  { dex: 267, key: "beautifly" },
  { dex: 269, key: "dustox" },
  { dex: 276, key: "taillow" },
  { dex: 277, key: "swellow" },
  { dex: 278, key: "wingull" },
  { dex: 279, key: "pelipper" },
  { dex: 284, key: "masquerain" },
  { dex: 330, key: "flygon" },
  { dex: 333, key: "swablu" },
  { dex: 334, key: "altaria" },
  { dex: 396, key: "starly" },
  { dex: 397, key: "staravia" },
  { dex: 398, key: "staraptor" },
  { dex: 430, key: "honchkrow" },
  { dex: 468, key: "togekiss" },
]);

const DENY = Object.freeze([187, 188, 189, 247, 349]);

function collabDir(dex) {
  return path.join(COLLAB, padDex4(dex));
}

function overworldDir(dex) {
  return path.join(OVERWORLD, padDex3(dex));
}

function auditar(row) {
  const collab = melhorPoseVoo(collabDir(row.dex));
  const game = melhorPoseVoo(overworldDir(row.dex));
  const poses = {};
  for (const pose of CADEIA_VOO) {
    poses[pose] = {
      collab: poseInfo(collabDir(row.dex), pose),
      game: poseInfo(overworldDir(row.dex), pose),
    };
  }
  return { ...row, collab, game, poses };
}

function gerarCatalogo(ok) {
  const linhas = ok
    .map(
      (e) =>
        `  Object.freeze({ dex: ${e.dex}, key: "${e.key}" }), // ${e.collab?.pose || e.game?.pose}`,
    )
    .join("\n");
  return `/**
 * Catálogo congelado de pose aérea (FlapAround | Hover | Hop | Float).
 * Gate de asset ≠ tipo Flying. Gerado por tools/pokemon/audit-pose-voo.mjs --write.
 */

/** Dex sem pose aérea real (CopyOf Twirl / Rotate / Dance). */
export const FLAP_DENY_DEX = Object.freeze(
  new Set([
    187, // Hoppip
    188, // Skiploom
    189, // Jumpluff
    247, // Pupitar
    349, // Feebas
  ]),
);

/**
 * Allowlist com strip aérea confirmada no SpriteCollab (e/ou overworld).
 * @type {readonly { dex: number, key: string }[]}
 */
export const FLAP_ENTRIES = Object.freeze([
${linhas}
]);

/** Alias semântico — pose aérea, não só FlapAround. */
export const FLIGHT_POSE_ENTRIES = FLAP_ENTRIES;

/** @type {ReadonlySet<number>} */
export const FLAP_DEXES = Object.freeze(new Set(FLAP_ENTRIES.map((e) => e.dex)));
export const FLIGHT_POSE_DEXES = FLAP_DEXES;

/** @type {ReadonlyMap<string, number>} */
const KEY_PARA_DEX = new Map(FLAP_ENTRIES.map((e) => [e.key, e.dex]));

/**
 * @param {number} dex
 */
export function dexTemPoseVoo(dex) {
  const n = Math.floor(Number(dex));
  if (!Number.isFinite(n) || n <= 0) return false;
  if (FLAP_DENY_DEX.has(n)) return false;
  return FLAP_DEXES.has(n);
}

/** @deprecated use dexTemPoseVoo */
export const dexTemFlapAround = dexTemPoseVoo;

/**
 * @param {string} key
 */
export function chaveTemPoseVoo(key) {
  const k = String(key || "").toLowerCase();
  if (!k) return false;
  const dex = KEY_PARA_DEX.get(k);
  if (dex == null) return false;
  return dexTemPoseVoo(dex);
}

/** @deprecated use chaveTemPoseVoo */
export const chaveTemFlapAround = chaveTemPoseVoo;

/**
 * @param {number} [rng] 0..1
 * @param {readonly { dex: number, key: string }[] | null} [pool]
 */
export function sortearFlapEntry(rng = Math.random(), pool = null) {
  const list = Array.isArray(pool) && pool.length > 0 ? pool : FLAP_ENTRIES;
  if (!list.length) return null;
  const t = Number.isFinite(rng) ? Math.max(0, Math.min(0.999999, rng)) : Math.random();
  return list[Math.floor(t * list.length)] ?? list[0];
}

export const sortearPoseVooEntry = sortearFlapEntry;
`;
}

function main() {
  const write = process.argv.includes("--write");
  console.log(`overworld: ${OVERWORLD} (${fs.existsSync(OVERWORLD) ? "ok" : "ausente"})`);
  console.log(`SpriteCollab: ${COLLAB} (${fs.existsSync(COLLAB) ? "ok" : "ausente"})`);
  console.log("");

  const ok = [];
  const falha = [];
  for (const row of CANDIDATOS) {
    if (DENY.includes(row.dex)) continue;
    const a = auditar(row);
    const pose = a.collab || a.game;
    if (pose) {
      ok.push({ ...a, melhor: pose });
      const packOk = a.game ? "pack" : "só collab";
      console.log(
        `  #${padDex3(a.dex)} ${a.key.padEnd(12)} ${pose.pose.padEnd(11)} ${packOk}`,
      );
    } else {
      falha.push(a);
      console.log(`  #${padDex3(a.dex)} ${a.key.padEnd(12)} SEM pose aérea`);
    }
  }

  console.log("");
  console.log(`ok: ${ok.length} · falha: ${falha.length}`);

  if (write) {
    fs.writeFileSync(CATALOGO, gerarCatalogo(ok), "utf8");
    console.log(`escrito: ${CATALOGO}`);
  }
}

main();
