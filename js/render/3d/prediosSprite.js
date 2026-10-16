/**
 * Sprites exteriores iguais aos do Pokémon AI: o mesmo tileset e o mesmo grid.
 * O cartão fica em pé, com o pé no chão, como as casas de cartão.
 */
import * as THREE from "three";
import { ALTURA_PRACA, amostraKanto } from "../../mundo/regiao/amostraKanto.js";
import { AREA_KANTO } from "../../mundo/regiao/grafoKanto.js";
import { aplicarLuzCidade } from "./luzes/mapaChao.js";
import { aplicarLuzBillboard } from "./ceu/luzBillboard.js";
import {
  TIPOS_GINASIO,
  assarSprite,
  chaveSpritePredio,
  medidaSprite,
  pontosGradeUsina,
} from "../../mundo/cidade/spritesPredio.js";

const ALFA = 0.12;

export { chaveSpritePredio };

function carregarImagem(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
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
  const tam = medidaSprite(id, def);
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
          const tela = assarSprite(def, img, tipo);
          if (!tela) continue;
          folhas.set(tipo ? `${id}:${tipo}` : id, folhaDe(id, def, tela));
        }
      }
      return folhas;
    });
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
  const pontos = pontosGradeUsina(usina, gestao);
  const grupo = new THREE.Group();
  grupo.name = "usina";
  for (let i = 0; i < pontos.length; i++) {
    const ponto = pontos[i];
    const folha = ponto.sprite === "eletrical-management-building" ? gestao : usina;
    const sprite = criarSpritePredio(folha);
    sprite.position.set(ponto.x, amostraKanto(ponto.x, ponto.y)?.h ?? ALTURA_PRACA, ponto.y);
    grupo.add(sprite);
  }
  const ox = 28 * AREA_KANTO;
  const oy = 8 * AREA_KANTO;
  return { grupo, cx: ox + 64, cy: oy + 64 };
}
