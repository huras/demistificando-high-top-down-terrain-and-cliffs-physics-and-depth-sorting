/**
 * Objetos nomeados da vista de cena.
 * Alta e baixa são explícitas (chunk entra/sai); não há varredura da cena por frame.
 */

/** Desenhada, fora do raycast (céu, rig, realce). */
export const CAMADA_AUX = 1;

/** @type {Map<string, object>} */
const entradas = new Map();
let revisao = 0;
/** @type {Set<(id: string) => void>} */
const aoRemover = new Set();

export function verCamadaAuxiliar(camera) {
  camera.layers.enable(CAMADA_AUX);
}

export function marcarAuxiliar(objeto) {
  if (!objeto) return;
  objeto.traverse((filho) => {
    filho.layers.set(CAMADA_AUX);
  });
}

export function ancestralVisivel(objeto) {
  let no = objeto;
  while (no) {
    if (!no.visible) return false;
    no = no.parent;
  }
  return true;
}

function visivelPadrao(objeto) {
  if (!ancestralVisivel(objeto)) return false;
  if (objeto.isInstancedMesh && (objeto.count | 0) <= 0) return false;
  if (objeto.isGroup && objeto.children.length === 0) return false;
  return true;
}

/**
 * @param {import("three").Object3D} objeto
 * @param {{
 *   id: string,
 *   pasta: string,
 *   rotulo?: string,
 *   tipo?: string,
 *   auxiliar?: boolean,
 *   segue?: boolean,
 *   obterInstancia?: ((i: number) => object | null) | null,
 *   visivel?: () => boolean,
 * }} meta
 */
export function registrarObjetoCena(objeto, meta) {
  const id = meta.id;
  const entrada = {
    id,
    pasta: meta.pasta,
    rotulo: meta.rotulo || objeto.name || id,
    tipo: meta.tipo || objeto.type || "objeto",
    objeto,
    auxiliar: !!meta.auxiliar,
    segue: !!meta.segue,
    obterInstancia: meta.obterInstancia || null,
    visivel: meta.visivel || (() => visivelPadrao(objeto)),
  };
  objeto.userData.cenaId = id;
  if (entrada.auxiliar) marcarAuxiliar(objeto);
  entradas.set(id, entrada);
  revisao++;
  return entrada;
}

export function removerObjetoCena(id) {
  if (!id || !entradas.has(id)) return;
  entradas.delete(id);
  revisao++;
  queueMicrotask(() => {
    if (entradas.has(id)) return;
    for (const fn of aoRemover) fn(id);
  });
}

export function aoRemoverObjetoCena(fn) {
  aoRemover.add(fn);
  return () => aoRemover.delete(fn);
}

export function obterEntradaCena(id) {
  return entradas.get(id) || null;
}

export function listarEntradasCena() {
  return entradas.values();
}

export function revisaoRegistroCena() {
  return revisao;
}

export function idCenaDoObjeto(objeto) {
  let no = objeto;
  while (no) {
    const id = no.userData?.cenaId;
    if (id && entradas.has(id)) return id;
    no = no.parent;
  }
  return null;
}
