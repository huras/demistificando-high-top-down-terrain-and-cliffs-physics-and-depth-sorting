/**
 * Sprites exteriores iguais aos do Pokémon AI: o mesmo tileset e o mesmo grid.
 * O cartão fica em pé, com o pé no chão, como as casas de cartão.
 */
import * as THREE from "three";
import { ALTURA_PRACA, amostraKanto } from "../../mundo/regiao/amostraKanto.js";
import { AREA_KANTO } from "../../mundo/regiao/grafoKanto.js";
import { aplicarLuzCidade } from "./luzes/mapaChao.js";
import { aplicarLuzBillboard } from "./ceu/luzBillboard.js";

const ALFA = 0.12;
const MEIA_ESCALA = new Set([
  "museum",
  "pokemon-mansion-cinnabar",
  "usina-eletrica",
  "eletrical-management-building",
]);

const SPRITE_PAPEL = Object.freeze({
  lab: "pokemon-lab",
  ginasio: "gym-base",
  museu: "museum",
  torre: "tower-A",
  coliseu: "pokemon-stadium-center",
  porto: "pokemart",
  safari: "pokemart",
  mansao: "pokemon-mansion-cinnabar",
  esconderijo: "underground-ruins-entrance-doors-closed",
});

const TIPO_GINASIO = Object.freeze({
  brock: "rock",
  misty: "water",
  surge: "electric",
  erika: "grass",
  koga: "poison",
  sabrina: "psychic",
  blaine: "fire",
  giovanni: "ground",
});

const TIPOS_GINASIO = Object.freeze(Object.values(TIPO_GINASIO));

function carregarImagem(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

function desenharTile(ctx, img, tileId, colunas, tile, dx, dy) {
  if (tileId == null) return;
  const col = tileId % colunas;
  const row = Math.floor(tileId / colunas);
  ctx.drawImage(img, col * tile, row * tile, tile, tile, dx, dy, tile, tile);
}

function assar(def, img, tipo) {
  const tile = def.tileSize || 16;
  const tela = document.createElement("canvas");
  tela.width = Math.max(1, def.cols * tile);
  tela.height = Math.max(1, def.rows * tile);
  const ctx = tela.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  const simbolo = tipo ? def.overlay?.types?.[tipo] : null;
  const ox = def.overlay?.originCol | 0;
  const oy = def.overlay?.originRow | 0;
  for (let row = 0; row < def.rows; row++) {
    const linha = def.grid[row];
    if (!linha) continue;
    for (let col = 0; col < def.cols; col++) {
      const celula = linha[col];
      if (!celula) continue;
      const dx = col * tile;
      const dy = row * tile;
      desenharTile(ctx, img, celula[0], def.columns, tile, dx, dy);
      if (!celula[1] || !simbolo) continue;
      const st = simbolo[row - oy]?.[col - ox];
      desenharTile(ctx, img, st, def.columns, tile, dx, dy);
    }
  }
  return tela;
}

function medida(id, def) {
  const s = MEIA_ESCALA.has(id) ? 0.5 : 1;
  return {
    largura: Math.max(1, Math.round(def.cols * s)),
    altura: Math.max(1, Math.round(def.rows * s)),
  };
}

function folhaDe(id, def, tela) {
  const tex = new THREE.CanvasTexture(tela);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  const mat = new THREE.MeshLambertMaterial({
    map: tex,
    transparent: true,
    alphaTest: ALFA,
    side: THREE.FrontSide,
    depthWrite: true,
  });
  aplicarLuzCidade(mat);
  aplicarLuzBillboard(mat);
  const tam = medida(id, def);
  return { ...tam, material: mat };
}

export function carregarSpritesPredio() {
  return fetch("assets/sprites/predios/manifesto.json")
    .then((res) => {
      if (!res.ok) throw new Error("manifesto dos prédios");
      return res.json();
    })
    .then(async (manifesto) => {
      const predios = manifesto.buildings || {};
      const arquivos = [...new Set(Object.values(predios).map((d) => d.image))];
      const imagens = new Map();
      await Promise.all(arquivos.map(async (arquivo) => {
        const img = await carregarImagem(`assets/sprites/predios/${encodeURIComponent(arquivo)}`);
        imagens.set(arquivo, img);
      }));
      const folhas = new Map();
      const ids = Object.keys(predios);
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const def = predios[id];
        const img = imagens.get(def.image);
        if (!img) continue;
        const tipos = id === "gym-base" ? [null, ...TIPOS_GINASIO] : [null];
        for (let t = 0; t < tipos.length; t++) {
          const tipo = tipos[t];
          const tela = assar(def, img, tipo);
          if (!tela) continue;
          folhas.set(tipo ? `${id}:${tipo}` : id, folhaDe(id, def, tela));
        }
      }
      return folhas;
    });
}

export function chaveSpritePredio(papel, ginasio) {
  if (papel === "ginasio") {
    const tipo = TIPO_GINASIO[ginasio];
    return tipo ? `gym-base:${tipo}` : "gym-base";
  }
  return SPRITE_PAPEL[papel] || null;
}

export function criarSpritePredio(folha) {
  const geo = new THREE.PlaneGeometry(folha.largura, folha.altura);
  geo.translate(0, folha.altura * 0.5, 0);
  const mesh = new THREE.Mesh(geo, folha.material);
  mesh.name = "predio-sprite";
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.rotation.order = "YXZ";
  const raiz = new THREE.Group();
  raiz.add(mesh);
  raiz.userData.cartao = mesh;
  return raiz;
}

/** Campus 3×3 da usina, no mesmo lugar do Pokémon AI (Zapdos). */
export function montarUsina(folhas) {
  const usina = folhas.get("usina-eletrica");
  if (!usina) return null;
  const gestao = folhas.get("eletrical-management-building");
  const fpU = { cols: usina.largura, rows: usina.altura };
  const fpG = gestao ? { cols: gestao.largura, rows: gestao.altura } : fpU;
  const passoX = Math.max(fpU.cols, fpG.cols) + 2;
  const passoY = Math.max(fpU.rows, fpG.rows) + 2;
  const ox = 28 * AREA_KANTO;
  const oy = 8 * AREA_KANTO;
  const grupo = new THREE.Group();
  grupo.name = "usina";
  for (let lin = 0; lin < 3; lin++) {
    for (let col = 0; col < 3; col++) {
      const centro = lin === 1 && col === 1 && gestao;
      const folha = centro ? gestao : usina;
      const x = 48 + col * passoX + Math.floor((passoX - 2 - folha.largura) / 2);
      const y = 46 + lin * passoY + Math.floor((passoY - 2 - folha.altura) / 2);
      const sprite = criarSpritePredio(folha);
      const wx = ox + x;
      const wy = oy + y;
      sprite.position.set(wx, amostraKanto(wx, wy)?.h ?? ALTURA_PRACA, wy);
      grupo.add(sprite);
    }
  }
  return { grupo, cx: ox + 64, cy: oy + 64 };
}
