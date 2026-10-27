/**
 * Persistência leve em memória: resolvidos, buracos preenchidos, revelação cheat.
 */

/** @type {Set<string>} */
const resolvidos = new Set();
/** @type {Map<string, Set<string>>} */
const buracosCheios = new Map();
/** @type {Set<string>} */
const revelados = new Set();
let versaoMapa = 0;

function bump() {
  versaoMapa = (versaoMapa + 1) | 0;
}

export function versaoMapaLetras() {
  return versaoMapa;
}

export function letraResolvida(id) {
  return !!id && resolvidos.has(String(id));
}

export function marcarLetraResolvida(id) {
  const k = String(id || "");
  if (!k || resolvidos.has(k)) return false;
  resolvidos.add(k);
  bump();
  return true;
}

function chaveBuraco(cx, cy) {
  return `${cx | 0},${cy | 0}`;
}

export function buracoPreenchido(puzzleId, cellX, cellY) {
  const id = String(puzzleId || "");
  if (!id) return false;
  return !!buracosCheios.get(id)?.has(chaveBuraco(cellX, cellY));
}

export function marcarBuracoPreenchido(puzzleId, cellX, cellY) {
  const id = String(puzzleId || "");
  if (!id) return false;
  let set = buracosCheios.get(id);
  if (!set) {
    set = new Set();
    buracosCheios.set(id, set);
  }
  const key = chaveBuraco(cellX, cellY);
  if (set.has(key)) return false;
  set.add(key);
  bump();
  return true;
}

export function contarBuracosPreenchidos(puzzleId) {
  return buracosCheios.get(String(puzzleId || ""))?.size || 0;
}

export function letraRevelada(id) {
  return !!id && revelados.has(String(id));
}

/** Cheat do mapa: revela todos (ou lista). */
export function revelarLetras(ids) {
  const lista = Array.isArray(ids) ? ids : [];
  let n = 0;
  for (let i = 0; i < lista.length; i++) {
    const id = String(lista[i] || "");
    if (!id || revelados.has(id)) continue;
    revelados.add(id);
    n++;
  }
  if (n) {
    bump();
    try {
      // Evita import circular no boot.
      import("./mapaMarcas.js").then((m) => m.invalidarMarcasLetras?.());
    } catch {
      /* ok */
    }
  }
  return n;
}

export function letrasReveladasAtivas() {
  return revelados.size > 0;
}
