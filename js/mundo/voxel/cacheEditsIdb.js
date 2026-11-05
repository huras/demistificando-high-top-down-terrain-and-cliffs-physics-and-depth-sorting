/**
 * Persistência de edits de voxel por chunk no IndexedDB.
 * Namespace por save + schema (espelha cacheHorizonteIdb).
 */

const DB_NOME = "pokemon-botw-voxel-edits";
const DB_VERSAO = 1;
const STORE = "chunks";

/** Bump se enums de BLOCO / packing mudarem. */
export const SCHEMA_EDITS = 1;

export function chaveSchemaEdits() {
  return String(SCHEMA_EDITS);
}

function chaveRegistro(saveId, schema, cx, cy) {
  return `${saveId}|${schema}|${cx},${cy}`;
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

/**
 * @param {string} saveId
 * @param {number} cx
 * @param {number} cy
 * @returns {Promise<Int16Array | null>} cells [lx,ly,z,id,…]
 */
export async function lerChunkEditsIdb(saveId, cx, cy) {
  try {
    const db = await abrirDb();
    const schema = chaveSchemaEdits();
    const id = chaveRegistro(saveId, schema, cx | 0, cy | 0);
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => {
        const row = req.result;
        if (!row || row.schema !== schema) {
          resolve(null);
          return;
        }
        const cells = row.cells;
        if (!cells) {
          resolve(null);
          return;
        }
        resolve(cells instanceof Int16Array ? cells : new Int16Array(cells));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * @param {string} saveId
 * @returns {Promise<{ cx: number, cy: number, cells: Int16Array }[]>}
 */
export async function listarChunksEditsIdb(saveId) {
  const out = [];
  try {
    const db = await abrirDb();
    const schema = chaveSchemaEdits();
    const prefix = `${saveId}|${schema}|`;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const v = cursor.value;
        if (
          v?.schema === schema &&
          (v.saveId === saveId ||
            (typeof v.id === "string" && v.id.startsWith(prefix)))
        ) {
          const cells = v.cells;
          if (cells && (v.cx != null) && (v.cy != null)) {
            out.push({
              cx: v.cx | 0,
              cy: v.cy | 0,
              cells: cells instanceof Int16Array ? cells : new Int16Array(cells),
            });
          }
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
  return out;
}

/**
 * @param {string} saveId
 * @param {number} cx
 * @param {number} cy
 * @param {Int16Array} cells
 */
export async function gravarChunkEditsIdb(saveId, cx, cy, cells) {
  try {
    const db = await abrirDb();
    const schema = chaveSchemaEdits();
    const cxi = cx | 0;
    const cyi = cy | 0;
    const id = chaveRegistro(saveId, schema, cxi, cyi);
    const row = {
      id,
      saveId,
      schema,
      cx: cxi,
      cy: cyi,
      cells: cells instanceof Int16Array ? cells : new Int16Array(cells),
      t: Date.now(),
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      if (!row.cells.length) {
        tx.objectStore(STORE).delete(id);
      } else {
        tx.objectStore(STORE).put(row);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore quota / private mode */
  }
}

/** Grava vários chunks numa transação. */
export async function gravarChunksEditsIdb(saveId, lista) {
  if (!lista?.length) return;
  try {
    const db = await abrirDb();
    const schema = chaveSchemaEdits();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      for (let i = 0; i < lista.length; i++) {
        const { cx, cy, cells } = lista[i];
        const cxi = cx | 0;
        const cyi = cy | 0;
        const id = chaveRegistro(saveId, schema, cxi, cyi);
        if (!cells || !cells.length) {
          store.delete(id);
          continue;
        }
        store.put({
          id,
          saveId,
          schema,
          cx: cxi,
          cy: cyi,
          cells: cells instanceof Int16Array ? cells : new Int16Array(cells),
          t: Date.now(),
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

/** Apaga todos os edits de um save. */
export async function limparEditsSaveIdb(saveId) {
  try {
    const db = await abrirDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const v = cursor.value;
        if (
          v?.saveId === saveId ||
          (typeof v?.id === "string" && v.id.startsWith(`${saveId}|`))
        ) {
          cursor.delete();
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}
