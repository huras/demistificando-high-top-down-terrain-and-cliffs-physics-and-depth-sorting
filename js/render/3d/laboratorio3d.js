/**
 * Casca, piso e sprites do laboratório. As malhas compartilham material.
 * O grupo mora no terreno, então o billboard desfaz o esmagamento vertical.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../../config.js";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { pivoDaImagem } from "../pivoPe.js";
import { aplicarLuzBillboard } from "./ceu/luzBillboard.js";
import { aplicarLuzCidade } from "./luzes/mapaChao.js";
import {
  ALTURA_PAREDE_LAB,
  ORIGEM_LAB_X,
  ORIGEM_LAB_Y,
  plantaLaboratorio,
} from "../../mundo/cidade/laboratorio.js";
import { fotoCuraMaquina, SLOTS_CURA } from "../../jogo/maquinaCura.js";

const PX = 16;
const FOLHA_MOVEIS = "/ref/sprites/interiors/dcj0huc-7206dd1d-9450-4232-a708-b07b4bd0c392.png";
const FOLHA_VASO = "/ref/sprites/interiors/Safari-Zone-Inner-Room-Hospital-Tileset-629434880.png";
const FOLHA_PISO = "/ref/sprites/buildings/Mountains-Trees-and-Public-Decorations-Fan-Game-757531020.png";
const FOLHA_GENTE =
  "/ref/sprites/people/logic 2/DS _ DSi - Pokemon Platinum - Non-Playable Characters - NPCs.png";

const RECORTE = Object.freeze({
  tank: Object.freeze({ url: "/ref/sprites/interiors/lab/lab-incubator-tank-empty-feet.png" }),
  tankBolas: Object.freeze({ url: "/ref/sprites/interiors/lab/lab-incubator-tank-pokeballs-feet.png" }),
  pc: Object.freeze({ url: "/ref/sprites/interiors/lab/lab-computer-blank.png" }),
  pcGrafico: Object.freeze({ url: "/ref/sprites/interiors/lab/lab-computer-graph.png" }),
  mesa: Object.freeze({ url: "/ref/sprites/interiors/lab/lab-table-empty.png" }),
  estante: Object.freeze({ url: FOLHA_MOVEIS, col: 0, row: 45, cols: 2, rows: 2, tile: 16 }),
  escrivaninha: Object.freeze({ url: FOLHA_MOVEIS, col: 4, row: 44, cols: 2, rows: 2, tile: 16 }),
  tapete: Object.freeze({ url: FOLHA_MOVEIS, col: 0, row: 54, cols: 2, rows: 1, tile: 16 }),
  livros: Object.freeze({ url: FOLHA_MOVEIS, col: 3, row: 45, cols: 1, rows: 1, tile: 16 }),
  cura: Object.freeze({ url: FOLHA_MOVEIS, col: 6, row: 43, cols: 2, rows: 3, tile: 16 }),
  vasoA: Object.freeze({ url: FOLHA_VASO, col: 15, row: 41, cols: 3, rows: 6, tile: 16, escala: 0.5 }),
  vasoB: Object.freeze({ url: FOLHA_VASO, col: 18, row: 41, cols: 3, rows: 6, tile: 16, escala: 0.5 }),
  vasoC: Object.freeze({ url: FOLHA_VASO, col: 21, row: 40, cols: 3, rows: 7, tile: 16, escala: 0.5 }),
});

const cartoes = [];
const bolasCura = [];

function imagem(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = encodeURI(url);
  });
}

function recortar(img, def) {
  if (!def.tile) return img;
  const tela = document.createElement("canvas");
  tela.width = def.cols * def.tile;
  tela.height = def.rows * def.tile;
  const ctx = tela.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    img,
    def.col * def.tile,
    def.row * def.tile,
    tela.width,
    tela.height,
    0,
    0,
    tela.width,
    tela.height,
  );
  return tela;
}

function materialSprite(tela) {
  const tex = new THREE.CanvasTexture(tela);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  const mat = new THREE.MeshLambertMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.12,
    side: THREE.FrontSide,
    depthWrite: true,
  });
  aplicarLuzCidade(mat);
  aplicarLuzBillboard(mat);
  return mat;
}

function moldePe(tela, escala = 1) {
  const pivo = pivoDaImagem(tela);
  const largura = (tela.width / PX) * escala;
  const altura = (tela.height / PX) * escala;
  const geo = new THREE.PlaneGeometry(largura, altura);
  geo.translate(largura * (0.5 - pivo.x), altura * (pivo.y - 0.5), 0);
  return { geo, material: materialSprite(tela) };
}

function moldeChao(tela) {
  const largura = tela.width / PX;
  const altura = tela.height / PX;
  const geo = new THREE.PlaneGeometry(largura, altura);
  return { geo, material: materialSprite(tela) };
}

function emPe(grupo) {
  grupo.scale.y = 1 / ALTURA_BLOCO;
  return grupo;
}

function porBillboard(molde, x, z) {
  if (!molde) return null;
  const mesh = new THREE.Mesh(molde.geo, molde.material);
  mesh.rotation.order = "YXZ";
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  const raiz = emPe(new THREE.Group());
  raiz.add(mesh);
  raiz.position.set(x, ALTURA_PRACA, z);
  raiz.userData.cartao = mesh;
  cartoes.push(mesh);
  return raiz;
}

function porChao(molde, x, z) {
  if (!molde) return null;
  const mesh = new THREE.Mesh(molde.geo, molde.material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, ALTURA_PRACA + 0.14, z);
  mesh.receiveShadow = true;
  return mesh;
}

function materialCaixa(cor) {
  const mat = new THREE.MeshLambertMaterial({
    color: cor,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  aplicarLuzCidade(mat);
  return mat;
}

function bloco(largura, altura, fundo, x, y, z, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(largura, altura, fundo), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

function quadroGente(img, coluna) {
  const faixa = 17;
  const lado = 32;
  const quadros = 9;
  const col = coluna % faixa;
  const banda = Math.floor(coluna / faixa);
  const tela = document.createElement("canvas");
  tela.width = lado;
  tela.height = lado;
  const ctx = tela.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, col * lado, banda * quadros * lado, lado, lado, 0, 0, lado, lado);
  return tela;
}

function anexarCasca(grupo, piso) {
  const planta = plantaLaboratorio();
  const parede = materialCaixa("#c4b8a8");
  const h = ALTURA_PAREDE_LAB;
  const y = ALTURA_PRACA + h * 0.5;
  for (let i = 0; i < planta.muros.length; i++) {
    const r = planta.muros[i];
    grupo.add(
      bloco(
        r.w,
        h,
        r.h,
        ORIGEM_LAB_X + r.x + r.w * 0.5,
        y,
        ORIGEM_LAB_Y + r.y + r.h * 0.5,
        parede,
      ),
    );
  }
  if (!piso) return;
  for (let i = 0; i < planta.pisos.length; i++) {
    const r = planta.pisos[i];
    const tex = piso.clone();
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(r.w, r.h);
    tex.needsUpdate = true;
    const mat = new THREE.MeshLambertMaterial({
      map: tex,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    aplicarLuzCidade(mat);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(
      ORIGEM_LAB_X + r.x + r.w * 0.5,
      ALTURA_PRACA + 0.08,
      ORIGEM_LAB_Y + r.y + r.h * 0.5,
    );
    mesh.receiveShadow = true;
    grupo.add(mesh);
  }
}

function pendurarBolasCura(cartao) {
  const geo = new THREE.SphereGeometry(0.16, 10, 8);
  const faixaGeo = new THREE.CylinderGeometry(0.165, 0.165, 0.045, 10);
  const faixa = new THREE.MeshLambertMaterial({ color: 0xef4444 });
  aplicarLuzCidade(faixa);
  for (let i = 0; i < SLOTS_CURA.length; i++) {
    const slot = SLOTS_CURA[i];
    const mat = new THREE.MeshLambertMaterial({
      color: 0xf8fafc,
      emissive: 0xb8fff0,
      emissiveIntensity: 0,
    });
    aplicarLuzCidade(mat);
    const bola = new THREE.Group();
    const corpo = new THREE.Mesh(geo, mat);
    const cinto = new THREE.Mesh(faixaGeo, faixa);
    cinto.rotation.z = Math.PI / 2;
    bola.add(corpo);
    bola.add(cinto);
    const baseY = 1.5 - slot.y;
    bola.position.set(slot.x, baseY, 0.18);
    bola.userData.baseY = baseY;
    bola.userData.mat = mat;
    bola.visible = false;
    cartao.add(bola);
    bolasCura.push(bola);
  }
}

function anexarBolas(grupo) {
  const planta = plantaLaboratorio();
  const geo = new THREE.SphereGeometry(0.16, 10, 8);
  const mat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
  aplicarLuzCidade(mat);
  const faixa = new THREE.MeshLambertMaterial({ color: 0xef4444 });
  aplicarLuzCidade(faixa);
  for (let i = 0; i < planta.bolas.length; i++) {
    const bola = planta.bolas[i];
    const raiz = emPe(new THREE.Group());
    const corpo = new THREE.Mesh(geo, mat);
    const cinto = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.05, 10), faixa);
    cinto.rotation.z = Math.PI / 2;
    raiz.add(corpo);
    raiz.add(cinto);
    raiz.position.set(ORIGEM_LAB_X + bola.x, ALTURA_PRACA + 1.7, ORIGEM_LAB_Y + bola.y);
    grupo.add(raiz);
  }
}

export function atualizarLaboratorio(yaw, inclinacao) {
  for (let i = 0; i < cartoes.length; i++) {
    cartoes[i].rotation.x = inclinacao;
    cartoes[i].rotation.y = yaw;
  }
  const foto = fotoCuraMaquina();
  for (let i = 0; i < bolasCura.length; i++) {
    const bola = bolasCura[i];
    const quadro = foto ? foto[i] : null;
    if (!quadro || !quadro.visivel) {
      bola.visible = false;
      continue;
    }
    bola.visible = true;
    const s = quadro.escala;
    bola.scale.set(s, s, s);
    bola.position.y = bola.userData.baseY + (quadro.sobe || 0);
    bola.userData.mat.emissiveIntensity = quadro.brilho || 0;
  }
}

export function montarLaboratorio3d(grupo) {
  const planta = plantaLaboratorio();
  const sala = new THREE.Group();
  sala.name = "laboratorio";
  grupo.add(sala);

  const pedidos = new Map();
  function pedir(url) {
    if (!pedidos.has(url)) pedidos.set(url, imagem(url).catch(() => null));
    return pedidos.get(url);
  }
  const chaves = Object.keys(RECORTE);
  return Promise.all([
    ...chaves.map((id) => pedir(RECORTE[id].url)),
    pedir(FOLHA_PISO),
    pedir(FOLHA_GENTE),
  ]).then((imagens) => {
    const porUrl = new Map();
    let cursor = 0;
    for (let i = 0; i < chaves.length; i++) porUrl.set(RECORTE[chaves[i]].url, imagens[cursor++]);
    const pisoImg = imagens[cursor++];
    const gente = imagens[cursor];
    const moldes = new Map();
    const moldesChao = new Map();
    for (let i = 0; i < chaves.length; i++) {
      const id = chaves[i];
      const bruto = porUrl.get(RECORTE[id].url);
      if (!bruto) continue;
      const tela = recortar(bruto, RECORTE[id]);
      if (id === "tapete" || id === "livros") moldesChao.set(id, moldeChao(tela));
      moldes.set(id, moldePe(tela, RECORTE[id].escala || 1));
    }
    let piso = null;
    if (pisoImg) {
      const tile = 32;
      const col = 1033 % 8;
      const row = (1033 / 8) | 0;
      const tela = document.createElement("canvas");
      tela.width = tile;
      tela.height = tile;
      const ctx = tela.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pisoImg, col * tile, row * tile, tile, tile, 0, 0, tile, tile);
      piso = new THREE.CanvasTexture(tela);
      piso.colorSpace = THREE.SRGBColorSpace;
      piso.magFilter = THREE.NearestFilter;
      piso.minFilter = THREE.NearestFilter;
      piso.generateMipmaps = false;
      piso.wrapS = THREE.RepeatWrapping;
      piso.wrapT = THREE.RepeatWrapping;
      piso.needsUpdate = true;
    }
    anexarCasca(sala, piso);
    for (let i = 0; i < planta.moveis.length; i++) {
      const item = planta.moveis[i];
      const x = ORIGEM_LAB_X + item.x;
      const z = ORIGEM_LAB_Y + (item.chao ? item.y : item.footY);
      const inst = item.chao ? porChao(moldesChao.get(item.id), x, z) : porBillboard(moldes.get(item.id), x, ORIGEM_LAB_Y + item.footY);
      if (!inst) continue;
      sala.add(inst);
      if (item.id === "cura" && inst.userData.cartao) pendurarBolasCura(inst.userData.cartao);
    }
    if (gente) {
      const moldeNpc = new Map();
      for (let i = 0; i < planta.npcs.length; i++) {
        const npc = planta.npcs[i];
        if (!moldeNpc.has(npc.coluna)) moldeNpc.set(npc.coluna, moldePe(quadroGente(gente, npc.coluna)));
        const inst = porBillboard(moldeNpc.get(npc.coluna), ORIGEM_LAB_X + npc.x, ORIGEM_LAB_Y + npc.y);
        if (inst) {
          inst.name = `npc-${npc.id}`;
          sala.add(inst);
        }
      }
    }
    anexarBolas(sala);
  });
}
