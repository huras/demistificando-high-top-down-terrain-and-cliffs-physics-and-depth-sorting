/**
 * Assa o overworld inteiro em tiles de horizonte (estilo mapa:assar).
 * Rode de novo se mudar seed, relevo, bioma, kits ou layout de cidade.
 *
 * Flags: --tiles hx0:hx1,hy0:hy1
 *
 * npm run horizonte:assar
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { definirCatalogo } from "../../mundo/bioma/catalogo.js";
import { definirDetalhe } from "../../mundo/bioma/detalhe.js";
import { definirKits } from "../../mundo/bioma/kits.js";
import { amostrarTileHorizonte, idsKitsHorizonte } from "./amostraTileHorizonte.js";
import {
  codificarGradeHorizonte,
  gradeTilesHorizonte,
  manifestoHorizonteBase,
  nomeArquivoTile,
  PASTA_HORIZONTE,
} from "./gradeHorizonteAssado.js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const pasta = path.join(raiz, PASTA_HORIZONTE);

function lerJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(raiz, rel), "utf8"));
}

function parseArgs(argv) {
  const out = { tiles: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tiles" && argv[i + 1]) {
      const m = /^(-?\d+):(-?\d+),(-?\d+):(-?\d+)$/.exec(argv[++i]);
      if (m) out.tiles = { hx0: +m[1], hx1: +m[2], hy0: +m[3], hy1: +m[4] };
    }
  }
  return out;
}

function assarFaixa(hx0, hx1, hy0, hy1) {
  const total = (hx1 - hx0 + 1) * (hy1 - hy0 + 1);
  console.log(`horizonte ${total} tiles → ${pasta}`);
  let feitos = 0;
  let vazios = 0;
  const t0 = Date.now();

  for (let hy = hy0; hy <= hy1; hy++) {
    for (let hx = hx0; hx <= hx1; hx++) {
      const destino = path.join(pasta, nomeArquivoTile(hx, hy));
      const grade = amostrarTileHorizonte(hx, hy);
      if (!grade) {
        if (fs.existsSync(destino)) fs.unlinkSync(destino);
        vazios += 1;
      } else {
        const raw = Buffer.from(codificarGradeHorizonte(grade));
        fs.writeFileSync(destino, zlib.gzipSync(raw));
      }
      feitos += 1;
      if (feitos % 128 === 0 || feitos === total) {
        const dt = (Date.now() - t0) / 1000;
        const eta = feitos > 0 ? (dt / feitos) * (total - feitos) : 0;
        console.log(`horizonte ${feitos}/${total} vazios=${vazios} ${dt.toFixed(1)}s eta ${eta.toFixed(0)}s`);
      }
    }
  }
}

definirKits(lerJson("biomas/kits.json"));
definirDetalhe(lerJson("biomas/detalhe.json"));
definirCatalogo(lerJson("biomas/mundo.json"));

const args = parseArgs(process.argv);
const g = gradeTilesHorizonte();
fs.mkdirSync(pasta, { recursive: true });

const hx0 = args.tiles?.hx0 ?? 0;
const hx1 = args.tiles?.hx1 ?? g - 1;
const hy0 = args.tiles?.hy0 ?? 0;
const hy1 = args.tiles?.hy1 ?? g - 1;

assarFaixa(hx0, hx1, hy0, hy1);

const meta = manifestoHorizonteBase(idsKitsHorizonte());
meta.hx0 = hx0;
meta.hx1 = hx1;
meta.hy0 = hy0;
meta.hy1 = hy1;
fs.writeFileSync(path.join(pasta, "manifesto.json"), `${JSON.stringify(meta, null, 2)}\n`);
console.log("horizonte assado em", pasta);
