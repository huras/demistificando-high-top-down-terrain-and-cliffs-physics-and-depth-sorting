/**
 * Queda da copa, fagulhas e lascas. Pools curtos, sem simular o chão inteiro.
 */

import * as THREE from "three";
import { ALTURA_BLOCO, TILE, VEG_ALPHA_TEST, VEG_ARVORE_ESCALA } from "../config.js";
import { alturaEm } from "../mundo/altura.js";
import { pivoDaImagem } from "../render/pivoPe.js";
import { FASE, listarFase } from "./estadoProps.js";

const CAP_QUEDA = 8;
const CAP_PARTICULA = 96;
const QUEDA_MS = 720;

const caindo = [];
const particulas = [];
let atlas = null;
let cursor = 0;

function nascer(parcial) {
  const p = {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    vida: 0.4,
    max: 0.4,
    r: 1,
    g: 0.5,
    b: 0.1,
    ...parcial,
  };
  p.max = p.vida;
  if (particulas.length < CAP_PARTICULA) particulas.push(p);
  else {
    particulas[cursor] = p;
    cursor = (cursor + 1) % CAP_PARTICULA;
  }
}

export function emitirFagulha(x, y, alto, n, forte) {
  const qtd = n | 0;
  const base = alto ? 1.05 : 0.28;
  for (let i = 0; i < qtd; i++) {
    const ang = Math.random() * Math.PI * 2;
    const fuma = !forte && Math.random() < 0.4;
    const quente = !fuma && Math.random() < 0.7;
    nascer({
      x: x + (Math.random() - 0.5) * 0.25,
      y: y + (Math.random() - 0.5) * 0.25,
      z: base + Math.random() * (alto ? 1.3 : 0.35),
      vx: Math.cos(ang) * (0.15 + Math.random() * 0.35),
      vy: Math.sin(ang) * (0.15 + Math.random() * 0.35),
      vz: 0.4 + Math.random() * (forte ? 1.4 : 0.7),
      vida: forte ? 0.55 + Math.random() * 0.35 : 0.4 + Math.random() * 0.3,
      r: fuma ? 0.32 : quente ? 1 : 0.95,
      g: fuma ? 0.28 : quente ? 0.42 : 0.72,
      b: fuma ? 0.24 : quente ? 0.08 : 0.2,
    });
  }
}

export function emitirLascas(x, y, n) {
  const qtd = n | 0;
  for (let i = 0; i < qtd; i++) {
    const ang = Math.random() * Math.PI * 2;
    const v = 0.8 + Math.random() * 1.6;
    nascer({
      x,
      y,
      z: 0.35 + Math.random() * 0.2,
      vx: Math.cos(ang) * v,
      vy: Math.sin(ang) * v,
      vz: 1.4 + Math.random() * 1.6,
      vida: 0.32 + Math.random() * 0.22,
      r: 0.62,
      g: 0.56,
      b: 0.48,
    });
  }
}

function avancarParticulas(dt) {
  const passo = dt > 0 ? Math.min(0.05, dt) : 0;
  for (let i = particulas.length - 1; i >= 0; i--) {
    const p = particulas[i];
    p.vida -= passo;
    if (p.vida <= 0) {
      const ultimo = particulas.pop();
      if (i < particulas.length) particulas[i] = ultimo;
      continue;
    }
    p.vz -= passo * 5;
    p.x += p.vx * passo;
    p.y += p.vy * passo;
    p.z += p.vz * passo;
    if (p.z < 0.04) {
      p.z = 0.04;
      p.vz *= -0.15;
      p.vx *= 0.5;
      p.vy *= 0.5;
    }
  }
  if (particulas.length < CAP_PARTICULA) cursor = 0;
}

export function criarFxCampo() {
  const grupo = new THREE.Group();
  grupo.name = "fx-campo";
  const malhas = [];
  const materiais = [];
  const geosPivo = new Map();

  for (let i = 0; i < CAP_QUEDA; i++) {
    const mat = new THREE.MeshBasicMaterial({
      transparent: false,
      alphaTest: VEG_ALPHA_TEST,
      depthWrite: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.rotation.order = "YXZ";
    grupo.add(mesh);
    malhas.push(mesh);
    materiais.push(mat);
  }

  const geoPonto = new THREE.BufferGeometry();
  const pos = new Float32Array(CAP_PARTICULA * 3);
  const cor = new Float32Array(CAP_PARTICULA * 3);
  geoPonto.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geoPonto.setAttribute("color", new THREE.BufferAttribute(cor, 3));
  const pontos = new THREE.Points(
    geoPonto,
    new THREE.PointsMaterial({
      size: 6,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  pontos.frustumCulled = false;
  grupo.add(pontos);

  function texturaDe(img) {
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }

  function geoComPivo(pivo) {
    const k = `${pivo.x.toFixed(3)}:${pivo.y.toFixed(3)}`;
    let geo = geosPivo.get(k);
    if (geo) return geo;
    geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0.5 - pivo.x, pivo.y - 0.5, 0);
    geosPivo.set(k, geo);
    return geo;
  }

  function desenharQueda(yaw, inclinacao) {
    listarFase(FASE.CAINDO, caindo);
    const n = Math.min(caindo.length, CAP_QUEDA);
    for (let i = 0; i < CAP_QUEDA; i++) {
      const mesh = malhas[i];
      if (i >= n) {
        mesh.visible = false;
        continue;
      }
      const prop = caindo[i];
      const img = (prop.sprite && atlas?.sprites?.[prop.sprite]) || atlas?.arvore || null;
      if (!img) {
        mesh.visible = false;
        continue;
      }
      const mat = materiais[i];
      if (mat.userData.img !== img) {
        mat.map?.dispose();
        mat.map = texturaDe(img);
        mat.userData.img = img;
        mat.needsUpdate = true;
      }
      const pw = img.naturalWidth || img.width || TILE;
      const ph = img.naturalHeight || img.height || TILE;
      const pivo = pivoDaImagem(img);
      const t = Math.min(1, Math.max(0, (Date.now() - (prop.inicioMs || 0)) / QUEDA_MS));
      const curva = t * t * t;
      const u = t <= 0.42 ? 0 : (t - 0.42) / 0.58;
      const fade = 1 - u * u * (3 - 2 * u);
      const base = alturaEm(Math.floor(prop.x), Math.floor(prop.y));
      mesh.geometry = geoComPivo(pivo);
      mesh.visible = true;
      const folga = 0.05;
      mesh.position.set(prop.x + Math.sin(yaw) * folga, base * ALTURA_BLOCO, prop.y + Math.cos(yaw) * folga);
      mesh.rotation.set(inclinacao, yaw, curva * 1.15 * (prop.lado || 1));
      mesh.scale.set((pw / TILE) * VEG_ARVORE_ESCALA, (ph / TILE) * VEG_ARVORE_ESCALA, 1);
      const opaco = fade > 0.995;
      if (mat.userData.opaco !== opaco) {
        mat.transparent = !opaco;
        mat.depthWrite = opaco;
        mat.alphaTest = opaco ? VEG_ALPHA_TEST : 0;
        mat.userData.opaco = opaco;
        mat.needsUpdate = true;
      }
      mat.opacity = fade;
    }
  }

  function desenharPontos() {
    const attrP = geoPonto.getAttribute("position");
    const attrC = geoPonto.getAttribute("color");
    const n = Math.min(particulas.length, CAP_PARTICULA);
    for (let i = 0; i < n; i++) {
      const p = particulas[i];
      const chao = alturaEm(Math.floor(p.x), Math.floor(p.y)) * ALTURA_BLOCO;
      const a = p.max > 0 ? p.vida / p.max : 1;
      attrP.setXYZ(i, p.x, chao + p.z, p.y);
      attrC.setXYZ(i, p.r * a, p.g * a, p.b * a);
    }
    attrP.needsUpdate = true;
    attrC.needsUpdate = true;
    geoPonto.setDrawRange(0, n);
    pontos.visible = n > 0;
  }

  return {
    grupo,
    aplicarAtlas(proximo) {
      atlas = proximo || null;
    },
    atualizar(yaw, inclinacao, dt) {
      avancarParticulas(dt);
      desenharQueda(yaw || 0, inclinacao || 0);
      desenharPontos();
    },
    liberar() {
      const vistos = new Set();
      for (let i = 0; i < materiais.length; i++) {
        materiais[i].map?.dispose();
        materiais[i].dispose();
        const geo = malhas[i].geometry;
        if (geo && !vistos.has(geo)) {
          vistos.add(geo);
          geo.dispose();
        }
      }
      for (const geo of geosPivo.values()) {
        if (vistos.has(geo)) continue;
        geo.dispose();
      }
      geosPivo.clear();
      geoPonto.dispose();
      pontos.material.dispose();
    },
  };
}
