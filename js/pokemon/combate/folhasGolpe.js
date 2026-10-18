/** Folhas dos quatro golpes, iguais às do BattleParticles. 1 tile de lá = 1 unidade. */

import * as THREE from "three";

const TILE_BP = 96;

function tamanho(frame, escalaPx) {
  return (frame * escalaPx) / TILE_BP;
}

export const FOLHAS = {
  ember: {
    url: "assets/effects/golpes/ember.png",
    frames: 5,
    duracao: 0.08,
    animar: false,
    escalaVoo: tamanho(32, 6.6),
    escalaImpacto: tamanho(32, 2.2),
    aponta: "cima",
    offsetAngulo: Math.PI,
    vertical: false,
    impacto: "folha",
    frameImpacto: 0,
  },
  razorLeaf: {
    url: "assets/effects/golpes/razor-leaf.png",
    frames: 9,
    duracao: 0.06,
    animar: true,
    giro: 4.8,
    aponta: "direita",
    escalaVoo: tamanho(16, 4.5),
    vertical: false,
    impacto: "cravar",
    duracaoImpacto: 0.95,
  },
  bubble: {
    url: "assets/effects/golpes/bubble.png",
    frames: 5,
    duracao: 0.07,
    animar: false,
    escalaVoo: tamanho(32, 2.2),
    escalaImpacto: tamanho(32, 2.6),
    vertical: true,
    impacto: "folha",
    frameImpacto: 1,
  },
  flamethrower: {
    url: "assets/effects/golpes/flamethrower.png",
    frames: 4,
    duracao: 0.07,
    animar: true,
    escalaVoo: tamanho(32, 0.85),
    escalaImpacto: tamanho(32, 2.8),
    vertical: true,
    impacto: "folha",
    frameImpacto: 0,
  },
};

const telas = new Map();
const texturas = new Map();
let pedido = false;

export function folhaGolpe(chave) {
  return FOLHAS[chave] || null;
}

export function telaFolha(chave) {
  return telas.get(chave) || null;
}

function soltarPreto(img, chave) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const preto = r < 12 && g < 12 && b < 12;
    const azul = Math.abs(r - 144) < 8 && Math.abs(g - 192) < 8 && Math.abs(b - 240) < 8;
    if (preto || azul) px[i + 3] = 0;
  }
  ctx.putImageData(data, 0, 0);
  telas.set(chave, canvas);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  texturas.set(chave, tex);
}

export function carregarFolhasGolpe() {
  if (pedido || typeof Image === "undefined") return;
  pedido = true;
  const chaves = Object.keys(FOLHAS);
  for (let i = 0; i < chaves.length; i++) {
    const chave = chaves[i];
    const img = new Image();
    img.onload = () => soltarPreto(img, chave);
    img.src = FOLHAS[chave].url;
  }
}

const _direita = new THREE.Vector3();
const _cima = new THREE.Vector3();
const _movimento = new THREE.Vector3();

/** O desenho aponta para cima ou para a direita da folha. O ângulo segue a câmera. */
export function anguloDoMovimento(camera, vx, vy, aponta, giro, tela) {
  const extra = giro || 0;
  const dx = vx || 0;
  const dy = vy || 0;
  if (dx * dx + dy * dy < 1e-8) return extra;
  if (tela || !camera) {
    if (aponta === "cima") return Math.atan2(dx, -dy) + extra;
    return Math.atan2(dy, dx) + extra;
  }
  camera.updateMatrixWorld();
  _direita.setFromMatrixColumn(camera.matrixWorld, 0);
  _cima.setFromMatrixColumn(camera.matrixWorld, 1);
  _movimento.set(dx, 0, dy);
  const sx = _movimento.dot(_direita);
  const sy = _movimento.dot(_cima);
  if (aponta === "cima") return Math.atan2(-sx, sy) + extra;
  return Math.atan2(sy, sx) + extra;
}

export function poseTiro(p, camera, tela) {
  const cfg = FOLHAS[p?.folha];
  if (!cfg) return null;
  let frame = 0;
  if (cfg.animar && cfg.frames > 1) {
    frame = Math.floor((p.t || 0) / cfg.duracao) % cfg.frames;
  }
  const giro = (cfg.giro || 0) * (p.t || 0) * Math.PI * 2;
  return {
    chave: p.folha,
    frame,
    frames: cfg.frames,
    angulo: cfg.vertical ? 0 : anguloDoMovimento(camera, p.vx, p.vy, cfg.aponta, giro, tela) + (cfg.offsetAngulo || 0),
    escala: p.escala || cfg.escalaVoo,
    alpha: 1,
  };
}

export function poseImpacto(imp, camera, tela) {
  const cfg = FOLHAS[imp?.folha];
  if (!cfg) return null;
  const inicio = cfg.frameImpacto || 0;
  let frame = imp.frame || 0;
  let alpha = 1;
  let angulo = 0;
  if (cfg.impacto === "folha") {
    frame = Math.min(cfg.frames - 1, inicio + Math.floor((imp.t || 0) / cfg.duracao));
  } else {
    const dur = cfg.duracaoImpacto || 0.9;
    const u = Math.min(1, (imp.t || 0) / dur);
    alpha = u < 0.32 ? 1 : 1 - (u - 0.32) / 0.68;
    angulo = anguloDoMovimento(camera, imp.vx, imp.vy, cfg.aponta, imp.giro || 0, tela);
  }
  return {
    chave: imp.folha,
    frame,
    frames: cfg.frames,
    angulo,
    escala: imp.escala || cfg.escalaImpacto || cfg.escalaVoo,
    alpha,
  };
}

function corteDe(mesh, chave) {
  const base = texturas.get(chave);
  if (!base) return null;
  if (!mesh.userData.cortes) mesh.userData.cortes = {};
  let tex = mesh.userData.cortes[chave];
  if (!tex) {
    tex = base.clone();
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    mesh.userData.cortes[chave] = tex;
  }
  return tex;
}

export function aplicarPose(mesh, pose) {
  const tex = corteDe(mesh, pose.chave);
  if (!tex) return false;
  const n = pose.frames || 1;
  tex.repeat.set(1, 1 / n);
  tex.offset.set(0, 1 - ((pose.frame || 0) + 1) / n);
  if (mesh.material.map !== tex) {
    mesh.material.map = tex;
    mesh.material.needsUpdate = true;
  }
  mesh.material.color.set("#ffffff");
  mesh.material.alphaTest = 0.04;
  mesh.material.opacity = pose.alpha == null ? 1 : pose.alpha;
  mesh.material.rotation = pose.angulo || 0;
  const s = pose.escala || 0.4;
  mesh.scale.set(s, s, 1);
  return true;
}
