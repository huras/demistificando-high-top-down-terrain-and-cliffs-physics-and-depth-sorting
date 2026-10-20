import { pivoDaImagem } from "../../pivoPe.js";

const VAZIO = Object.freeze({ x: 0.5, y: 1, dz: 0, opacoY: 1 });
const URL_PIVOS = "assets/props/pivos.json";

/** @type {Record<string, object>|null} */
let arquivo = null;
let carregando = null;

function celula01(n, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(1, v));
}

function celulaDz(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(-4, Math.min(4, Math.round(v * 100) / 100));
}

/** Carrega overrides de props (uma vez). */
export function carregarPivosProps() {
  if (arquivo) return Promise.resolve(arquivo);
  if (carregando) return carregando;
  carregando = fetch(URL_PIVOS, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : {}))
    .then((obj) => {
      arquivo = obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
      return arquivo;
    })
    .catch(() => {
      arquivo = {};
      return arquivo;
    })
    .finally(() => {
      carregando = null;
    });
  return carregando;
}

/** Injeta mapa (editor / testes). */
export function definirPivosProps(mapa) {
  arquivo = mapa && typeof mapa === "object" && !Array.isArray(mapa) ? mapa : {};
}

export function mapaPivosProps() {
  return arquivo || {};
}

/**
 * Centro da base na arte + dz (offset pra frente da rotação).
 * Scan do PNG é só chute inicial — em high top-down o centro do chão
 * quase nunca é o pixel de baixo.
 * opacoY = último pixel opaco (pra lift ignorar padding transparente).
 */
export function pivoDoProp(img, chave = null) {
  const base = img ? pivoDaImagem(img) : VAZIO;
  const opacoY = base.y;
  const id = chave || "";
  const aj = id && arquivo ? arquivo[id] : null;
  if (!aj) return { x: base.x, y: base.y, dz: 0, opacoY };

  const dz = celulaDz(aj.dz);

  if (Number.isFinite(aj.pivotX) || Number.isFinite(aj.pivotY)) {
    return {
      x: celula01(aj.pivotX, base.x),
      y: celula01(aj.pivotY, base.y),
      dz,
      opacoY,
    };
  }

  const w = img?.naturalWidth || img?.width || 0;
  const h = img?.naturalHeight || img?.height || 0;
  if (!(w > 0 && h > 0)) return { x: base.x, y: base.y, dz, opacoY };
  const dx = Number(aj.dx) || 0;
  const dy = Number(aj.dy) || 0;
  return {
    x: celula01(base.x - dx / w, base.x),
    y: celula01(base.y + dy / h, base.y),
    dz,
    opacoY,
  };
}
