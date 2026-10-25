/**
 * Queda da copa, fagulhas e lascas. Pools curtos, sem simular o chão inteiro.
 * Fagulha/fagulha forte → atlas flamethrower; lascas → Points.
 */

import * as THREE from "three";
import { ALTURA_BLOCO, TILE, VEG_ALPHA_TEST, VEG_ARVORE_ESCALA } from "../config.js";
import { alturaEm } from "../mundo/altura.js";
import { presetCampo } from "../particulas/catalogo.js";
import { carregarFolhasGolpe, FOLHAS, texturaFolha } from "../pokemon/combate/folhasGolpe.js";
import { geometriaNoPe, poseCartao, pivoDoProp } from "../render/3d/billboard/indice.js";
import { FASE, listarFase } from "./estadoProps.js";

const CAP_QUEDA = 8;
const CAP_PARTICULA = 96;
const QUEDA_MS = 720;
const FRAMES_CHAMA = FOLHAS.flamethrower?.frames || 4;
const TAM_CHAMA = 0.42;

const caindo = [];
const particulas = [];
let atlas = null;
let cursor = 0;

/** @type {THREE.Texture | null} */
let texChamaLocal = null;
let pedidoChama = false;

const VERT_CHAMA = /* glsl */ `
attribute float aFrame;
attribute vec3 aColor;
varying vec2 vUv;
varying vec3 vColor;
varying float vFrame;

void main() {
  vUv = uv;
  vColor = aColor;
  vFrame = aFrame;
  #ifdef USE_INSTANCING
  vec3 mundo = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float sx = length(vec3(instanceMatrix[0][0], instanceMatrix[1][0], instanceMatrix[2][0]));
  float sy = length(vec3(instanceMatrix[0][1], instanceMatrix[1][1], instanceMatrix[2][1]));
  #else
  vec3 mundo = vec3(0.0);
  float sx = 1.0;
  float sy = 1.0;
  #endif
  vec3 direita = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 cima = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 pos = mundo + direita * (position.x * sx) + cima * (position.y * sy);
  vec4 mv = viewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG_CHAMA = /* glsl */ `
uniform sampler2D map;
uniform float uFrames;
varying vec2 vUv;
varying vec3 vColor;
varying float vFrame;

void main() {
  float frames = max(1.0, uFrames);
  float f = clamp(floor(vFrame + 1e-4), 0.0, frames - 1.0);
  vec2 uv = vec2(vUv.x, 1.0 - (f + (1.0 - vUv.y)) / frames);
  vec4 tex = texture2D(map, uv);
  if (tex.a < 0.05) discard;
  gl_FragColor = vec4(tex.rgb * vColor, tex.a);
}
`;

function texturaSuave() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function soltarPretoCanvas(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i] < 12 && px[i + 1] < 12 && px[i + 2] < 12) px[i + 3] = 0;
  }
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function garantirTexturaChama() {
  const compartilhada = texturaFolha("flamethrower");
  if (compartilhada) return compartilhada;
  if (texChamaLocal) return texChamaLocal;
  if (pedidoChama || typeof Image === "undefined") return null;
  pedidoChama = true;
  const img = new Image();
  img.onload = () => {
    texChamaLocal = soltarPretoCanvas(img);
  };
  img.src = FOLHAS.flamethrower?.url || "assets/effects/golpes/flamethrower.png";
  return null;
}

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
    folha: "",
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
  const cfg = presetCampo("fagulha");
  const forteCfg = presetCampo("fagulhaForte");
  const base = alto ? cfg.baseAlta : cfg.baseBaixa;
  const vzExtra = forte ? forteCfg.vzExtra : cfg.vzExtra;
  const vidaMin = forte ? forteCfg.vidaMin : cfg.vidaMin;
  const vidaExtra = forte ? forteCfg.vidaExtra : cfg.vidaExtra;
  for (let i = 0; i < qtd; i++) {
    const ang = Math.random() * Math.PI * 2;
    const fuma = !forte && Math.random() < cfg.chanceFuma;
    const quente = !fuma && Math.random() < cfg.chanceQuente;
    nascer({
      x: x + (Math.random() - 0.5) * cfg.espalha,
      y: y + (Math.random() - 0.5) * cfg.espalha,
      z: base + Math.random() * (alto ? cfg.alturaExtraAlta : cfg.alturaExtraBaixa),
      vx: Math.cos(ang) * (cfg.velMin + Math.random() * cfg.velExtra),
      vy: Math.sin(ang) * (cfg.velMin + Math.random() * cfg.velExtra),
      vz: cfg.vzMin + Math.random() * vzExtra,
      vida: vidaMin + Math.random() * vidaExtra,
      r: fuma ? cfg.corFumaR : quente ? cfg.corQuenteR : cfg.corMornaR,
      g: fuma ? cfg.corFumaG : quente ? cfg.corQuenteG : cfg.corMornaG,
      b: fuma ? cfg.corFumaB : quente ? cfg.corQuenteB : cfg.corMornaB,
      folha: "chama",
    });
  }
}

export function emitirLascas(x, y, n) {
  const qtd = n | 0;
  const cfg = presetCampo("lasca");
  for (let i = 0; i < qtd; i++) {
    const ang = Math.random() * Math.PI * 2;
    const v = cfg.velMin + Math.random() * cfg.velExtra;
    nascer({
      x,
      y,
      z: cfg.zMin + Math.random() * cfg.zExtra,
      vx: Math.cos(ang) * v,
      vy: Math.sin(ang) * v,
      vz: cfg.vzMin + Math.random() * cfg.vzExtra,
      vida: cfg.vidaMin + Math.random() * cfg.vidaExtra,
      r: cfg.corR,
      g: cfg.corG,
      b: cfg.corB,
      folha: "",
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
    p.vz -= passo * (presetCampo("lasca").grav || 5);
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
  carregarFolhasGolpe();
  garantirTexturaChama();

  const grupo = new THREE.Group();
  grupo.name = "fx-campo";
  const malhas = [];
  const materiais = [];
  const geosPivo = new Map();
  const dummy = new THREE.Object3D();

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

  // Lascas → Points
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

  // Fagulhas → InstancedMesh flamethrower
  const geoChama = new THREE.PlaneGeometry(1, 1);
  const colChama = new Float32Array(CAP_PARTICULA * 3);
  const frameChama = new Float32Array(CAP_PARTICULA);
  geoChama.setAttribute("aColor", new THREE.InstancedBufferAttribute(colChama, 3));
  geoChama.setAttribute("aFrame", new THREE.InstancedBufferAttribute(frameChama, 1));
  const matChama = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: garantirTexturaChama() || texturaSuave() },
      uFrames: { value: 1 },
    },
    vertexShader: VERT_CHAMA,
    fragmentShader: FRAG_CHAMA,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const chamas = new THREE.InstancedMesh(geoChama, matChama, CAP_PARTICULA);
  chamas.count = 0;
  chamas.frustumCulled = false;
  chamas.renderOrder = 7;
  chamas.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  grupo.add(chamas);

  function atualizarMapaChama() {
    const tex = texturaFolha("flamethrower") || texChamaLocal || garantirTexturaChama();
    if (!tex) return;
    if (matChama.uniforms.map.value !== tex) {
      matChama.uniforms.map.value = tex;
      matChama.uniforms.uFrames.value = FRAMES_CHAMA;
      matChama.needsUpdate = true;
    } else if (matChama.uniforms.uFrames.value !== FRAMES_CHAMA) {
      matChama.uniforms.uFrames.value = FRAMES_CHAMA;
    }
  }

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
    geo = geometriaNoPe(pivo.x, pivo.y);
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
      const pivo = pivoDoProp(img, prop.sprite);
      const t = Math.min(1, Math.max(0, (Date.now() - (prop.inicioMs || 0)) / QUEDA_MS));
      const curva = t * t * t;
      const u = t <= 0.42 ? 0 : (t - 0.42) / 0.58;
      const fade = 1 - u * u * (3 - 2 * u);
      const base = alturaEm(Math.floor(prop.x), Math.floor(prop.y));
      mesh.geometry = geoComPivo(pivo);
      mesh.visible = true;
      const folga = 0.05;
      poseCartao(mesh, {
        x: prop.x + Math.sin(yaw) * folga,
        y: base * ALTURA_BLOCO,
        z: prop.y + Math.cos(yaw) * folga,
        largura: (pw / TILE) * VEG_ARVORE_ESCALA,
        altura: (ph / TILE) * VEG_ARVORE_ESCALA,
        yaw,
        inclinacao,
        roll: curva * 1.15 * (prop.lado || 1),
        pivotY: pivo.y,
        opacoY: pivo.opacoY,
        dz: pivo.dz || 0,
        elevado: true,
      });
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

  function desenharParticulas() {
    atualizarMapaChama();
    const attrP = geoPonto.getAttribute("position");
    const attrC = geoPonto.getAttribute("color");
    const frames = matChama.uniforms.uFrames.value || 1;
    let nP = 0;
    let nC = 0;
    const n = Math.min(particulas.length, CAP_PARTICULA);
    for (let i = 0; i < n; i++) {
      const p = particulas[i];
      const chao = alturaEm(Math.floor(p.x), Math.floor(p.y)) * ALTURA_BLOCO;
      const a = p.max > 0 ? p.vida / p.max : 1;
      const y = chao + p.z;

      if (p.folha === "chama") {
        const u = 1 - a;
        const lado = Math.max(0.28, TAM_CHAMA * (0.75 + a * 0.55));
        dummy.position.set(p.x, y, p.y);
        dummy.quaternion.identity();
        dummy.scale.set(lado, lado, 1);
        dummy.updateMatrix();
        chamas.setMatrixAt(nC, dummy.matrix);
        const o = nC * 3;
        colChama[o] = p.r * a;
        colChama[o + 1] = p.g * a;
        colChama[o + 2] = p.b * a;
        frameChama[nC] = Math.min(frames - 1, Math.floor(u * frames));
        nC += 1;
        continue;
      }

      attrP.setXYZ(nP, p.x, y, p.y);
      attrC.setXYZ(nP, p.r * a, p.g * a, p.b * a);
      nP += 1;
    }
    attrP.needsUpdate = true;
    attrC.needsUpdate = true;
    geoPonto.setDrawRange(0, nP);
    pontos.visible = nP > 0;

    chamas.count = nC;
    chamas.instanceMatrix.needsUpdate = true;
    /** @type {THREE.InstancedBufferAttribute} */ (geoChama.getAttribute("aColor")).needsUpdate = true;
    /** @type {THREE.InstancedBufferAttribute} */ (geoChama.getAttribute("aFrame")).needsUpdate = true;
  }

  return {
    grupo,
    aplicarAtlas(proximo) {
      atlas = proximo || null;
    },
    atualizar(yaw, inclinacao, dt) {
      avancarParticulas(dt);
      desenharQueda(yaw || 0, inclinacao || 0);
      desenharParticulas();
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
      geoChama.dispose();
      matChama.dispose();
    },
  };
}
