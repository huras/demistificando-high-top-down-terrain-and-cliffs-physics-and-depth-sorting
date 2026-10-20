/**
 * Worker: assa um tile de perto do mapa.
 */
import fs from "node:fs";
import path from "node:path";
import { parentPort, workerData } from "node:worker_threads";
import { definirCatalogo } from "../../mundo/bioma/catalogo.js";
import { definirDetalhe } from "../../mundo/bioma/detalhe.js";
import { definirKits } from "../../mundo/bioma/kits.js";
import { pintarFaixa, sombrearLinha } from "./sombrear.js";

function lerJson(raiz, rel) {
  return JSON.parse(fs.readFileSync(path.join(raiz, rel), "utf8"));
}

try {
  const { raiz, lado, origemX, origemY, passo } = workerData;
  definirKits(lerJson(raiz, "biomas/kits.json"));
  definirDetalhe(lerJson(raiz, "biomas/detalhe.json"));
  definirCatalogo(lerJson(raiz, "biomas/mundo.json"));

  const data = new Uint8ClampedArray(lado * lado * 4);
  const altura = new Float32Array(lado * lado);
  const costa = new Float32Array(lado * lado);
  for (let y = 0; y < lado; y += 64) {
    const fim = Math.min(lado, y + 64);
    pintarFaixa(data, altura, costa, y, fim, lado, origemX, origemY, passo, true);
  }
  for (let y = 0; y < lado; y++) sombrearLinha(data, altura, costa, y, lado, passo);
  parentPort.postMessage({ data: Buffer.from(data) });
} catch (err) {
  parentPort.postMessage({ erro: String(err?.stack || err) });
}
