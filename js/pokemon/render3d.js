import * as THREE from "three";
import { ALTURA_BLOCO } from "../config.js";
import { criarSombraContato3d } from "../render/3d/sombraContato3d.js";
import { obterBola } from "./captura.js";
import { projeteisVivos } from "./combate/projeteis.js";
import { dropsNoChao } from "./drops.js";
import { blitQuadro, quadroDe, garantirAtlas, direcao8Camera, medidaSprite } from "./sprites.js";
import { atoresVisiveis, pokemonLigado } from "./sistema.js";
import { carregarCatalogoLuzes, pontosDoModelo } from "../render/3d/luzes/catalogo.js";
import { criarCartaoLuz, oferecerLuz } from "../render/3d/luzes/pool.js";

const PX_MUNDO = 1.2 / 32;
const LADO = 256;
const PE_X = LADO * 0.5;
const PE_Y = LADO - 64;
const CAP_ATOR = 20;
const CAP_TIRO = 32;
const CAP_DROP = 48;
const MAX_BRILHO = 4;
const _mundo = new THREE.Vector3();

let cena = null;
let atores = [];
const porId = new Map();
let tiros = [];
let drops = [];
let bolaMesh = null;
let pontoTex = null;

function texturaPonto() {
  if (pontoTex) return pontoTex;
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(8, 8, 7, 0, Math.PI * 2);
  g.fill();
  pontoTex = new THREE.CanvasTexture(c);
  pontoTex.magFilter = THREE.NearestFilter;
  pontoTex.minFilter = THREE.NearestFilter;
  pontoTex.colorSpace = THREE.SRGBColorSpace;
  return pontoTex;
}

function criarAtorSlot() {
  const grupo = new THREE.Group();
  const canvas = document.createElement("canvas");
  canvas.width = LADO;
  canvas.height = LADO;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    alphaTest: 0.12,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.center.set(PE_X / LADO, (LADO - PE_Y) / LADO);
  sprite.scale.set(LADO * PX_MUNDO, LADO * PX_MUNDO, 1);
  sprite.renderOrder = 3;
  grupo.add(sprite);
  const sombra = criarSombraContato3d();
  grupo.add(sombra.grupo);
  const brilhos = [];
  for (let i = 0; i < MAX_BRILHO; i++) {
    const brilho = criarCartaoLuz("#fff1d0", 0.6);
    brilho.visible = false;
    grupo.add(brilho);
    brilhos.push(brilho);
  }
  grupo.visible = false;
  cena.add(grupo);
  return { grupo, canvas, ctx, tex, mat, sprite, sombra, brilhos, chave: "", livre: true };
}

function criarPonto(cor) {
  const mat = new THREE.SpriteMaterial({
    map: texturaPonto(),
    color: cor,
    transparent: true,
    depthWrite: false,
    alphaTest: 0.1,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 4;
  sprite.visible = false;
  cena.add(sprite);
  return sprite;
}

export function ligarPokemon3d(scene) {
  if (cena) return;
  cena = scene;
  carregarCatalogoLuzes();
  for (let i = 0; i < CAP_ATOR; i++) atores.push(criarAtorSlot());
  for (let i = 0; i < CAP_TIRO; i++) tiros.push(criarPonto("#ffffff"));
  for (let i = 0; i < CAP_DROP; i++) drops.push(criarPonto("#fbbf24"));
  bolaMesh = criarPonto("#f8fafc");
  bolaMesh.scale.set(0.28, 0.28, 1);
}

function ancorar(slot) {
  slot.sprite.center.set(PE_X / LADO, (LADO - PE_Y) / LADO);
  slot.sprite.visible = true;
}

function aplicarMedida(slot, ator) {
  const { escala, offsetY } = medidaSprite(ator);
  slot.sprite.position.y = -offsetY;
  slot.sprite.scale.set(LADO * PX_MUNDO * escala, LADO * PX_MUNDO * escala, 1);
  return offsetY;
}

function pintar(slot, ator, fr, pack) {
  const chave = `${ator.id}:${pack.id}:${ator.visual?.anim}:${ator.visual?.dir}:${ator.visual?.frame}:${ator.morto ? 1 : 0}`;
  if (slot.chave === chave) return;
  slot.chave = chave;
  slot.ctx.imageSmoothingEnabled = false;
  slot.ctx.clearRect(0, 0, LADO, LADO);
  blitQuadro(slot.ctx, pack.img, pack.atlasW, pack.atlasH, fr, PE_X, PE_Y, 1);
  slot.tex.needsUpdate = true;
  slot.mat.color.set("#ffffff");
  ancorar(slot);
}

function fallback(slot, ator) {
  const chave = `cor:${ator.id}:${ator.especie.key}:${ator.morto ? 1 : 0}`;
  if (slot.chave === chave) return;
  slot.chave = chave;
  slot.ctx.clearRect(0, 0, LADO, LADO);
  slot.ctx.fillStyle = ator.especie.cor || "#94a3b8";
  slot.ctx.beginPath();
    slot.ctx.arc(PE_X, PE_Y - 18, 14, 0, Math.PI * 2);
    slot.ctx.fill();
    slot.tex.needsUpdate = true;
  ancorar(slot);
}

function aplicarBrilho(slot, ator, offsetY) {
  const pontos = ator.morto ? [] : pontosDoModelo(ator.especie?.key);
  const n = Math.min(pontos.length, slot.brilhos.length);
  for (let i = 0; i < slot.brilhos.length; i++) {
    const brilho = slot.brilhos[i];
    if (i >= n) {
      brilho.visible = false;
      continue;
    }
    const p = pontos[i];
    brilho.visible = true;
    brilho.position.set(p.x, p.y - offsetY, 0.02);
    brilho.material.color.set(p.cor);
    const lado = Math.max(0.35, p.raio * 0.85);
    brilho.scale.set(lado, lado, 1);
  }
  if (!n) return;
  slot.grupo.updateWorldMatrix(true, false);
  for (let i = 0; i < n; i++) {
    const p = pontos[i];
    _mundo.set(p.x, p.y - offsetY, 0).applyMatrix4(slot.grupo.matrixWorld);
    oferecerLuz(ator.id, _mundo.x, _mundo.y, _mundo.z, p.cor, p.raio, p.intensidade);
  }
}

function pegarLivre() {
  for (let i = 0; i < atores.length; i++) {
    if (atores[i].livre) return atores[i];
  }
  return null;
}

export function atualizarPokemon3d(yawCam = 0) {
  if (!cena || !pokemonLigado()) return;
  const lista = atoresVisiveis();
  const vistos = new Set();
  for (let i = 0; i < lista.length; i++) {
    const ator = lista[i];
    let slot = porId.get(ator.id);
    if (!slot) {
      slot = pegarLivre();
      if (!slot) continue;
      slot.livre = false;
      slot.chave = "";
      porId.set(ator.id, slot);
    }
    vistos.add(ator.id);
    slot.grupo.visible = true;
    const elev = (ator.elevacao ?? ator.z ?? 0) + (ator.hopLift || 0);
    slot.grupo.position.set(ator.x, elev * ALTURA_BLOCO, ator.y);
    const pack = garantirAtlas(ator.especie.dex, ator.shiny);
    const visual = ator.visual;
    const dirMundo = visual?.dir;
    if (visual) {
      const rel = direcao8Camera(ator.dirX || 0, ator.dirY || 0, yawCam);
      if (rel != null) visual.dir = rel;
    }
    const fr = quadroDe(ator, pack);
    if (fr && pack.img && pack.estado === "pronto") pintar(slot, ator, fr, pack);
    else fallback(slot, ator);
    const offsetY = aplicarMedida(slot, ator);
    if (visual && dirMundo != null) visual.dir = dirMundo;
    slot.sombra.atualizar(
      { x: ator.x, y: ator.y, z: ator.z, noChao: true, elevacao: ator.z },
      elev,
    );
    aplicarBrilho(slot, ator, offsetY);
  }
  for (const [id, slot] of porId) {
    if (vistos.has(id)) continue;
    slot.grupo.visible = false;
    slot.livre = true;
    slot.chave = "";
    for (let b = 0; b < slot.brilhos.length; b++) slot.brilhos[b].visible = false;
    porId.delete(id);
  }

  const tirosVivos = projeteisVivos();
  for (let i = 0; i < tiros.length; i++) {
    const mesh = tiros[i];
    const p = tirosVivos[i];
    if (!p) {
      mesh.visible = false;
      continue;
    }
    mesh.visible = true;
    mesh.material.color.set(p.cor || "#ffffff");
    mesh.scale.set(0.22, 0.22, 1);
    mesh.position.set(p.x, p.z * ALTURA_BLOCO, p.y);
  }

  const noChao = dropsNoChao();
  for (let i = 0; i < drops.length; i++) {
    const mesh = drops[i];
    const item = noChao[i];
    if (!item) {
      mesh.visible = false;
      continue;
    }
    mesh.visible = true;
    mesh.material.color.set("#fbbf24");
    mesh.scale.set(0.18, 0.18, 1);
    mesh.position.set(item.x, item.z * ALTURA_BLOCO + 0.25, item.y);
  }

  const bola = obterBola();
  if (!bolaMesh) return;
  if (!bola) {
    bolaMesh.visible = false;
    return;
  }
  bolaMesh.visible = true;
  const pulo = bola.fase === "tremendo" ? Math.sin(bola.faseT * 18) * 0.08 : 0;
  bolaMesh.position.set(bola.x, bola.z * ALTURA_BLOCO + pulo, bola.y);
}
