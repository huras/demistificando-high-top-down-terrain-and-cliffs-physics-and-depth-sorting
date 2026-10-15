import * as THREE from "three";
import { ALTURA_BLOCO, TILE } from "../config.js";
import { particulasVivas } from "../pokemon/combate/particulas.js";
import { projeteisVivos } from "../pokemon/combate/projeteis.js";
import { blitQuadro, direcao8Camera, garantirAtlas, medidaSprite, quadroDe } from "../pokemon/sprites.js";

const PX_MUNDO = 1 / TILE;
const LADO = 256;
const PE_X = LADO * 0.5;
const PE_Y = LADO - 64;
const CAP_TIRO = 32;
const CAP_FAISCA = 160;

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
const slots = [];
const tiros = [];
const faiscas = [];

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
  if (!camera || distUsuario) return;
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
  cena.add(sprite);
  return sprite;
}

function ancorar(slot) {
  slot.sprite.center.set(PE_X / LADO, (LADO - PE_Y) / LADO);
  slot.sprite.visible = true;
}

function aplicarMedida(slot, ator) {
  const { escala, offsetY } = medidaSprite(ator);
  slot.sprite.position.y = -offsetY;
  slot.sprite.scale.set(LADO * PX_MUNDO * escala, LADO * PX_MUNDO * escala, 1);
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
    const rel = direcao8Camera(ator.dirX || 0, ator.dirY || 0, az);
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
  slot.sombra.position.set(ator.x, 0.03, ator.y);
  slot.sombra.scale.set(encolhe, 1, encolhe * 0.62);
  slot.sombra.material.opacity = (ator.morto ? 0.2 : 0.4) * Math.max(0.3, 1 - hop);
}

function pintarTiros() {
  const vivos = projeteisVivos();
  for (let i = 0; i < tiros.length; i++) {
    const mesh = tiros[i];
    const p = vivos[i];
    if (!p) {
      mesh.visible = false;
      continue;
    }
    mesh.visible = true;
    mesh.material.color.set(p.cor || "#ffffff");
    mesh.material.opacity = 1;
    const s = Math.max(0.22, (p.raio || 0.45) * 0.42);
    mesh.scale.set(s, s, 1);
    mesh.position.set(p.x, Math.max(0.08, p.z * ALTURA_BLOCO), p.y);
  }
}

function pintarFaiscas() {
  const lista = particulasVivas();
  for (let i = 0; i < faiscas.length; i++) {
    const mesh = faiscas[i];
    const p = lista[i];
    if (!p?.viva) {
      mesh.visible = false;
      continue;
    }
    const t = 1 - p.idade / p.vida;
    mesh.visible = true;
    mesh.material.color.set(p.cor || "#fff");
    mesh.material.opacity = Math.max(0, t);
    const s = p.tam * (0.55 + t);
    mesh.scale.set(s, s, 1);
    mesh.position.set(p.x, Math.max(0.06, p.z * ALTURA_BLOCO), p.y);
  }
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
    if (!arraste) return;
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
    distUsuario = true;
    const fator = ev.deltaY > 0 ? 1.07 : 0.93;
    dist = Math.max(10, Math.min(48, dist * fator));
    posicionarCamera();
  }, { passive: false });
}

export function ligarArena(elemento) {
  if (renderer) return;
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

  const chao = new THREE.Mesh(
    new THREE.CircleGeometry(10.4, 72),
    new THREE.MeshStandardMaterial({
      map: texturaChao(),
      roughness: 0.92,
      metalness: 0,
    }),
  );
  chao.rotation.x = -Math.PI / 2;
  cena.add(chao);

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

  ligarPonteiro();
  ajustarTamanho();
}

export function desenharArena(atores) {
  if (!renderer) return;
  ajustarTamanho();
  for (let i = 0; i < slots.length; i++) pintarAtor(slots[i], atores?.[i] || null);
  pintarTiros();
  pintarFaiscas();
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
