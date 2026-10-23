/**
 * Persistência de tiles do LOD horizonte em IndexedDB (fallback).
 * Prefira o prebake offline em assets/horizonte (npm run horizonte:assar).
 * Namespace por save + schema; edits de bloco perto não invalidam (passo 16).
 */
import {
  CHUNK_HORIZONTE,
  PASSO_HORIZONTE,
  QUANT_ALTURA_HORIZONTE,
  SEED_MUNDO,
  UV_ESCALA_HORIZONTE,
  UV_ESCALA_MAR_HORIZONTE,
} from "../../config.js";
import * as THREE from "three";

const DB_NOME = "pokemon-botw-horizonte";
const DB_VERSAO = 1;
const STORE = "tiles";

/** Bump manual se o layout do blob mudar. */
export const SCHEMA_BLOB_HORIZONTE = 2;

export function chaveSchemaHorizonte() {
  return [
    SCHEMA_BLOB_HORIZONTE,
    SEED_MUNDO,
    CHUNK_HORIZONTE,
    PASSO_HORIZONTE,
    QUANT_ALTURA_HORIZONTE,
    UV_ESCALA_HORIZONTE,
    UV_ESCALA_MAR_HORIZONTE,
  ].join(".");
}

function chaveRegistro(saveId, schema, hx, hy) {
  return `${saveId}|${schema}|${hx},${hy}`;
}

/** @type {Promise<IDBDatabase> | null} */
let dbPromise = null;

function abrirDb() {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === "undefined") {
    dbPromise = Promise.reject(new Error("sem indexedDB"));
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, DB_VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("idb open"));
  });
  return dbPromise;
}

function clonarTyped(arr) {
  if (!arr) return null;
  return arr.slice ? arr.slice() : new arr.constructor(arr);
}

/**
 * @param {THREE.BufferGeometry | null} geo
 * @returns {object | null}
 */
export function serializarGeometria(geo) {
  if (!geo) return null;
  /** @type {Record<string, { itemSize: number, array: ArrayLike<number> }>} */
  const attrs = {};
  for (const nome of Object.keys(geo.attributes)) {
    const a = geo.getAttribute(nome);
    if (!a?.array) continue;
    attrs[nome] = { itemSize: a.itemSize, array: clonarTyped(a.array) };
  }
  let index = null;
  if (geo.index?.array) {
    index = { array: clonarTyped(geo.index.array) };
  }
  return { attrs, index };
}

/**
 * @param {object | null} blob
 * @returns {THREE.BufferGeometry | null}
 */
export function hidratarGeometria(blob) {
  if (!blob?.attrs) return null;
  const geo = new THREE.BufferGeometry();
  for (const nome of Object.keys(blob.attrs)) {
    const a = blob.attrs[nome];
    if (!a?.array) continue;
    geo.setAttribute(nome, new THREE.BufferAttribute(a.array, a.itemSize));
  }
  if (blob.index?.array) {
    geo.setIndex(new THREE.BufferAttribute(blob.index.array, 1));
  }
  geo.computeBoundingSphere();
  return geo;
}

/**
 * @param {string} saveId
 * @param {string} schema
 * @param {number} hx
 * @param {number} hy
 * @returns {Promise<{ terra: object | null, agua: object | null } | null>}
 */
export async function lerTileHorizonteIdb(saveId, schema, hx, hy) {
  try {
    const db = await abrirDb();
    const id = chaveRegistro(saveId, schema, hx, hy);
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => {
        const row = req.result;
        if (!row || row.schema !== schema) {
          resolve(null);
          return;
        }
        resolve({ terra: row.terra ?? null, agua: row.agua ?? null });
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * @param {string} saveId
 * @param {string} schema
 * @param {number} hx
 * @param {number} hy
 * @param {{ terra: THREE.BufferGeometry | null, agua: THREE.BufferGeometry | null }} entry
 */
export async function gravarTileHorizonteIdb(saveId, schema, hx, hy, entry) {
  try {
    const db = await abrirDb();
    const id = chaveRegistro(saveId, schema, hx, hy);
    const row = {
      id,
      saveId,
      schema,
      hx,
      hy,
      terra: serializarGeometria(entry.terra),
      agua: serializarGeometria(entry.agua),
      t: Date.now(),
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore quota / private mode */
  }
}

/** Apaga todos os tiles de um save (ex.: wipe). */
export async function limparTilesSaveIdb(saveId) {
  try {
    const db = await abrirDb();
    const schema = chaveSchemaHorizonte();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const v = cursor.value;
        if (v?.saveId === saveId || (typeof v?.id === "string" && v.id.startsWith(`${saveId}|`))) {
          cursor.delete();
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    void schema;
  } catch {
    /* ignore */
  }
}
