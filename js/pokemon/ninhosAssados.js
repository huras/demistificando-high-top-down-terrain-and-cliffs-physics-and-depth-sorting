/**
 * Ninhos lidos do binário. O jogo não sorteia espécie.
 */
import { CHUNK_XZ } from "../config.js";
import { listarEspecies } from "./dados.js";
import { lerNinhos } from "./ninhosFormato.js";

/** @type {object[]} */
let over = [];
/** @type {object[]} */
let caves = [];
/** @type {Map<string, object>} */
const porId = new Map();
/** @type {Map<string, object[]>} */
const porChunk = new Map();
/** @type {Map<string, object[]>} */
const porCave = new Map();
let pronto = false;

export function ninhosProntos() {
  return pronto;
}

function ligarChaves() {
  const porDex = new Map();
  const todas = listarEspecies();
  for (let i = 0; i < todas.length; i++) {
    const esp = todas[i];
    if (!esp?.key || !(esp.dex | 0)) continue;
    porDex.set(esp.dex | 0, esp.key);
  }
  for (let i = 0; i < over.length; i++) {
    over[i].speciesKey = porDex.get(over[i].dex | 0) || "";
  }
  for (let i = 0; i < caves.length; i++) {
    caves[i].speciesKey = porDex.get(caves[i].dex | 0) || "";
  }
}

function indexar() {
  porId.clear();
  porChunk.clear();
  porCave.clear();
  for (let i = 0; i < over.length; i++) {
    const lar = over[i];
    porId.set(lar.id, lar);
    const cx = Math.floor(lar.x / CHUNK_XZ);
    const cy = Math.floor(lar.y / CHUNK_XZ);
    const chave = `${cx},${cy}`;
    let lista = porChunk.get(chave);
    if (!lista) {
      lista = [];
      porChunk.set(chave, lista);
    }
    lista.push(lar);
  }
  for (let i = 0; i < caves.length; i++) {
    const posto = caves[i];
    let lista = porCave.get(posto.caveId);
    if (!lista) {
      lista = [];
      porCave.set(posto.caveId, lista);
    }
    lista.push(posto);
  }
}

function aplicarAjustes(moves) {
  if (!Array.isArray(moves)) return;
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    const id = String(m?.id || "");
    if (!id) continue;
    if (id.startsWith("cave:")) {
      const corte = id.lastIndexOf(":");
      const caveId = id.slice(5, corte);
      const posto = Number(id.slice(corte + 1));
      const lista = porCave.get(caveId);
      if (!lista) continue;
      for (let j = 0; j < lista.length; j++) {
        if ((lista[j].posto | 0) !== posto) continue;
        if (Number.isFinite(Number(m.tx))) lista[j].tx = m.tx | 0;
        if (Number.isFinite(Number(m.ty))) lista[j].ty = m.ty | 0;
      }
      continue;
    }
    const lar = porId.get(id);
    if (!lar) continue;
    if (Number.isFinite(Number(m.x))) lar.x = Number(m.x);
    if (Number.isFinite(Number(m.y))) lar.y = Number(m.y);
  }
}

export async function carregarNinhosAssados() {
  const [binRes, ajRes] = await Promise.all([
    fetch("/assets/ninhos/ninhos.bin"),
    fetch("/assets/ninhos/ajustes.json"),
  ]);
  if (!binRes.ok) throw new Error("ninhos.bin ausente — rode npm run ninhos:assar");
  const buf = new Uint8Array(await binRes.arrayBuffer());
  const lido = lerNinhos(buf);
  over = lido.over;
  caves = lido.caves;
  ligarChaves();
  indexar();
  if (ajRes.ok) {
    const json = await ajRes.json();
    aplicarAjustes(json?.moves);
    indexar();
  }
  pronto = true;
  return { overworld: over.length, cavernas: caves.length };
}

export function larAssado(cx, cy, indice) {
  return porId.get(`${cx | 0},${cy | 0},${indice | 0}`) || null;
}

export function laresNoChunk(cx, cy) {
  return porChunk.get(`${cx | 0},${cy | 0}`) || [];
}

export function postosDaCaverna(caveId) {
  return porCave.get(String(caveId || "")) || [];
}

export function listarOverworld() {
  return over;
}

export function listarCaverna() {
  return caves;
}
