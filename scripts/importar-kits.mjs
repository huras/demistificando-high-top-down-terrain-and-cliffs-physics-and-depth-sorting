/**
 * Lê os biomas de terra do Pokemon AI e grava biomas/kits.json,
 * copia os PNGs citados e repinta o cliff do demo com a paleta do chão.
 *
 * node scripts/importar-kits.mjs
 */
import { createRequire } from "node:module";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");
const POKEMON = join(RAIZ, "..", "Pokemon AI");

const TILE = 16;
const COLS_CHAO = 5;
const CENTRO_CHAO = 6 + 3 * COLS_CHAO;
const MASCARA = [255, 0, 255];

const MAPA_BIOMA = {
  plains_a: "lush-grass",
  desert_a: "faroeste-desert",
  Canyons_a: "amber-rock",
  rocky_peaks_a: "stone",
  Ice_Hight_Steps_a: "snow",
  Ice_Canyons_a: "tundra",
  ocean_a: "dirty-sand",
};

const PASTA = {
  grama: "vegetation",
  arvore: "trees",
  pedra: "rocks",
  cristal: "crystals",
};

function lerJson(caminho) {
  return JSON.parse(readFileSync(caminho, "utf8"));
}

function lerPng(caminho) {
  return PNG.sync.read(readFileSync(caminho));
}

function gravarPng(caminho, png) {
  mkdirSync(dirname(caminho), { recursive: true });
  writeFileSync(caminho, PNG.sync.write(png));
}

function luminancia(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function corEm(png, i) {
  const o = i * 4;
  return [png.data[o], png.data[o + 1], png.data[o + 2], png.data[o + 3]];
}

function ehMascara(r, g, b) {
  return r === MASCARA[0] && g === MASCARA[1] && b === MASCARA[2];
}

function coletarPaleta(png, x0, y0, x1, y1) {
  const cores = new Map();
  const xa = x0 ?? 0;
  const ya = y0 ?? 0;
  const xb = x1 ?? png.width;
  const yb = y1 ?? png.height;
  for (let y = ya; y < yb; y++) {
    for (let x = xa; x < xb; x++) {
      const [r, g, b, a] = corEm(png, y * png.width + x);
      if (a === 0 || ehMascara(r, g, b)) continue;
      cores.set(`${r},${g},${b}`, [r, g, b]);
    }
  }
  return [...cores.values()].sort(
    (a, b) => luminancia(a[0], a[1], a[2]) - luminancia(b[0], b[1], b[2]),
  );
}

function mapaDeCor(origem, destino) {
  const mapa = new Map();
  if (!origem.length || !destino.length) return mapa;
  const nOrigem = origem.length;
  const nDestino = destino.length;
  for (let i = 0; i < nOrigem; i++) {
    const j = Math.round((i * (nDestino - 1)) / Math.max(1, nOrigem - 1));
    mapa.set(origem[i].join(","), destino[j]);
  }
  return mapa;
}

function repintar(template, mapa) {
  const out = new PNG({ width: template.width, height: template.height });
  const n = template.width * template.height;
  for (let i = 0; i < n; i++) {
    const [r, g, b, a] = corEm(template, i);
    const o = i * 4;
    if (a === 0 || ehMascara(r, g, b)) {
      out.data[o] = r;
      out.data[o + 1] = g;
      out.data[o + 2] = b;
      out.data[o + 3] = a;
      continue;
    }
    const nova = mapa.get(`${r},${g},${b}`) || [r, g, b];
    out.data[o] = nova[0];
    out.data[o + 1] = nova[1];
    out.data[o + 2] = nova[2];
    out.data[o + 3] = a;
  }
  return out;
}

function recortar(png, indice, cols) {
  const col = indice % cols;
  const row = (indice / cols) | 0;
  const x0 = col * TILE;
  const y0 = row * TILE;
  if (x0 + TILE > png.width || y0 + TILE > png.height) return null;
  const out = new PNG({ width: TILE, height: TILE });
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const si = ((y0 + y) * png.width + (x0 + x)) * 4;
      const di = (y * TILE + x) * 4;
      out.data[di] = png.data[si];
      out.data[di + 1] = png.data[si + 1];
      out.data[di + 2] = png.data[si + 2];
      out.data[di + 3] = png.data[si + 3];
    }
  }
  return out;
}

function urlsDoBloco(src, nome) {
  const marca = `const ${nome}`;
  const inicio = src.indexOf(marca);
  if (inicio < 0) throw new Error(`bloco ausente: ${nome}`);
  const fim = src.indexOf("});", inicio);
  const bloco = src.slice(inicio, fim).replace(/\s+/g, " ");
  const re = /(?:"([^"]+)"|([A-Za-z0-9_-]+))\s*:\s*new URL\(\s*"([^"]+)"/g;
  const mapa = new Map();
  let m;
  while ((m = re.exec(bloco))) {
    mapa.set(m[1] || m[2], m[3].replaceAll("\\", "/"));
  }
  return mapa;
}

function chaoPorBioma(src) {
  const mapa = new Map();
  const re =
    /(?:"([^"]+)"|([A-Za-z0-9_-]+))\s*:\s*Object\.freeze\(\{[^}]*?groundKey:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) {
    mapa.set(m[1] || m[2], m[3]);
  }
  return mapa;
}

function garantirLista(kit, chave) {
  if (!kit[chave]) kit[chave] = [];
  return kit[chave];
}

function adicionar(kit, chave, id, peso, sprites, urls, classe) {
  const rel = urls.get(id);
  if (!rel) {
    console.warn("sprite sem arquivo:", id);
    return;
  }
  const origem = join(POKEMON, rel.replace(/^\.\.\/\.\.\//, ""));
  const arquivo = `assets/${PASTA[classe]}/${basename(rel)}`;
  try {
    mkdirSync(join(RAIZ, "assets", PASTA[classe]), { recursive: true });
    copyFileSync(origem, join(RAIZ, arquivo));
  } catch (err) {
    console.warn("cópia falhou:", id, err.message);
    return;
  }
  sprites[id] = { classe, arquivo };
  garantirLista(kit, chave).push({ id, peso: Number(peso) || 1 });
}

function main() {
  const config = lerJson(join(POKEMON, "data", "biome-config.json"));
  const worldArt = readFileSync(join(POKEMON, "src", "sprites", "worldArt.js"), "utf8");
  const defaults = readFileSync(
    join(POKEMON, "src", "map", "terrain", "biomeDefaults.js"),
    "utf8",
  );
  const urls = new Map([
    ...urlsDoBloco(worldArt, "GRASS_VEG_URLS"),
    ...urlsDoBloco(worldArt, "TREE_VEG_URLS"),
    ...urlsDoBloco(worldArt, "ROCK_VEG_URLS"),
    ...urlsDoBloco(worldArt, "CRYSTAL_VEG_URLS"),
  ]);
  const chaoDe = chaoPorBioma(defaults);
  const terras = Object.keys(config.land || {});
  const kits = {};
  const sprites = {};
  const template = lerPng(join(RAIZ, "assets", "terrain", "grass-on-dirt.png"));
  const paletaTemplate = coletarPaleta(template);

  for (const id of terras) {
    const chao = chaoDe.get(id) || null;
    kits[id] = {
      chao,
      chaoArquivo: chao ? `assets/terrain/centro/${chao}.png` : null,
      cliffArquivo: `assets/terrain/cliffs/${id}.png`,
      grama: [],
      arvore: [],
      pedra: [],
      cristal: [],
    };
  }

  for (const item of config.vegetation || []) {
    if (item.kind !== "grass" && item.kind !== "tree") continue;
    if (item.kind === "grass" && item.enabled === false) continue;
    const chave = item.kind === "grass" ? "grama" : "arvore";
    const classe = chave;
    for (const terra of item.land || []) {
      if (!kits[terra]) continue;
      adicionar(kits[terra], chave, item.id, item.weight, sprites, urls, classe);
    }
  }

  for (const item of config.rocks || []) {
    const kind = item.kind || "rock";
    if (kind !== "rock" && kind !== "crystal") continue;
    const chave = kind === "crystal" ? "cristal" : "pedra";
    for (const terra of item.land || []) {
      if (!kits[terra]) continue;
      adicionar(kits[terra], chave, item.id, 1, sprites, urls, chave);
    }
  }

  const chaoFeito = new Set();
  for (const id of terras) {
    const kit = kits[id];
    const sheetPath = kit.chao
      ? join(POKEMON, "sprites", "terrain", "processed", `${kit.chao}.png`)
      : null;
    let sheet = null;
    try {
      if (sheetPath) sheet = lerPng(sheetPath);
    } catch (err) {
      console.warn("chão ausente:", kit.chao, err.message);
    }
    if (sheet && kit.chao && !chaoFeito.has(kit.chao)) {
      const tile = recortar(sheet, CENTRO_CHAO, COLS_CHAO);
      if (tile) {
        gravarPng(join(RAIZ, kit.chaoArquivo), tile);
        chaoFeito.add(kit.chao);
      }
    }
    let paleta = [];
    if (sheet) {
      const col = CENTRO_CHAO % COLS_CHAO;
      const row = (CENTRO_CHAO / COLS_CHAO) | 0;
      paleta = coletarPaleta(
        sheet,
        col * TILE,
        row * TILE,
        col * TILE + TILE,
        row * TILE + TILE,
      );
      if (paleta.length < 2) paleta = coletarPaleta(sheet);
    }
    if (paleta.length) {
      gravarPng(
        join(RAIZ, kit.cliffArquivo),
        repintar(template, mapaDeCor(paletaTemplate, paleta)),
      );
    } else {
      kit.cliffArquivo = null;
    }
  }

  const saida = {
    versao: 1,
    gramaChance: 0.35,
    pedraChance: 0.02,
    sprites,
    kits,
  };
  writeFileSync(join(RAIZ, "biomas", "kits.json"), JSON.stringify(saida, null, 2));

  const mundoPath = join(RAIZ, "biomas", "mundo.json");
  const mundo = lerJson(mundoPath);
  for (const bioma of mundo.biomas || []) {
    if (MAPA_BIOMA[bioma.id]) bioma.kit = MAPA_BIOMA[bioma.id];
  }
  writeFileSync(mundoPath, JSON.stringify(mundo, null, 2) + "\n");

  const resumo = terras.map((id) => {
    const k = kits[id];
    return `${id} chao=${k.chao || "-"} g=${k.grama.length} a=${k.arvore.length} p=${k.pedra.length} c=${k.cristal.length}`;
  });
  console.log(resumo.join("\n"));
  console.log("sprites", Object.keys(sprites).length, "kits", terras.length);
}

main();
