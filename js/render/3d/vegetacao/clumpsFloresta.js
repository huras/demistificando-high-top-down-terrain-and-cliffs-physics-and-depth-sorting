/**
 * Assa atlas de clump (várias árvores num card) a partir dos sprites dos kits.
 * Poucas texturas → horizonte denso sem milhares de instâncias.
 */
import * as THREE from "three";
import { TILE } from "../../../config.js";
import { hash2 } from "../../../mundo/voxel/ruido.js";
import { obterKits } from "../../../mundo/bioma/kits.js";

/** @typedef {"S"|"M"|"L"} TamanhoClump */
/** @typedef {"lush"|"light"|"autum"|"generico"} FamiliaClump */

const FAMILIAS = Object.freeze(["lush", "light", "autum", "generico"]);
const TAMANHOS = Object.freeze({
  S: Object.freeze({ n: 4, w: 256, h: 192, escalaMundo: 6.5 }),
  M: Object.freeze({ n: 12, w: 384, h: 256, escalaMundo: 11 }),
  L: Object.freeze({ n: 32, w: 512, h: 320, escalaMundo: 18 }),
});

/** Kits cujas árvores alimentam cada família de clump. */
const KITS_FAMILIA = Object.freeze({
  lush: Object.freeze(["lush-grass", "jungle", "palm-jungle", "marsh", "kelp-forest"]),
  light: Object.freeze(["light-grass", "savanna", "johto-past", "brown-earth"]),
  autum: Object.freeze(["autum-forest", "ghost-forest", "honey-trees-flower-fields"]),
  generico: Object.freeze([]),
});

/** @type {Map<string, { tex: THREE.Texture, largura: number, altura: number, canvas: HTMLCanvasElement }>} */
const cache = new Map();

/**
 * @param {string | null | undefined} biomaId
 * @returns {FamiliaClump}
 */
export function familiaClumpDeBioma(biomaId) {
  const id = biomaId || "";
  if (/lush|jungle|marsh|palm|kelp/i.test(id)) return "lush";
  if (/autum|autumn|ghost|honey/i.test(id)) return "autum";
  if (/light|savanna|johto|grass|brown-earth/i.test(id)) return "light";
  return "generico";
}

/**
 * @param {string | null | undefined} biomaId
 */
export function biomaAceitaFloresta(biomaId) {
  if (!biomaId) return false;
  if (/sand|desert|stone|snow|tundra|amber|rift|trench|shelf|deep|dirty-sand|faroeste|pewter|moon|tunnel/i.test(biomaId)) {
    return false;
  }
  return true;
}

/**
 * @param {HTMLImageElement | null | undefined} img
 */
function imagemValida(img) {
  if (!img) return false;
  const w = img.naturalWidth || img.width || 0;
  const h = img.naturalHeight || img.height || 0;
  return w >= 8 && h >= 8;
}

/**
 * @param {object | null} atlas
 * @param {FamiliaClump} familia
 * @returns {HTMLImageElement[]}
 */
function coletarImagensArvore(atlas, familia) {
  /** @type {HTMLImageElement[]} */
  const lista = [];
  const visto = new Set();
  const push = (img) => {
    if (!imagemValida(img) || visto.has(img)) return;
    visto.add(img);
    lista.push(img);
  };

  const spritesAtlas = atlas?.sprites || {};
  const meta = obterKits();
  const metaSprites = meta?.sprites || {};
  const kits = meta?.kits || {};

  const idsKit = KITS_FAMILIA[familia] || [];
  if (idsKit.length) {
    for (let k = 0; k < idsKit.length; k++) {
      const arv = kits[idsKit[k]]?.arvore || [];
      for (let i = 0; i < arv.length; i++) {
        const id = arv[i]?.id;
        if (id) push(spritesAtlas[id]);
      }
    }
  }

  if (!lista.length) {
    const ids = Object.keys(spritesAtlas);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (metaSprites[id]?.classe === "arvore") push(spritesAtlas[id]);
    }
  }

  if (!lista.length && atlas?.arvore) push(atlas.arvore);
  return lista;
}

function chave(familia, tamanho) {
  return `${familia}:${tamanho}`;
}

/**
 * @param {FamiliaClump} familia
 * @param {TamanhoClump} tamanho
 * @param {HTMLImageElement[]} pool
 */
function assarCanvas(familia, tamanho, pool) {
  const spec = TAMANHOS[tamanho];
  const canvas = document.createElement("canvas");
  canvas.width = spec.w;
  canvas.height = spec.h;
  const ctx = canvas.getContext("2d");
  if (!ctx || !pool.length) return null;
  ctx.clearRect(0, 0, spec.w, spec.h);

  const seed = familia.length * 97 + tamanho.charCodeAt(0);
  for (let i = 0; i < spec.n; i++) {
    const img = pool[Math.floor(hash2(i, seed, 11) * pool.length) % pool.length];
    const iw = img.naturalWidth || img.width || TILE;
    const ih = img.naturalHeight || img.height || TILE;
    const escala =
      (0.45 + hash2(i, seed, 22) * 0.55) * (tamanho === "L" ? 1.15 : tamanho === "M" ? 1 : 0.9);
    const dw = Math.max(8, iw * escala * (spec.w / 320));
    const dh = Math.max(8, ih * escala * (spec.h / 240));
    const cx = (0.08 + hash2(i, seed, 33) * 0.84) * spec.w;
    const baseY = spec.h * (0.88 + hash2(i, seed, 44) * 0.1);
    const dx = cx - dw * 0.5;
    const dy = baseY - dh;
    ctx.globalAlpha = 0.88 + hash2(i, seed, 55) * 0.12;
    try {
      ctx.drawImage(img, dx, dy, dw, dh);
    } catch {
      /* cross-origin / decode — ignora sprite */
    }
  }
  ctx.globalAlpha = 1;
  return canvas;
}

/**
 * @param {object | null} atlas
 * @param {FamiliaClump} familia
 * @param {TamanhoClump} tamanho
 */
export function obterClump(atlas, familia, tamanho) {
  const fam = FAMILIAS.includes(familia) ? familia : "generico";
  const tam = TAMANHOS[tamanho] ? tamanho : "M";
  const k = chave(fam, tam);
  let hit = cache.get(k);
  if (hit) return hit;

  const pool = coletarImagensArvore(atlas, fam);
  if (!pool.length) return null;
  const canvas = assarCanvas(fam, tam, pool);
  if (!canvas) return null;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;

  const spec = TAMANHOS[tam];
  hit = {
    tex,
    canvas,
    largura: spec.escalaMundo,
    altura: spec.escalaMundo * (spec.h / spec.w) * 1.15,
    familia: fam,
    tamanho: tam,
  };
  cache.set(k, hit);
  return hit;
}

/** Pré-assa as famílias × tamanhos a partir do atlas. */
export function aquecerClumps(atlas) {
  if (!atlas) return 0;
  let n = 0;
  for (let f = 0; f < FAMILIAS.length; f++) {
    const fam = FAMILIAS[f];
    for (const tam of /** @type {TamanhoClump[]} */ (["S", "M", "L"])) {
      if (obterClump(atlas, fam, tam)) n += 1;
    }
  }
  return n;
}

export function liberarClumps() {
  for (const item of cache.values()) {
    item.tex?.dispose();
  }
  cache.clear();
}

/**
 * @param {number} wx
 * @param {number} wy
 * @returns {TamanhoClump}
 */
export function sortearTamanhoClump(wx, wy) {
  const t = hash2(wx | 0, wy | 0, 0x714);
  if (t > 0.78) return "L";
  if (t > 0.4) return "M";
  return "S";
}
