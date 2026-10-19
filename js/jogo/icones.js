/** Ícones: PNG de itens, ou o recorte de tileset definido no Pokémon AI. */

import { CHAVES_BERRY, MAPA_ICONE, SOBRESCREVE_ICONE } from "./iconesRef.js";

const FOLHA = Object.freeze({
  tileset_1: {
    url: "/ref/sprites/items-tileset/tileset_1.png",
    tile: 32,
    ox: 1,
    oy: 1,
    px: 2,
    py: 2,
    w: 476,
    h: 1020,
  },
  iconset_2: {
    url: "/ref/sprites/items-tileset/IconSet-2.png",
    tile: 32,
    ox: 0,
    oy: 0,
    px: 0,
    py: 0,
    w: 512,
    h: 3200,
  },
});

const REL = Object.freeze({
  pokeball: "pokeballs/poke-ball.png",
  greatball: "pokeballs/great-ball.png",
  ultraball: "pokeballs/ultra-ball.png",
  masterball: "pokeballs/master-ball.png",
  potion: "medicine/potion.png",
  superPotion: "medicine/super-potion.png",
  hyperPotion: "medicine/hyper-potion.png",
  antidote: "medicine/antidote.png",
  paralyzeHeal: "medicine/paralyze-heal.png",
  awakening: "medicine/awakening.png",
  burnHeal: "medicine/burn-heal.png",
  iceHeal: "medicine/ice-heal.png",
  fullHeal: "medicine/full-heal.png",
  revive: "medicine/revive.png",
  oran: "berries/oran-berry.png",
  sitrus: "berries/sitrus-berry.png",
  cheri: "berries/cheri-berry.png",
  chesto: "berries/chesto-berry.png",
  pecha: "berries/pecha-berry.png",
  rawst: "berries/rawst-berry.png",
  aspear: "berries/aspear-berry.png",
  lum: "berries/lum-berry.png",
  leppa: "berries/leppa-berry.png",
  persim: "berries/persim-berry.png",
  figy: "berries/figy-berry.png",
  wiki: "berries/wiki-berry.png",
  mago: "berries/mago-berry.png",
  aguav: "berries/aguav-berry.png",
  iapapa: "berries/iapapa-berry.png",
  razz: "berries/razz-berry.png",
  bluk: "berries/bluk-berry.png",
  pinap: "berries/pinap-berry.png",
  cornn: "berries/cornn-berry.png",
  magost: "berries/magost-berry.png",
  rabuta: "berries/rabuta-berry.png",
  nomel: "berries/nomel-berry.png",
  spelon: "berries/spelon-berry.png",
  pamtre: "berries/pamtre-berry.png",
  watmel: "berries/watmel-berry.png",
  durin: "berries/durin-berry.png",
  belue: "berries/belue-berry.png",
  pomeg: "berries/pomeg-berry.png",
  kelpsy: "berries/kelpsy-berry.png",
  qualot: "berries/qualot-berry.png",
  hondew: "berries/hondew-berry.png",
  grepa: "berries/grepa-berry.png",
  tamato: "berries/tamato-berry.png",
  wateringCan: "general-items/sprinklotad.png",
  stone: "hold-items/hard-stone.png",
  coal: "hold-items/charcoal.png",
  blueCrystal: "crystals/small-blue-crystal.png",
  redCrystal: "crystals/small-red-crystal.png",
  yellowCrystal: "crystals/small-yellow-crystal.png",
  purpleCrystal: "crystals/small-purple-crystal.png",
  greenCrystal: "crystals/small-green-crystal.png",
  pinkCrystal: "crystals/small-pink-crystal.png",
  pokedex: "general-items/pokedex.png",
  expShare: "hold-items/exp-share.png",
  blocoGrama: "hold-items/miracle-seed.png",
  blocoTerra: "hold-items/soft-sand.png",
  blocoPedra: "hold-items/hard-stone.png",
});

const EXIBE = 36;
const imagens = new Map();
const folhasImg = new Map();
const recortes = new Map();

function refIcone(chave) {
  return SOBRESCREVE_ICONE[chave]
    || MAPA_ICONE[chave]
    || (CHAVES_BERRY.has(chave) ? `berries/${chave}-berry.png` : null)
    || (REL[chave] ? `local:${REL[chave]}` : null);
}

function corteDe(ref) {
  const m = /^tileset:(?:(iconset_2):)?r(\d+)_c(\d+)$/.exec(ref || "");
  if (!m) return null;
  return { folha: m[1] ? "iconset_2" : "tileset_1", r: Number(m[2]), c: Number(m[3]) };
}

function urlDeRef(ref) {
  if (!ref || ref.startsWith("tileset:")) return "";
  if (ref.startsWith("local:")) return `assets/itens/${ref.slice(6)}`;
  if (ref.startsWith("world:")) return `/ref/sprites/${ref.slice(6)}`;
  return `/ref/sprites/items-icons/${ref}`;
}

export function urlIcone(chave) {
  return urlDeRef(refIcone(chave));
}

function estiloTileset(corte, exibe) {
  const folha = FOLHA[corte.folha];
  const x = folha.ox + corte.c * (folha.tile + folha.px);
  const y = folha.oy + corte.r * (folha.tile + folha.py);
  const s = exibe / folha.tile;
  return [
    `background-image:url(${folha.url})`,
    "background-repeat:no-repeat",
    `background-size:${folha.w * s}px ${folha.h * s}px`,
    `background-position:-${x * s}px -${y * s}px`,
  ].join(";");
}

export function htmlIcone(chave, classe, tamanho) {
  const base = classe || "jogo-icone";
  const exibe = tamanho > 0 ? tamanho : EXIBE;
  const corte = corteDe(refIcone(chave));
  if (corte) {
    const estilo = estiloTileset(corte, exibe);
    return `<span class="${base} jogo-icone--tileset" style="${estilo};width:${exibe}px;height:${exibe}px"></span>`;
  }
  const url = urlIcone(chave);
  if (!url) return `<span class="${base} jogo-icone--vazio" style="width:${exibe}px;height:${exibe}px"></span>`;
  return `<img class="${base}" src="${url}" alt="" width="${exibe}" height="${exibe}" draggable="false" />`;
}

function folhaPronta(id) {
  if (typeof document === "undefined") return null;
  let img = folhasImg.get(id);
  if (!img) {
    img = new Image();
    img.src = FOLHA[id].url;
    folhasImg.set(id, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

export function imagemIcone(chave) {
  if (typeof document === "undefined") return null;
  const ref = refIcone(chave);
  if (!ref) return null;
  const corte = corteDe(ref);
  if (corte) {
    const pronto = recortes.get(chave);
    if (pronto) return pronto;
    const folhaImg = folhaPronta(corte.folha);
    if (!folhaImg) return null;
    const folha = FOLHA[corte.folha];
    const x = folha.ox + corte.c * (folha.tile + folha.px);
    const y = folha.oy + corte.r * (folha.tile + folha.py);
    const canvas = document.createElement("canvas");
    canvas.width = folha.tile;
    canvas.height = folha.tile;
    canvas.getContext("2d").drawImage(folhaImg, x, y, folha.tile, folha.tile, 0, 0, folha.tile, folha.tile);
    recortes.set(chave, canvas);
    return canvas;
  }
  const url = urlDeRef(ref);
  if (!url) return null;
  let img = imagens.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    imagens.set(url, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}
