/**
 * Carrega tiles do horizonte assados offline (como o atlas do minimapa).
 * Miss → caller gera na CPU / IDB.
 */
import { idsKitsHorizonte, geometriasDoTileHorizonte } from "./amostraTileHorizonte.js";
import {
  chaveSchemaPrebakeHorizonte,
  decodificarGradeHorizonte,
  PASTA_HORIZONTE,
  urlTileHorizonte,
} from "./gradeHorizonteAssado.js";

/** @type {Map<string, { terra: object | null, agua: object | null } | null>} */
const cache = new Map();
/** @type {Set<string>} */
const voo = new Set();
/** @type {Set<string>} */
const miss = new Set();

let manifestoOk = false;
let manifestoPedido = false;
let schemaOk = "";

function chave(hx, hy) {
  return `${hx},${hy}`;
}

function avisar(msg, err) {
  console.warn("Horizonte prebake:", msg, err || "");
}

async function gunzipBuffer(buf) {
  if (typeof DecompressionStream === "undefined") {
    // Fallback: tenta como raw (dev sem gzip)
    return buf;
  }
  const ds = new DecompressionStream("gzip");
  const stream = new Blob([buf]).stream().pipeThrough(ds);
  const ab = await new Response(stream).arrayBuffer();
  return ab;
}

function validarManifesto(meta) {
  if (!meta || typeof meta !== "object") throw new Error("manifesto inválido");
  const esperado = chaveSchemaPrebakeHorizonte();
  if (meta.schema !== esperado) {
    throw new Error(`schema ${meta.schema} ≠ ${esperado}`);
  }
  const kitsRuntime = idsKitsHorizonte().join("|");
  const kitsMeta = Array.isArray(meta.kits) ? meta.kits.join("|") : "";
  if (kitsMeta && kitsMeta !== kitsRuntime) {
    console.warn(`Horizonte prebake kits divergem (assado ≠ runtime)`);
  }
  schemaOk = meta.schema;
  manifestoOk = true;
}

/** Boot: valida manifesto. Sem arquivo = prebake desligado. */
export function iniciarPrebakeHorizonte() {
  if (manifestoPedido) return;
  manifestoPedido = true;
  const url = `${PASTA_HORIZONTE}/manifesto.json`;
  fetch(url, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error(url);
      return res.json();
    })
    .then(validarManifesto)
    .catch((err) => {
      manifestoOk = false;
      avisar("ausente ou inválido — gera na CPU", err?.message || err);
    });
}

export function prebakeHorizontePronto() {
  return manifestoOk;
}

export function prebakeHorizonteMiss(hx, hy) {
  return miss.has(chave(hx, hy));
}

export function prebakeHorizonteEmVoo(hx, hy) {
  return voo.has(chave(hx, hy));
}

/** Entrada já hidratada no cache RAM do prebake, ou null. */
export function lerPrebakeHorizonteSync(hx, hy) {
  if (!manifestoOk) return undefined;
  const k = chave(hx, hy);
  if (miss.has(k)) return null;
  if (!cache.has(k)) return undefined;
  return cache.get(k);
}

/**
 * Busca async. Resolve com entry ou null (miss).
 * @returns {Promise<{ terra: object | null, agua: object | null } | null>}
 */
export function pedirPrebakeHorizonte(hx, hy) {
  if (!manifestoOk) return Promise.resolve(null);
  const k = chave(hx, hy);
  if (miss.has(k)) return Promise.resolve(null);
  if (cache.has(k)) return Promise.resolve(cache.get(k));
  if (voo.has(k)) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      const poll = () => {
        if (cache.has(k) || miss.has(k) || performance.now() - t0 > 8000) {
          resolve(cache.has(k) ? cache.get(k) : null);
          return;
        }
        requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    });
  }
  voo.add(k);
  const url = urlTileHorizonte(hx, hy);
  return fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.arrayBuffer();
    })
    .then((gz) => gunzipBuffer(gz))
    .then((raw) => {
      const grade = decodificarGradeHorizonte(raw);
      if (!grade) throw new Error("decode");
      const entry = geometriasDoTileHorizonte(grade);
      cache.set(k, entry);
      voo.delete(k);
      return entry;
    })
    .catch(() => {
      voo.delete(k);
      miss.add(k);
      return null;
    });
}
