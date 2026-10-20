/**
 * Assa o overworld (8192²) para PNG + veg chunked.
 * Rode de novo se mudar relevo, bioma, kit ou layout de cidade.
 *
 * Flags: --so-visao | --so-veg | --tiles tx0:tx1,ty0:ty1
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { definirCatalogo } from "../../mundo/bioma/catalogo.js";
import { definirDetalhe } from "../../mundo/bioma/detalhe.js";
import { definirKits } from "../../mundo/bioma/kits.js";
import { byteNoPonto } from "./amostra.js";
import {
  GRADE_TILE,
  GRADE_VEG,
  LADO_MUNDO,
  LADO_TILE,
  LADO_TILE_MUNDO,
  LADO_VEG_CHUNK,
  LADO_VISAO,
  PASSO_TILE,
  PASSO_VISAO,
  SEMENTE_MAPA,
} from "./grade.js";
import { pintarFaixa, sombrearLinha } from "./sombrear.js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const pasta = path.join(raiz, "assets", "mapa", "mundo");
const workerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "assarMapaWorker.mjs");

function lerJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(raiz, rel), "utf8"));
}

function gravarPng(caminho, lado, data) {
  const png = new PNG({ width: lado, height: lado });
  png.data.set(data);
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, PNG.sync.write(png));
}

function assar(lado, origemX, origemY, passo, comMote, rotulo) {
  const data = new Uint8ClampedArray(lado * lado * 4);
  const altura = new Float32Array(lado * lado);
  const costa = new Float32Array(lado * lado);
  const t0 = Date.now();
  for (let y = 0; y < lado; y += 64) {
    const fim = Math.min(lado, y + 64);
    pintarFaixa(data, altura, costa, y, fim, lado, origemX, origemY, passo, comMote);
    console.log(`${rotulo} ${fim}/${lado}`);
  }
  for (let y = 0; y < lado; y++) sombrearLinha(data, altura, costa, y, lado, passo);
  console.log(`${rotulo} sombra ${(Date.now() - t0) / 1000}s`);
  return data;
}

function parseArgs(argv) {
  const out = { soVisao: false, soVeg: false, tiles: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--so-visao") out.soVisao = true;
    else if (a === "--so-veg") out.soVeg = true;
    else if (a === "--tiles" && argv[i + 1]) {
      const m = /^(\d+):(\d+),(\d+):(\d+)$/.exec(argv[++i]);
      if (m) out.tiles = { tx0: +m[1], tx1: +m[2], ty0: +m[3], ty1: +m[4] };
    }
  }
  return out;
}

function assarVegChunk(vx, vy) {
  const dados = new Uint8Array(LADO_VEG_CHUNK * LADO_VEG_CHUNK);
  const ox = vx * LADO_VEG_CHUNK;
  const oy = vy * LADO_VEG_CHUNK;
  for (let y = 0; y < LADO_VEG_CHUNK; y++) {
    const o = y * LADO_VEG_CHUNK;
    const wy = oy + y + 0.5;
    for (let x = 0; x < LADO_VEG_CHUNK; x++) {
      dados[o + x] = byteNoPonto(ox + x + 0.5, wy);
    }
  }
  const destino = path.join(pasta, "veg", `${vx}_${vy}.bin.gz`);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, zlib.gzipSync(dados));
}

function assarVeg() {
  const t0 = Date.now();
  for (let vy = 0; vy < GRADE_VEG; vy++) {
    for (let vx = 0; vx < GRADE_VEG; vx++) {
      assarVegChunk(vx, vy);
      console.log(`veg ${vx},${vy} / ${GRADE_VEG}x${GRADE_VEG}`);
    }
  }
  console.log(`veg total ${(Date.now() - t0) / 1000}s`);
}

function pintarTileWorker(tx, ty) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, {
      workerData: {
        raiz,
        tx,
        ty,
        lado: LADO_TILE,
        origemX: tx * LADO_TILE_MUNDO,
        origemY: ty * LADO_TILE_MUNDO,
        passo: PASSO_TILE,
      },
    });
    worker.on("message", (msg) => {
      if (msg.erro) reject(new Error(msg.erro));
      else resolve(Buffer.from(msg.data));
    });
    worker.on("error", reject);
  });
}

async function assarTiles(tx0, tx1, ty0, ty1) {
  const jobs = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) jobs.push({ tx, ty });
  }
  const nWorkers = Math.max(1, Math.min(os.cpus().length - 1, 6, jobs.length));
  console.log(`tiles ${jobs.length} com ${nWorkers} workers`);
  let i = 0;
  let feitos = 0;
  const t0 = Date.now();

  async function rodar() {
    while (i < jobs.length) {
      const job = jobs[i++];
      const data = await pintarTileWorker(job.tx, job.ty);
      const nome = `${job.tx}_${job.ty}`;
      gravarPng(path.join(pasta, "perto", `${nome}.png`), LADO_TILE, data);
      feitos += 1;
      const dt = (Date.now() - t0) / 1000;
      const eta = feitos > 0 ? (dt / feitos) * (jobs.length - feitos) : 0;
      console.log(`perto ${nome} ${feitos}/${jobs.length} eta ${eta.toFixed(0)}s`);
    }
  }

  await Promise.all(Array.from({ length: nWorkers }, () => rodar()));
}

definirKits(lerJson("biomas/kits.json"));
definirDetalhe(lerJson("biomas/detalhe.json"));
definirCatalogo(lerJson("biomas/mundo.json"));

const args = parseArgs(process.argv);
fs.mkdirSync(path.join(pasta, "perto"), { recursive: true });
fs.mkdirSync(path.join(pasta, "veg"), { recursive: true });

const tudo = !args.soVisao && !args.soVeg && !args.tiles;

if (tudo || args.soVeg) assarVeg();

if (tudo || args.soVisao) {
  const visao = assar(LADO_VISAO, 0, 0, PASSO_VISAO, false, "visao");
  gravarPng(path.join(pasta, "visao.png"), LADO_VISAO, visao);
}

if (tudo || args.tiles) {
  const tx0 = args.tiles?.tx0 ?? 0;
  const tx1 = args.tiles?.tx1 ?? GRADE_TILE - 1;
  const ty0 = args.tiles?.ty0 ?? 0;
  const ty1 = args.tiles?.ty1 ?? GRADE_TILE - 1;
  await assarTiles(tx0, tx1, ty0, ty1);
}

fs.writeFileSync(
  path.join(pasta, "manifesto.json"),
  JSON.stringify(
    {
      semente: SEMENTE_MAPA,
      ladoMundo: LADO_MUNDO,
      visao: LADO_VISAO,
      passoVisao: PASSO_VISAO,
      ladoTile: LADO_TILE,
      passoTile: PASSO_TILE,
      grade: GRADE_TILE,
      ladoVegChunk: LADO_VEG_CHUNK,
      gradeVeg: GRADE_VEG,
    },
    null,
    2,
  ),
);
console.log("mapa assado em", pasta);
