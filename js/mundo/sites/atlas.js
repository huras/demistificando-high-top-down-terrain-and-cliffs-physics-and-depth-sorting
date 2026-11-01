/**
 * Atlas de props de sítio: recorta world-props / Mountains uma vez e cacheia.
 */
import { carregarImagem } from "../../render/atlas.js";
import { PROP_SITE, RECORTE_DO_PROP } from "./catalogo.js";

/** @type {Map<string, HTMLCanvasElement|HTMLImageElement>} */
const crops = new Map();
/** @type {Map<string, Promise<HTMLImageElement|null>>} */
const sheets = new Map();
/** @type {Record<string, object>|null} */
let recortes = null;
let pronto = false;
/** @type {Promise<void>|null} */
let carregando = null;

async function carregarSheet(url) {
  if (sheets.has(url)) return sheets.get(url);
  const p = carregarImagem(url).catch((err) => {
    console.warn("sheet de site ausente:", url, err);
    return null;
  });
  sheets.set(url, p);
  return p;
}

function recortar(img, def) {
  const ts = def.tileSize | 0;
  const w = (def.cols | 0) * ts;
  const h = (def.rows | 0) * ts;
  const sx = (def.originCol | 0) * ts;
  const sy = (def.originRow | 0) * ts;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext("2d");
  if (!ctx || !img) return canvas;
  ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  return canvas;
}

export async function carregarAtlasSites() {
  if (pronto) return;
  if (carregando) return carregando;
  carregando = (async () => {
    try {
      const res = await fetch("assets/props/sites/recortes.json", { cache: "no-store" });
      if (!res.ok) throw new Error("recortes.json");
      recortes = await res.json();
    } catch (err) {
      console.warn("falha ao carregar recortes de site", err);
      recortes = {};
    }

    const tarefas = [];
    for (const propId of Object.keys(RECORTE_DO_PROP)) {
      const chave = RECORTE_DO_PROP[propId];
      const def = recortes[chave];
      if (!def?.sheet) continue;
      tarefas.push(
        carregarSheet(def.sheet).then((img) => {
          if (!img) return;
          crops.set(propId, recortar(img, def));
          crops.set(chave, crops.get(propId));
        })
      );
    }
    await Promise.all(tarefas);
    pronto = true;
  })();
  return carregando;
}

export function atlasSitesPronto() {
  return pronto;
}

/** Imagem recortada do prop (canvas) ou null. */
export function imagemDoPropSite(propId) {
  if (!propId) return null;
  return crops.get(propId) || crops.get(RECORTE_DO_PROP[propId]) || null;
}

export function idsPropsSite() {
  return Object.values(PROP_SITE);
}
