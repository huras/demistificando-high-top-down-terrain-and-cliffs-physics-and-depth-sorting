import * as THREE from "three";
import { ALTURA_BLOCO, BILLBOARD_INCLINACAO, TILE, VEG_MATA_ESCALA } from "../config.js";
import { particulasVivas } from "../pokemon/combate/particulas.js";
import { impactosVivos, projeteisVivos } from "../pokemon/combate/projeteis.js";
import { aplicarPose, carregarFolhasGolpe, poseImpacto, poseTiro } from "../pokemon/combate/folhasGolpe.js";
import { aurasVivas, ORBES_KI } from "../pokemon/combate/ki.js";
import {
  CHAO,
  pecaCobertura,
  pecaGrama,
  quantidadeCobertura,
  quantidadeGrama,
  tipoMetade,
  versaoCobertura,
} from "./arenas.js";
import { CAM_TURNO } from "./cameraTurno.js";
import { blitQuadro, centroDoQuadro, direcao8Camera, garantirAtlas, medidaSprite, quadroDe } from "../pokemon/sprites.js";
import { projetarCentroNoChao } from "../render/3d/sombraContato3d.js";
import { tickFadeArena } from "../render/3d/fadeObstaculo3d.js";
import {
  aplicarPivoCartao,
  criarAtorCartao,
  poseAtorCartao,
} from "../render/3d/billboard/atorCartao.js";

const PX_MUNDO = 1 / TILE;
const LADO = 256;
const PE_X = LADO * 0.5;
const PE_Y = LADO - 64;
const PIVO_X = PE_X / LADO;
const PIVO_Y = PE_Y / LADO;
const CAP_TIRO = 64;
const CAP_COBERTURA = 6;
const CAP_GRAMA = 40;
const CAP_FAISCA = 160;
const CAP_TRACO = 24;
const CAP_KI = 8;

let canvas = null;
let renderer = null;
let cena = null;
let camera = null;
let largura = 0;
let altura = 0;
let az = 0.62;
let elev = 0.46;
let dist = 22;
let distUsuario = false;
let arraste = null;

const alvo = new THREE.Vector3(0, 1.15, 0);
const ponto = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _direita = new THREE.Vector3();
const _frente = new THREE.Vector3();
const ombroPos = new THREE.Vector3();
const ombroFim = new THREE.Vector3();
const ombroOlhar = new THREE.Vector3();
const ombroOlharFim = new THREE.Vector3();
let ombro = null;
let ombroDt = 0.016;
let ombroSegurando = false;
let teatroAng = 0;
const _desloc = { x: 0, z: 0 };
const slots = [];
const tiros = [];
const faiscas = [];
const tracos = [];
const kiHalos = [];
const kiNucleos = [];
const kiOrbes = [];
const chaoTex = new Map();
const spriteTex = new Map();
const metadesChao = [];
const coberturas = [];
const gramas = [];
/** @type {{ chave: string, x: number, y: number, r: number, elev: number }[]} */
const pecasFade = [];
let chaoNormal = null;
let coberturaVista = -1;
let spritesVista = -1;

function texturaSuave() {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const g = c.getContext("2d");
  const rad = g.createRadialGradient(16, 16, 0, 16, 16, 15);
  rad.addColorStop(0, "rgba(255,255,255,1)");
  rad.addColorStop(0.4, "rgba(255,255,255,0.55)");
  rad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rad;
  g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function texturaNucleo() {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const g = c.getContext("2d");
  g.clearRect(0, 0, 32, 32);
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(16, 16, 8, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function texturaChao() {
  const lado = 512;
  const c = document.createElement("canvas");
  c.width = lado;
  c.height = lado;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(256, 256, 30, 256, 256, 255);
  grad.addColorStop(0, "#3e463c");
  grad.addColorStop(0.7, "#2c332d");
  grad.addColorStop(1, "#1a211c");
  g.fillStyle = grad;
  g.fillRect(0, 0, lado, lado);
  g.fillStyle = "rgba(90, 130, 170, 0.16)";
  g.fillRect(0, 0, 256, lado);
  g.fillStyle = "rgba(170, 84, 78, 0.14)";
  g.fillRect(256, 0, 256, lado);

  const img = g.getImageData(0, 0, lado, lado);
  const px = img.data;
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const i = (y * lado + x) * 4;
      const n = ((x * 13 + y * 7) % 9) - 4;
      px[i] = Math.max(0, Math.min(255, px[i] + n));
      px[i + 1] = Math.max(0, Math.min(255, px[i + 1] + n));
      px[i + 2] = Math.max(0, Math.min(255, px[i + 2] + n));
    }
  }
  g.putImageData(img, 0, 0);

  g.strokeStyle = "rgba(255,255,255,0.16)";
  g.lineWidth = 4;
  g.beginPath();
  g.arc(256, 256, 232, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = "rgba(255,255,255,0.08)";
  g.lineWidth = 2;
  g.beginPath();
  g.arc(256, 256, 86, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(256, 28);
  g.lineTo(256, 484);
  g.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function pixelDeCorpo(r, g, b, a) {
  if (a < 48) return false;
  if (r < 16 && g < 16 && b < 20) return false;
  const maior = Math.max(r, g, b);
  const menor = Math.min(r, g, b);
  if (maior - menor < 8 && maior < 150) return false;
  return true;
}

function recortarPreto(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    const linha = y * w;
    for (let x = 0; x < w; x++) {
      const i = (linha + x) * 4;
      if (!pixelDeCorpo(px[i], px[i + 1], px[i + 2], px[i + 3])) {
        px[i + 3] = 0;
        continue;
      }
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  ctx.putImageData(data, 0, 0);
  if (maxX < 0) return canvas;
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const corte = document.createElement("canvas");
  corte.width = cw;
  corte.height = ch;
  corte.getContext("2d").drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
  return corte;
}

function tileCheio(img) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h || w % 16 || h % 16 || (w === 16 && h === 16)) return null;
  const leitura = document.createElement("canvas");
  leitura.width = w;
  leitura.height = h;
  const ctx = leitura.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, w, h).data;
  let tx = 0;
  let ty = 0;
  let melhor = 0;
  for (let y0 = 0; y0 < h; y0 += 16) {
    for (let x0 = 0; x0 < w; x0 += 16) {
      let n = 0;
      for (let y = 0; y < 16; y++) {
        const linha = (y0 + y) * w;
        for (let x = 0; x < 16; x++) {
          if (px[((linha + x0 + x) * 4) + 3] > 250) n += 1;
        }
      }
      if (n > melhor) {
        melhor = n;
        tx = x0;
        ty = y0;
      }
    }
  }
  if (melhor < 256) return null;
  const corte = document.createElement("canvas");
  corte.width = 16;
  corte.height = 16;
  corte.getContext("2d").drawImage(leitura, tx, ty, 16, 16, 0, 0, 16, 16);
  return corte;
}

function texturaRepetida(url) {
  let tex = chaoTex.get(url);
  if (tex) return tex;
  tex = new THREE.Texture();
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  chaoTex.set(url, tex);
  const img = new Image();
  img.onload = () => {
    tex.image = tileCheio(img) || img;
    tex.needsUpdate = true;
    coberturaVista = -1;
  };
  img.src = url;
  return tex;
}

function texturaSprite(url) {
  let tex = spriteTex.get(url);
  if (tex) return tex;
  tex = new THREE.Texture();
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  spriteTex.set(url, tex);
  const img = new Image();
  img.onload = () => {
    const tela = recortarPreto(img);
    tex.image = tela;
    tex.userData.w = tela.width;
    tex.userData.h = tela.height;
    tex.needsUpdate = true;
    coberturaVista = -1;
  };
  img.src = url;
  return tex;
}

function geometriaMetade(thetaStart, repetir) {
  const geo = new THREE.CircleGeometry(14.7, 48, thetaStart, Math.PI);
  if (repetir) {
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) / 2.4, pos.getY(i) / 2.4);
    }
  }
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function aplicarMetade(slot, tipo) {
  const repetir = tipo !== "normal";
  const geo = geometriaMetade(slot.theta, repetir);
  slot.mesh.geometry.dispose();
  slot.mesh.geometry = geo;
  slot.mat.map = repetir ? texturaRepetida(CHAO[tipo]) : chaoNormal;
  slot.mat.needsUpdate = true;
}

function criarCobertura() {
  const sprite = criarAtorCartao(null, {
    nome: "arena-cobertura",
    transparent: true,
    depthWrite: false,
    alphaTest: 0.15,
    opacity: 1,
    renderOrder: 3,
  });
  sprite.visible = false;
  aplicarPivoCartao(sprite, 0.5, 1);
  cena.add(sprite);
  const sombra = criarSombra();
  return { sprite, mat: sprite.material, sombra, url: "", alpha: 1 };
}

function aplicarAlphaCobertura(chave, alpha) {
  const i = Number(chave);
  if (!Number.isFinite(i) || i < 0 || i >= coberturas.length) return;
  const slot = coberturas[i];
  if (!slot || Math.abs(slot.alpha - alpha) < 0.002) return;
  slot.alpha = alpha;
  slot.mat.opacity = alpha;
  slot.mat.alphaTest = alpha < 0.98 ? 0.02 : 0.15;
  if (slot.sombra?.material) {
    slot.sombra.material.opacity = 0.38 * Math.max(0.15, alpha);
  }
}

function atualizarFadeCobertura(atores, dt) {
  if (!camera) return;
  pecasFade.length = 0;
  const n = quantidadeCobertura();
  for (let i = 0; i < n; i++) {
    const peca = pecaCobertura(i);
    const slot = coberturas[i];
    if (!peca || !slot?.sprite.visible) continue;
    pecasFade.push({
      chave: String(i),
      x: peca.x,
      y: peca.y,
      r: peca.r || 0.6,
      elev: Math.max(0.7, (slot.sprite.scale.y || 1.4) * 0.55),
    });
  }
  const focos = [];
  for (let i = 0; i < (atores?.length || 0); i++) {
    const a = atores[i];
    if (!a || a.morto) continue;
    focos.push(a);
  }
  tickFadeArena(pecasFade, focos, camera, dt, aplicarAlphaCobertura);
}

function criarGrama() {
  const sprite = criarAtorCartao(null, {
    nome: "arena-grama",
    transparent: true,
    depthWrite: false,
    alphaTest: 0.15,
    renderOrder: 3,
  });
  sprite.visible = false;
  aplicarPivoCartao(sprite, 0.5, 1);
  cena.add(sprite);
  return { sprite, mat: sprite.material, url: "" };
}

function sincronizarCobertura() {
  const versao = versaoCobertura();
  if (versao !== coberturaVista) {
    coberturaVista = versao;
    aplicarMetade(metadesChao[0], tipoMetade("esquerda"));
    aplicarMetade(metadesChao[1], tipoMetade("direita"));
    spritesVista = -1;
  }
  const espera = coberturas.some((c) => c.visiblePendencia) || gramas.some((g) => g.visiblePendencia);
  if (versao === spritesVista && !espera) return;
  spritesVista = versao;
  const n = quantidadeCobertura();
  for (let i = 0; i < CAP_COBERTURA; i++) {
    const slot = coberturas[i];
    const peca = i < n ? pecaCobertura(i) : null;
    if (!peca) {
      slot.sprite.visible = false;
      slot.sombra.visible = false;
      slot.visiblePendencia = false;
      slot.url = "";
      if (slot.alpha !== 1) aplicarAlphaCobertura(String(i), 1);
      continue;
    }
    const tex = texturaSprite(peca.url);
    if (slot.url !== peca.url) {
      slot.mat.map = tex;
      slot.mat.needsUpdate = true;
      slot.url = peca.url;
    }
    const pronta = tex.userData.w > 0;
    slot.sprite.visible = pronta;
    slot.sombra.visible = pronta;
    slot.visiblePendencia = !pronta;
    if (!pronta) continue;
    const w = (tex.userData.w / TILE) || 1;
    const h = (tex.userData.h / TILE) || 1;
    slot.sprite.userData.largura = w;
    slot.sprite.userData.altura = h;
    slot.sprite.userData.px = peca.x;
    slot.sprite.userData.pz = peca.y;
    poseAtorCartao(slot.sprite, {
      x: peca.x,
      y: 0,
      z: peca.y,
      largura: w,
      altura: h,
      yaw: yawDaVista(),
      inclinacao: BILLBOARD_INCLINACAO,
      pivotX: 0.5,
      pivotY: 1,
    });
    slot.sombra.position.set(peca.x, 0.03, peca.y);
    const s = Math.max(0.55, peca.r / 0.62);
    slot.sombra.scale.set(s, 1, s);
  }
  const ng = quantidadeGrama();
  for (let i = 0; i < CAP_GRAMA; i++) {
    const slot = gramas[i];
    const tufo = i < ng ? pecaGrama(i) : null;
    if (!tufo) {
      slot.sprite.visible = false;
      slot.visiblePendencia = false;
      slot.url = "";
      continue;
    }
    const tex = texturaSprite(tufo.url);
    if (slot.url !== tufo.url) {
      slot.mat.map = tex;
      slot.mat.needsUpdate = true;
      slot.url = tufo.url;
    }
    const pronta = tex.userData.w > 0;
    slot.sprite.visible = pronta;
    slot.visiblePendencia = !pronta;
    if (!pronta) continue;
    const w = ((tex.userData.w / TILE) || 1) * VEG_MATA_ESCALA;
    const h = ((tex.userData.h / TILE) || 1) * VEG_MATA_ESCALA;
    slot.sprite.userData.largura = w;
    slot.sprite.userData.altura = h;
    slot.sprite.userData.px = tufo.x;
    slot.sprite.userData.pz = tufo.y;
    poseAtorCartao(slot.sprite, {
      x: tufo.x,
      y: 0,
      z: tufo.y,
      largura: w,
      altura: h,
      yaw: yawDaVista(),
      inclinacao: BILLBOARD_INCLINACAO,
      pivotX: 0.5,
      pivotY: 1,
    });
  }
}

function girarCartoesArena() {
  const yaw = yawDaVista();
  for (let i = 0; i < coberturas.length; i++) {
    const mesh = coberturas[i].sprite;
    if (!mesh.visible) continue;
    const u = mesh.userData;
    if (!(u.largura > 0)) continue;
    poseAtorCartao(mesh, {
      x: u.px,
      y: 0,
      z: u.pz,
      largura: u.largura,
      altura: u.altura,
      yaw,
      inclinacao: BILLBOARD_INCLINACAO,
      pivotX: 0.5,
      pivotY: 1,
    });
  }
  for (let i = 0; i < gramas.length; i++) {
    const mesh = gramas[i].sprite;
    if (!mesh.visible) continue;
    const u = mesh.userData;
    if (!(u.largura > 0)) continue;
    poseAtorCartao(mesh, {
      x: u.px,
      y: 0,
      z: u.pz,
      largura: u.largura,
      altura: u.altura,
      yaw,
      inclinacao: BILLBOARD_INCLINACAO,
      pivotX: 0.5,
      pivotY: 1,
    });
  }
}

function posicionarCamera() {
  const alturaCam = Math.sin(elev) * dist;
  const raio = Math.cos(elev) * dist;
  camera.position.set(
    alvo.x + Math.sin(az) * raio,
    alturaCam + (alvo.y - 1.15),
    alvo.z + Math.cos(az) * raio,
  );
  camera.lookAt(alvo);
}

function limitarAlvo() {
  alvo.x = Math.max(-16, Math.min(16, alvo.x));
  alvo.y = Math.max(0.2, Math.min(6, alvo.y));
  alvo.z = Math.max(-16, Math.min(16, alvo.z));
}

function enquadrar() {
  if (!camera || distUsuario || ombro) return;
  const aspecto = Math.max(0.35, (largura || 1) / Math.max(1, altura || 1));
  const vfov = (camera.fov * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspecto);
  const metade = 6.4;
  dist = Math.max(14, Math.min(36, (metade / Math.tan(hfov / 2)) * 1.12));
  posicionarCamera();
}

function criarSombra() {
  const geo = new THREE.CircleGeometry(0.62, 20);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x0b0f0c,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.03;
  mesh.renderOrder = 1;
  mesh.visible = false;
  cena.add(mesh);
  return mesh;
}

function criarAtorSlot() {
  const grupo = new THREE.Group();
  const tela = document.createElement("canvas");
  tela.width = LADO;
  tela.height = LADO;
  const ctx = tela.getContext("2d");
  const tex = new THREE.CanvasTexture(tela);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = criarAtorCartao(tex, {
    nome: "arena-ator",
    transparent: true,
    depthWrite: false,
    alphaTest: 0.12,
    renderOrder: 3,
  });
  const mat = sprite.material;
  const lado = LADO * PX_MUNDO;
  sprite.scale.set(lado, lado, 1);
  aplicarPivoCartao(sprite, PIVO_X, PIVO_Y);
  grupo.add(sprite);
  grupo.visible = false;
  cena.add(grupo);
  return { grupo, ctx, tex, mat, sprite, sombra: criarSombra(), chave: "" };
}

function criarPonto(mapa, ordem, aditivo) {
  const mat = new THREE.SpriteMaterial({
    map: mapa,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = ordem;
  sprite.visible = false;
  sprite.userData.mapa = mapa;
  cena.add(sprite);
  return sprite;
}

function ancorar(slot) {
  aplicarPivoCartao(slot.sprite, PIVO_X, PIVO_Y);
  slot.sprite.visible = true;
}

function aplicarMedida(slot, ator) {
  const { escala, offsetY } = medidaSprite(ator);
  const lado = LADO * PX_MUNDO * escala;
  poseAtorCartao(slot.sprite, {
    x: 0,
    y: -offsetY,
    z: 0,
    largura: lado,
    altura: lado,
    yaw: yawDaVista(),
    inclinacao: BILLBOARD_INCLINACAO,
    pivotX: PIVO_X,
    pivotY: PIVO_Y,
  });
}

function pintar(slot, ator, fr, pack) {
  const { dx, dy } = medidaSprite(ator);
  const chave = `${ator.id}:${pack.id}:${ator.visual?.anim}:${ator.visual?.dir}:${ator.visual?.frame}:${ator.morto ? 1 : 0}:${dx}:${dy}`;
  if (slot.chave === chave) return;
  slot.chave = chave;
  slot.ctx.imageSmoothingEnabled = false;
  slot.ctx.clearRect(0, 0, LADO, LADO);
  blitQuadro(slot.ctx, pack.img, pack.atlasW, pack.atlasH, fr, PE_X, PE_Y, 1, { dx, dy });
  slot.tex.needsUpdate = true;
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

function yawDaVista() {
  if (!camera) return az;
  camera.getWorldDirection(_dir);
  const dx = _dir.x;
  const dz = _dir.z;
  if (dx * dx + dz * dz < 1e-6) return az;
  return Math.atan2(-dx, -dz);
}

function pintarAtor(slot, ator) {
  if (!ator) {
    slot.grupo.visible = false;
    slot.sombra.visible = false;
    return;
  }
  slot.grupo.visible = true;
  slot.sombra.visible = true;
  const elev = (ator.elevacao ?? ator.z ?? 0) + (ator.hopLift || 0);
  slot.grupo.position.set(ator.x, elev * ALTURA_BLOCO, ator.y);
  const pack = garantirAtlas(ator.especie.dex, ator.shiny);
  const visual = ator.visual;
  const dirMundo = visual?.dir;
  if (visual) {
    const rel = direcao8Camera(ator.dirX || 0, ator.dirY || 0, yawDaVista());
    if (rel != null) visual.dir = rel;
  }
  const fr = quadroDe(ator, pack);
  if (fr && pack.img && pack.estado === "pronto") pintar(slot, ator, fr, pack);
  else fallback(slot, ator);
  aplicarMedida(slot, ator);
  if (visual && dirMundo != null) visual.dir = dirMundo;
  slot.mat.opacity = ator.morto ? 0.45 : 1;
  const hop = ator.hopLift || 0;
  const encolhe = Math.max(0.42, 1 - hop * 0.85);
  const centro = centroDoQuadro(fr, medidaSprite(ator));
  const vistaX = (centro.x / LADO) * slot.sprite.scale.x;
  const vistaY = (centro.y / LADO) * slot.sprite.scale.y;
  projetarCentroNoChao(camera, vistaX, vistaY, _desloc);
  slot.sombra.position.set(ator.x + _desloc.x, 0.03, ator.y + _desloc.z);
  slot.sombra.scale.set(encolhe, 1, encolhe);
  slot.sombra.material.opacity = (ator.morto ? 0.2 : 0.4) * Math.max(0.3, 1 - hop);
}

function pintarUmTiro(mesh, p) {
  mesh.visible = true;
  const pose = p.impacto ? poseImpacto(p, camera) : poseTiro(p, camera);
  if (!pose || !aplicarPose(mesh, pose)) {
    if (mesh.material.map !== mesh.userData.mapa) {
      mesh.material.map = mesh.userData.mapa;
      mesh.material.needsUpdate = true;
    }
    mesh.material.color.set(p.cor || "#ffffff");
    mesh.material.opacity = 1;
    mesh.material.rotation = p.ang || 0;
    const s = p.escala || Math.max(0.22, (p.raio || 0.45) * 0.42);
    mesh.scale.set(s, p.giro ? s * 0.42 : s, 1);
  }
  mesh.position.set(p.x, Math.max(0.08, p.z * ALTURA_BLOCO), p.y);
}

function pintarTiros() {
  const vivos = projeteisVivos();
  const impactos = impactosVivos();
  let i = 0;
  for (let k = 0; k < vivos.length && i < tiros.length; k++, i++) pintarUmTiro(tiros[i], vivos[k]);
  for (let k = 0; k < impactos.length && i < tiros.length; k++, i++) pintarUmTiro(tiros[i], impactos[k]);
  for (; i < tiros.length; i++) tiros[i].visible = false;
}

function criarTraco() {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xf4f1ea,
    transparent: true,
    depthWrite: false,
    opacity: 0,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.rotation.order = "XYZ";
  mesh.visible = false;
  mesh.renderOrder = 2;
  cena.add(mesh);
  return mesh;
}

function pintarTraco(mesh, p) {
  const t = Math.max(0, 1 - p.idade / p.vida);
  mesh.visible = true;
  mesh.material.color.set(p.cor || "#f4f1ea");
  mesh.material.opacity = t * 0.85;
  mesh.position.set(p.x, 0.08, p.y);
  mesh.rotation.set(-Math.PI / 2, p.ang || 0, 0);
  mesh.scale.set(Math.max(0.4, p.tam || 0.9), 0.11, 1);
}

function pintarFaiscas() {
  const lista = particulasVivas();
  let tracoI = 0;
  for (let i = 0; i < faiscas.length; i++) {
    const mesh = faiscas[i];
    const p = lista[i];
    if (!p?.viva || p.modo === "traco") {
      mesh.visible = false;
      if (p?.viva && p.modo === "traco" && tracoI < tracos.length) {
        pintarTraco(tracos[tracoI], p);
        tracoI += 1;
      }
      continue;
    }
    const t = 1 - p.idade / p.vida;
    const poeira = p.modo === "poeira";
    const mistura = poeira ? THREE.NormalBlending : THREE.AdditiveBlending;
    if (mesh.material.blending !== mistura) {
      mesh.material.blending = mistura;
      mesh.material.needsUpdate = true;
    }
    mesh.visible = true;
    mesh.material.color.set(p.cor || "#fff");
    mesh.material.opacity = Math.max(0, t) * (poeira ? 0.92 : 1);
    const s = p.tam * (0.55 + t);
    mesh.scale.set(s, s, 1);
    mesh.position.set(p.x, Math.max(0.06, p.z * ALTURA_BLOCO), p.y);
  }
  for (let i = tracoI; i < tracos.length; i++) tracos[i].visible = false;
}

function ajustarTamanho() {
  const w = canvas.clientWidth | 0;
  const h = canvas.clientHeight | 0;
  if (w < 2 || h < 2 || (w === largura && h === altura)) return;
  largura = w;
  altura = h;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  enquadrar();
}

function ligarPonteiro() {
  canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());
  canvas.addEventListener("pointerdown", (ev) => {
    if (ombro) return;
    if (ev.button !== 0 && ev.button !== 1 && ev.button !== 2) return;
    if (ev.button === 2) ev.preventDefault();
    camera.getWorldDirection(_dir);
    _direita.crossVectors(_dir, camera.up);
    if (_direita.lengthSq() < 1e-8) _direita.set(1, 0, 0);
    else _direita.normalize();
    _frente.set(_dir.x, 0, _dir.z);
    if (_frente.lengthSq() < 1e-6) _frente.set(0, 0, -1);
    else _frente.normalize();
    arraste = {
      x: ev.clientX,
      y: ev.clientY,
      az,
      elev,
      ax: alvo.x,
      ay: alvo.y,
      azw: alvo.z,
      dirX: _direita.x,
      dirZ: _direita.z,
      frX: _frente.x,
      frZ: _frente.z,
      modo: ev.button === 2 || ev.button === 1 || ev.shiftKey ? "pan" : "orbit",
    };
    canvas.setPointerCapture(ev.pointerId);
    canvas.classList.add("arrastando");
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (ombro || !arraste) return;
    const dx = ev.clientX - arraste.x;
    const dy = ev.clientY - arraste.y;
    if (arraste.modo === "orbit") {
      az = arraste.az - dx * 0.007;
      elev = Math.max(0.18, Math.min(1.05, arraste.elev + dy * 0.004));
      posicionarCamera();
      return;
    }
    const escala = dist * 0.0022;
    alvo.x = arraste.ax + (-arraste.dirX * dx + arraste.frX * dy) * escala;
    alvo.z = arraste.azw + (-arraste.dirZ * dx + arraste.frZ * dy) * escala;
    alvo.y = arraste.ay;
    limitarAlvo();
    posicionarCamera();
  });
  const soltar = () => {
    arraste = null;
    canvas.classList.remove("arrastando");
  };
  canvas.addEventListener("pointerup", soltar);
  canvas.addEventListener("pointercancel", soltar);
  canvas.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    if (ombro) return;
    distUsuario = true;
    const fator = ev.deltaY > 0 ? 1.07 : 0.93;
    dist = Math.max(10, Math.min(48, dist * fator));
    posicionarCamera();
  }, { passive: false });
}

export function ligarArena(elemento) {
  if (renderer) return;
  carregarFolhasGolpe();
  canvas = elemento;
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  cena = new THREE.Scene();
  cena.background = new THREE.Color(0x141a17);

  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  posicionarCamera();

  cena.add(new THREE.HemisphereLight(0xd5e4f5, 0x2c2822, 0.78));
  const sol = new THREE.DirectionalLight(0xfff1d6, 1.4);
  sol.position.set(-8, 18, 10);
  cena.add(sol);
  const fill = new THREE.DirectionalLight(0xc9d7ef, 0.38);
  fill.position.set(10, 8, -6);
  cena.add(fill);

  chaoNormal = texturaChao();
  const especMetade = [
    { lado: "esquerda", theta: Math.PI / 2, y: 0 },
    { lado: "direita", theta: -Math.PI / 2, y: 0.004 },
  ];
  for (let i = 0; i < especMetade.length; i++) {
    const espec = especMetade[i];
    const geo = geometriaMetade(espec.theta, false);
    const mat = new THREE.MeshStandardMaterial({
      map: chaoNormal,
      roughness: 0.92,
      metalness: 0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = espec.y;
    cena.add(mesh);
    metadesChao.push({ mesh, mat, theta: espec.theta });
  }

  const anel = new THREE.Mesh(
    new THREE.TorusGeometry(10.15, 0.16, 8, 72),
    new THREE.MeshStandardMaterial({ color: 0x4a564c, roughness: 0.8 }),
  );
  anel.rotation.x = Math.PI / 2;
  anel.position.y = 0.08;
  cena.add(anel);

  const suave = texturaSuave();
  const nucleo = texturaNucleo();
  for (let i = 0; i < 2; i++) slots.push(criarAtorSlot());
  for (let i = 0; i < CAP_TIRO; i++) tiros.push(criarPonto(nucleo, 4, false));
  for (let i = 0; i < CAP_FAISCA; i++) faiscas.push(criarPonto(suave, 5, true));
  for (let i = 0; i < CAP_TRACO; i++) tracos.push(criarTraco());
  for (let i = 0; i < CAP_KI; i++) {
    kiHalos.push(criarPonto(suave, 6, true));
    kiNucleos.push(criarPonto(nucleo, 7, true));
    for (let k = 0; k < ORBES_KI; k++) kiOrbes.push(criarPonto(suave, 6, true));
  }
  for (let i = 0; i < CAP_COBERTURA; i++) coberturas.push(criarCobertura());
  for (let i = 0; i < CAP_GRAMA; i++) gramas.push(criarGrama());

  ligarPonteiro();
  ajustarTamanho();
}

function pintarKi() {
  const lista = aurasVivas();
  for (let i = 0; i < CAP_KI; i++) {
    const aura = lista[i];
    const halo = kiHalos[i];
    const nucleo = kiNucleos[i];
    const viva = !!(aura && aura.viva);
    halo.visible = viva;
    nucleo.visible = viva;
    if (!viva) {
      for (let k = 0; k < ORBES_KI; k++) kiOrbes[i * ORBES_KI + k].visible = false;
      continue;
    }
    const y = Math.max(0.2, aura.z * ALTURA_BLOCO);
    const pulso = 1 + Math.sin(aura.ang * 3) * 0.07;
    const s = (0.32 + aura.u * 0.95) * pulso;
    halo.position.set(aura.x, y, aura.y);
    halo.material.color.set(aura.cor);
    halo.material.opacity = 0.4 + aura.u * 0.45;
    halo.scale.set(s, s, 1);
    nucleo.position.set(aura.x, y, aura.y);
    nucleo.material.color.set("#ffffff");
    nucleo.material.opacity = 0.9;
    nucleo.scale.set(s * 0.4, s * 0.4, 1);
    const raio = 0.82 - aura.u * 0.52;
    for (let k = 0; k < ORBES_KI; k++) {
      const mesh = kiOrbes[i * ORBES_KI + k];
      const a = aura.ang + (k / ORBES_KI) * Math.PI * 2;
      mesh.visible = true;
      mesh.material.color.set(aura.cor);
      mesh.material.opacity = 0.55 + aura.u * 0.4;
      const os = 0.14 + aura.u * 0.12;
      mesh.scale.set(os, os, 1);
      mesh.position.set(
        aura.x + Math.cos(a) * raio,
        y + Math.sin(aura.ang * 2 + k) * 0.08,
        aura.y + Math.sin(a) * raio,
      );
    }
  }
}

export function definirOmbro(pose, dt) {
  let vale = false;
  if (pose?.tipo === "teatro") vale = !!(pose.a && pose.b);
  else if (pose?.tipo === "impacto" || pose?.tipo === "volta" || pose?.tipo === "tiro") vale = !!pose.alvo;
  else vale = !!(pose?.de && pose?.para);
  ombro = vale ? pose : null;
  ombroDt = Number.isFinite(dt) && dt > 0 ? Math.min(0.05, dt) : 0.016;
}

function destinoOmbro() {
  if (ombro.tipo === "impacto") {
    const quem = ombro.alvo;
    const giro = Number.isFinite(ombro.giro) ? ombro.giro : CAM_TURNO.impactoErro.giro;
    teatroAng += ombroDt * giro;
    const raio = ombro.raio || CAM_TURNO.impactoErro.raio;
    const altura = ombro.altura || CAM_TURNO.impactoErro.altura;
    const avance = Math.min(1.2, (quem.recuoDist || 0) * 0.28);
    const ox = (quem.recuoDirX || 0) * avance;
    const oz = (quem.recuoDirY || 0) * avance;
    ombroFim.set(quem.x + ox + Math.sin(teatroAng) * raio, altura, quem.y + oz + Math.cos(teatroAng) * raio);
    ombroOlharFim.set(quem.x + ox * 0.45, 1.05, quem.y + oz * 0.45);
    return;
  }
  if (ombro.tipo === "volta") {
    const quem = ombro.alvo;
    const giro = Number.isFinite(ombro.giro) ? ombro.giro : CAM_TURNO.volta.giro;
    teatroAng += ombroDt * giro;
    const raio = ombro.raio || CAM_TURNO.volta.raio;
    const altura = ombro.altura || CAM_TURNO.volta.altura;
    ombroFim.set(quem.x + Math.sin(teatroAng) * raio, altura, quem.y + Math.cos(teatroAng) * raio);
    ombroOlharFim.set(quem.x, 1.05, quem.y);
    return;
  }
  if (ombro.tipo === "tiro") {
    const p = ombro.alvo;
    const destino = p.garantirAlvo;
    const dx = p.dirX || 0;
    const dz = p.dirY || 0;
    const atras = CAM_TURNO.tiro.atras;
    const altTiro = CAM_TURNO.tiro.altura;
    ombroFim.set(p.x - dx * atras, (p.z || 1) + altTiro, p.y - dz * atras);
    const lx = destino ? destino.x : p.x + dx * 4;
    const lz = destino ? destino.y : p.y + dz * 4;
    ombroOlharFim.set(lx, 1.1, lz);
    return;
  }
  if (ombro.tipo === "teatro") {
    const a = ombro.a;
    const b = ombro.b;
    const cx = (a.x + b.x) * 0.5;
    const cz = (a.y + b.y) * 0.5;
    const giro = Number.isFinite(ombro.giro) ? ombro.giro : CAM_TURNO.teatro.giro;
    teatroAng += ombroDt * giro;
    const raio = CAM_TURNO.teatro.raio;
    const altura = CAM_TURNO.teatro.altura;
    ombroFim.set(cx + Math.sin(teatroAng) * raio, altura, cz + Math.cos(teatroAng) * raio);
    ombroOlharFim.set(cx, 1.05, cz);
    return;
  }
  const de = ombro.de;
  const para = ombro.para;
  const dx = de.x - para.x;
  const dz = de.y - para.y;
  const d = Math.hypot(dx, dz) || 1;
  const ux = dx / d;
  const uz = dz / d;
  const cfg = ombro.perto ? CAM_TURNO.ombroPerto : CAM_TURNO.ombro;
  ombroFim.set(de.x + ux * cfg.dist - uz * cfg.lado, cfg.altura, de.y + uz * cfg.dist + ux * cfg.lado);
  ombroOlharFim.set(para.x, 1.1, para.y);
}

function aplicarOmbro() {
  if (!camera) return;
  if (!ombro) {
    if (!ombroSegurando) return;
    ombroSegurando = false;
    posicionarCamera();
    return;
  }
  destinoOmbro();
  if (!ombroSegurando) {
    ombroPos.copy(camera.position);
    ombroOlhar.copy(alvo);
    ombroSegurando = true;
  } else {
    const aperto = ombro.tipo === "tiro" ? 14 : 7;
    const k = 1 - Math.exp(-aperto * ombroDt);
    ombroPos.lerp(ombroFim, k);
    ombroOlhar.lerp(ombroOlharFim, k);
  }
  camera.position.copy(ombroPos);
  camera.lookAt(ombroOlhar);
}

export function desenharArena(atores, dt = 0.016) {
  if (!renderer) return;
  sincronizarCobertura();
  girarCartoesArena();
  ajustarTamanho();
  aplicarOmbro();
  atualizarFadeCobertura(atores, dt);
  for (let i = 0; i < slots.length; i++) pintarAtor(slots[i], atores?.[i] || null);
  pintarTiros();
  pintarFaiscas();
  pintarKi();
  renderer.render(cena, camera);
}

export function projetarArena(x, alturaMetros, y) {
  if (!camera || !canvas) return null;
  ponto.set(x, alturaMetros, y);
  ponto.project(camera);
  if (ponto.z < -1 || ponto.z > 1) return null;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  return {
    x: (ponto.x * 0.5 + 0.5) * w,
    y: (-ponto.y * 0.5 + 0.5) * h,
  };
}
