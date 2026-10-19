/**
 * Assa o terreno de Kanto para PNG. O jogo só carrega o resultado.
 * Rode de novo se mudar relevo, bioma, kit ou layout de cidade.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { definirDetalhe } from "../../mundo/bioma/detalhe.js";
import { definirKits } from "../../mundo/bioma/kits.js";
import { byteNoPonto } from "./amostra.js";
import {
  GRADE_TILE,
  LADO_MUNDO,
  LADO_TILE,
  LADO_TILE_MUNDO,
  LADO_VISAO,
  PASSO_TILE,
  PASSO_VISAO,
  SEMENTE_MAPA,
} from "./grade.js";
import { pintarFaixa, sombrearLinha } from "./sombrear.js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const pasta = path.join(raiz, "assets", "mapa", "kanto");

function lerJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(raiz, rel), "utf8"));
}

function gravar(caminho, lado, data) {
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

definirKits(lerJson("biomas/kits.json"));
definirDetalhe(lerJson("biomas/detalhe.json"));

function assarVeg() {
  const dados = new Uint8Array(LADO_MUNDO * LADO_MUNDO);
  const t0 = Date.now();
  for (let y = 0; y < LADO_MUNDO; y++) {
    const o = y * LADO_MUNDO;
    for (let x = 0; x < LADO_MUNDO; x++) dados[o + x] = byteNoPonto(x + 0.5, y + 0.5);
    if ((y & 127) === 127) console.log(`veg ${y + 1}/${LADO_MUNDO}`);
  }
  fs.writeFileSync(path.join(pasta, "veg.bin"), zlib.gzipSync(dados));
  console.log(`veg ${(Date.now() - t0) / 1000}s`);
}

assarVeg();

const visao = assar(LADO_VISAO, 0, 0, PASSO_VISAO, false, "visao");
gravar(path.join(pasta, "visao.png"), LADO_VISAO, visao);

for (let ty = 0; ty < GRADE_TILE; ty++) {
  for (let tx = 0; tx < GRADE_TILE; tx++) {
    const nome = `${tx}_${ty}`;
    const data = assar(
      LADO_TILE,
      tx * LADO_TILE_MUNDO,
      ty * LADO_TILE_MUNDO,
      PASSO_TILE,
      true,
      nome,
    );
    gravar(path.join(pasta, "perto", `${nome}.png`), LADO_TILE, data);
  }
}

fs.writeFileSync(
  path.join(pasta, "manifesto.json"),
  JSON.stringify(
    {
      semente: SEMENTE_MAPA,
      visao: LADO_VISAO,
      passoVisao: PASSO_VISAO,
      ladoTile: LADO_TILE,
      passoTile: PASSO_TILE,
      grade: GRADE_TILE,
      veg: LADO_MUNDO,
    },
    null,
    2,
  ),
);
console.log("mapa assado em", pasta);
