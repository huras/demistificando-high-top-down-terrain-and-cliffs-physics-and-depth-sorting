import * as THREE from "three";
import { ALTURA_BLOCO } from "../../config.js";
import { aneisBola, faiscasBola, flashesBola } from "../../fx/fxBola.js";

const LEVANTAR = 0.85;

function texturaMiolo() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  const rad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rad.addColorStop(0, "rgba(255,255,255,1)");
  rad.addColorStop(0.45, "rgba(255,255,255,0.45)");
  rad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

function texturaAnel() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  g.strokeStyle = "#fff";
  g.lineWidth = 4;
  g.beginPath();
  g.arc(32, 32, 26, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 2;
  g.globalAlpha = 0.45;
  g.beginPath();
  g.arc(32, 32, 22, 0, Math.PI * 2);
  g.stroke();
  return c;
}

function texturaEstrela() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4 - Math.PI / 2;
    const rad = i % 2 === 0 ? 28 : 10;
    const x = 32 + Math.cos(ang) * rad;
    const y = 32 + Math.sin(ang) * rad;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  return c;
}

function texturaTraco() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 16;
  const g = c.getContext("2d");
  const rad = g.createLinearGradient(0, 0, 64, 0);
  rad.addColorStop(0, "rgba(255,255,255,0)");
  rad.addColorStop(0.35, "rgba(255,255,255,0.85)");
  rad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rad;
  g.fillRect(0, 4, 64, 8);
  return c;
}

function tex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

function sprite(mapa, ordem) {
  const mat = new THREE.SpriteMaterial({
    map: mapa,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  });
  const s = new THREE.Sprite(mat);
  s.visible = false;
  s.renderOrder = ordem;
  s.frustumCulled = false;
  s.center.set(0.5, 0.5);
  return s;
}

const _vel = new THREE.Vector3();
const _direita = new THREE.Vector3();
const _cima = new THREE.Vector3();

/**
 * Ângulo do SpriteMaterial: textura alongada em X local deve seguir a velocidade
 * projetada no plano da câmera (não atan2 do mundo).
 * @param {THREE.Camera | null | undefined} camera
 * @param {number} vx
 * @param {number} vy
 */
function rotacaoTraco(camera, vx, vy) {
  // Mundo do jogo: (x,y) horizontal → Three (x, z).
  _vel.set(vx, 0, vy);
  if (_vel.lengthSq() < 1e-8) return 0;
  if (!camera) return Math.atan2(vy, vx);
  camera.updateMatrixWorld();
  _direita.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  _cima.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  const aoLado = _vel.dot(_direita);
  const aoAlto = _vel.dot(_cima);
  return Math.atan2(aoAlto, aoLado);
}

export function criarFxBola3d() {
  const grupo = new THREE.Group();
  grupo.name = "fx-bola";
  const mapaMiolo = tex(texturaMiolo());
  const mapaAnel = tex(texturaAnel());
  const mapaEstrela = tex(texturaEstrela());
  const mapaTraco = tex(texturaTraco());

  const aneis = aneisBola();
  const malhaAnel = [];
  const malhaMiolo = [];
  for (let i = 0; i < aneis.length; i++) {
    const an = sprite(mapaAnel, 7);
    const miolo = sprite(mapaMiolo, 6);
    grupo.add(miolo);
    grupo.add(an);
    malhaAnel.push(an);
    malhaMiolo.push(miolo);
  }

  const faiscas = faiscasBola();
  const malhaFaisca = [];
  for (let i = 0; i < faiscas.length; i++) {
    const s = sprite(mapaEstrela, 8);
    grupo.add(s);
    malhaFaisca.push(s);
  }

  const flashes = flashesBola();
  const malhaFlash = [];
  for (let i = 0; i < flashes.length; i++) {
    const s = sprite(mapaMiolo, 7);
    grupo.add(s);
    malhaFlash.push(s);
  }

  function cor(mat, r, g, b) {
    mat.color.setRGB(r / 255, g / 255, b / 255);
  }

  /** @param {THREE.Camera | null | undefined} [camera] */
  function atualizar(camera) {
    for (let i = 0; i < malhaAnel.length; i++) {
      const an = aneis[i];
      const malha = malhaAnel[i];
      const miolo = malhaMiolo[i];
      if (!an.viva || an.idade < 0) {
        if (malha.visible) malha.visible = false;
        if (miolo.visible) miolo.visible = false;
        continue;
      }
      const max = an.vidaMax || 0.7;
      const t = 1 - Math.max(0, an.vida) / max;
      const raio = an.inicio + (an.fim - an.inicio) * Math.min(1, t);
      const fade = an.vida / max;
      const alfa = an.suave
        ? Math.max(0, fade * (1 - t) * 0.55)
        : Math.max(0, fade * (t < 0.15 ? t / 0.15 : 1) * 0.9);
      const y = an.z * ALTURA_BLOCO + LEVANTAR;
      if (raio <= 0 || alfa <= 0.01) {
        malha.visible = false;
        miolo.visible = false;
        continue;
      }
      const diam = raio * 2 * (64 / 52);
      malha.visible = true;
      malha.position.set(an.x, y, an.y);
      malha.scale.set(diam, diam, 1);
      cor(malha.material, an.branco ? 255 : an.r, an.branco ? 255 : an.g, an.branco ? 255 : an.b);
      malha.material.opacity = Math.min(1, alfa);
      if (an.preenche) {
        miolo.visible = true;
        miolo.position.set(an.x, y, an.y);
        miolo.scale.set(raio * 2, raio * 2, 1);
        cor(miolo.material, an.r, an.g, an.b);
        miolo.material.opacity = Math.min(1, (an.suave ? alfa * 0.55 : alfa * 0.35) * 1.4);
      } else if (miolo.visible) {
        miolo.visible = false;
      }
    }

    for (let i = 0; i < malhaFaisca.length; i++) {
      const p = faiscas[i];
      const malha = malhaFaisca[i];
      if (!p.viva) {
        if (malha.visible) malha.visible = false;
        continue;
      }
      const alfa = Math.max(0, p.vida / (p.vidaMax || 0.4));
      const y = p.z * ALTURA_BLOCO + LEVANTAR;
      malha.visible = true;
      malha.position.set(p.x, y, p.y);
      cor(malha.material, p.r, p.g, p.b);
      malha.material.opacity = Math.min(1, 0.35 + 0.65 * alfa);
      if (p.traco) {
        const vel = Math.hypot(p.vx, p.vy) || 1;
        const len = p.tam * (2.4 + alfa * 2.2);
        if (malha.material.map !== mapaTraco) {
          malha.material.map = mapaTraco;
          malha.material.needsUpdate = true;
        }
        malha.material.rotation = rotacaoTraco(camera, p.vx, p.vy);
        // Alongar o traço na direção do movimento; centro um pouco atrás.
        const atras = Math.min(0.35, 0.12 + vel * 0.02);
        malha.center.set(0.5 - atras * 0.35, 0.5);
        malha.scale.set(Math.max(len, p.tam), Math.max(0.04, p.tam * 0.55), 1);
      } else if (p.estrela) {
        if (malha.material.map !== mapaEstrela) {
          malha.material.map = mapaEstrela;
          malha.material.needsUpdate = true;
        }
        malha.center.set(0.5, 0.5);
        malha.material.rotation = 0;
        const s = p.tam * 2.4;
        malha.scale.set(s, s, 1);
      } else {
        if (malha.material.map !== mapaMiolo) {
          malha.material.map = mapaMiolo;
          malha.material.needsUpdate = true;
        }
        malha.center.set(0.5, 0.5);
        malha.material.rotation = 0;
        const s = p.tam * 2;
        malha.scale.set(s, s, 1);
      }
    }

    for (let i = 0; i < malhaFlash.length; i++) {
      const f = flashes[i];
      const malha = malhaFlash[i];
      if (!f.viva) {
        if (malha.visible) malha.visible = false;
        continue;
      }
      const max = f.vidaMax || 0.4;
      const t = Math.max(0, f.vida / max);
      const recolhe = f.tipo === "recolher";
      const pulso = 0.6 + 0.4 * Math.sin((1 - t) * Math.PI * 5);
      const externo = (f.raio || 0.4) * (recolhe ? 1.15 + t * 0.35 : 1.25 + (1 - t) * 0.6);
      malha.visible = true;
      malha.position.set(f.x, f.z * ALTURA_BLOCO + LEVANTAR, f.y);
      malha.scale.set(externo * 2.4, externo * 2.4, 1);
      if (recolhe) cor(malha.material, 248, 113, 113);
      else cor(malha.material, 255, 255, 255);
      malha.material.opacity = Math.min(1, 0.28 + 0.55 * t * pulso);
    }
  }

  return { grupo, atualizar };
}
