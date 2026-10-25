/** Folhas de golpe via catálogo de efeitos. 1 tile BP = 96px = 1 unidade. */

import * as THREE from "three";
import {
  carregarCatalogoEfeitos,
  catalogoEfeitos,
  efeitoDe,
  folhaDoEfeito,
  idEfeito,
} from "../../efeitos/catalogo.js";

/** @type {Record<string, object>} */
export const FOLHAS = {};

const telas = new Map();
const texturas = new Map();
/** @type {Set<string>} */
const urlsPedidas = new Set();

export function sincronizarFolhasDoCatalogo() {
  const cat = catalogoEfeitos();
  for (const k of Object.keys(FOLHAS)) delete FOLHAS[k];
  for (const id of Object.keys(cat.efeitos)) {
    const cfg = folhaDoEfeito(id);
    if (!cfg) continue;
    FOLHAS[id] = cfg;
  }
  for (const [alias, id] of Object.entries(cat.aliases)) {
    if (FOLHAS[id] && !FOLHAS[alias]) FOLHAS[alias] = FOLHAS[id];
  }
}

export function folhaGolpe(chave) {
  if (!chave) return null;
  if (FOLHAS[chave]) return FOLHAS[chave];
  const cfg = folhaDoEfeito(chave);
  if (cfg) {
    FOLHAS[chave] = cfg;
    const id = idEfeito(chave);
    if (id && !FOLHAS[id]) FOLHAS[id] = cfg;
  }
  return cfg;
}

export function telaFolha(chave) {
  const id = idEfeito(chave) || chave;
  return telas.get(id) || telas.get(chave) || null;
}

export function texturaFolha(chave) {
  const id = idEfeito(chave) || chave;
  return texturas.get(id) || texturas.get(chave) || null;
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

function pedirUrl(chave, url) {
  if (!url || urlsPedidas.has(chave) || typeof Image === "undefined") return;
  urlsPedidas.add(chave);
  const img = new Image();
  img.onload = () => soltarPreto(img, chave);
  img.src = url;
}

export function carregarFolhasGolpe() {
  carregarCatalogoEfeitos().then(() => {
    sincronizarFolhasDoCatalogo();
    const cat = catalogoEfeitos();
    const vistas = new Map();
    for (const id of Object.keys(cat.efeitos)) {
      const ef = cat.efeitos[id];
      if (!ef?.folha?.url) continue;
      if (!vistas.has(ef.folha.url)) vistas.set(ef.folha.url, id);
      pedirUrl(id, ef.folha.url);
    }
    // aliases compartilham textura do canônico
    for (const [alias, id] of Object.entries(cat.aliases)) {
      if (texturas.has(id) && !texturas.has(alias)) {
        // será preenchido no onload do canônico — espelhar depois
      }
      const cfg = FOLHAS[id];
      if (cfg) pedirUrl(id, cfg.url);
    }
  });
  sincronizarFolhasDoCatalogo();
  for (const chave of Object.keys(FOLHAS)) {
    pedirUrl(idEfeito(chave) || chave, FOLHAS[chave].url);
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

function chaveTextura(folha) {
  return idEfeito(folha) || folha;
}

export function poseTiro(p, camera, tela) {
  const cfg = folhaGolpe(p?.folha);
  if (!cfg) return null;
  let frame = 0;
  if (cfg.animar && cfg.frames > 1) {
    frame = Math.floor((p.t || 0) / cfg.duracao) % cfg.frames;
  }
  const giro = (cfg.giro || 0) * (p.t || 0) * Math.PI * 2;
  let angulo = 0;
  if (!cfg.vertical) {
    angulo = anguloDoMovimento(camera, p.vx, p.vy, cfg.aponta, giro, tela) + (cfg.offsetAngulo || 0);
  }
  if (cfg.flipIntervalo > 0) {
    const flip = Math.floor((p.t || 0) / cfg.flipIntervalo) % 2 === 1;
    if (flip) angulo += Math.PI;
  }
  return {
    chave: chaveTextura(p.folha),
    frame,
    frames: cfg.frames,
    angulo,
    escala: p.escala || cfg.escalaVoo,
    alpha: 1,
  };
}

export function poseImpacto(imp, camera, tela) {
  const cfg = folhaGolpe(imp?.folha);
  if (!cfg) return null;
  const inicio = cfg.frameImpacto || 0;
  let frame = imp.frame || 0;
  let alpha = 1;
  let angulo = 0;
  if (cfg.impacto === "folha") {
    frame = Math.min(cfg.frames - 1, inicio + Math.floor((imp.t || 0) / cfg.duracao));
  } else if (cfg.impacto === "flipFade") {
    const dur = cfg.duracaoImpacto || 0.32;
    const u = Math.min(1, (imp.t || 0) / dur);
    alpha = 1 - u;
    if (Math.floor((imp.t || 0) / (cfg.flipIntervalo || 0.14)) % 2 === 1) angulo = Math.PI;
  } else {
    const dur = cfg.duracaoImpacto || 0.9;
    const u = Math.min(1, (imp.t || 0) / dur);
    alpha = u < 0.32 ? 1 : 1 - (u - 0.32) / 0.68;
    angulo = anguloDoMovimento(camera, imp.vx, imp.vy, cfg.aponta, imp.giro || 0, tela);
  }
  return {
    chave: chaveTextura(imp.folha),
    frame,
    frames: cfg.frames,
    angulo,
    escala: imp.escala || cfg.escalaImpacto || cfg.escalaVoo,
    alpha,
  };
}

function corteDe(mesh, chave) {
  const base = texturaFolha(chave);
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

/** Há folha de spritesheet para esta chave? */
export function temFolhaSprite(chave) {
  return !!folhaGolpe(chave);
}

/** Efeito com visual procedural (orbe/estrela) — não é bola genérica. */
export function visualProcedural(chave) {
  const ef = efeitoDe(chave);
  return ef?.visual || ef?.orbe || null;
}

// Seed sync: FOLHAS disponível antes do fetch.
sincronizarFolhasDoCatalogo();
