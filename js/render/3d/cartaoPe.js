/**
 * Cartão no pé, compartilhado pelo laboratório e pelos interiores.
 * O grupo do terreno esmaga o Y; o billboard desfaz isso.
 */
import * as THREE from "three";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { aplicarEscalaCartao } from "./escalaVertical.js";
import { geometriaNoPe } from "./billboard/indice.js";
import { pivoDaImagem } from "../pivoPe.js";
import { aplicarLuzBillboard, FOLGA_CHAO_DECAL } from "./ceu/luzBillboard.js";
import { aplicarLuzCidade } from "./luzes/mapaChao.js";
import { fotoCuraMaquina, SLOTS_CURA } from "../../jogo/maquinaCura.js";

const PX = 16;
const FOLGA_PE = 0.08;
const cartoes = [];

export function imagem(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = encodeURI(url);
  });
}

export function recortar(img, def) {
  if (!def?.tile) return img;
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

export function materialSprite(tela, folga = FOLGA_PE) {
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
  aplicarLuzBillboard(mat, folga);
  return mat;
}

export function moldePe(tela, escala = 1) {
  const pivo = pivoDaImagem(tela);
  const largura = (tela.width / PX) * escala;
  const altura = (tela.height / PX) * escala;
  const geo = geometriaNoPe(pivo.x, pivo.y, largura, altura);
  return { geo, material: materialSprite(tela) };
}

export function moldeChao(tela) {
  const largura = tela.width / PX;
  const altura = tela.height / PX;
  const geo = new THREE.PlaneGeometry(largura, altura);
  return { geo, material: materialSprite(tela, FOLGA_CHAO_DECAL) };
}

export function emPe(grupo) {
  return aplicarEscalaCartao(grupo);
}

export function porBillboard(molde, x, z) {
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

export function porChao(molde, x, z) {
  if (!molde) return null;
  const mesh = new THREE.Mesh(molde.geo, molde.material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, ALTURA_PRACA + 0.14, z);
  mesh.receiveShadow = true;
  return mesh;
}

export function quadroGente(img, coluna) {
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

export function girarCartoes(yaw, inclinacao) {
  for (let i = 0; i < cartoes.length; i++) {
    cartoes[i].rotation.x = inclinacao;
    cartoes[i].rotation.y = yaw;
  }
}

/** Todas as faces gravam depth, pra uma parede não pintar por cima da outra. O cartão já usa o depth do pé. */
export function facesParedeInterior(lateral, topo) {
  const cima = topo && topo !== lateral ? topo : lateral;
  return [lateral, lateral, cima, lateral, lateral, lateral];
}

export function criarBolasCura(cartao) {
  const bolas = [];
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
    bolas.push(bola);
  }
  return bolas;
}

export function atualizarBolasCura(bolas, ativo) {
  const foto = ativo ? fotoCuraMaquina() : null;
  for (let i = 0; i < bolas.length; i++) {
    const bola = bolas[i];
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
