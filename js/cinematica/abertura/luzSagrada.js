import * as THREE from "three";
import { ARCEUS, HALO, LUZ, RAIOS } from "./config.js";

const CANTOS = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];

const VERT = /* glsl */ `
attribute vec2 aCanto;
attribute vec3 aPos;
attribute vec3 aVel;
attribute vec4 aMeta; // tam, vida, nasc, fase
attribute vec3 aCor;
uniform float uTempo;
uniform vec3 uCima;
uniform vec3 uDireita;
varying vec2 vCanto;
varying vec3 vCor;
varying float vAlpha;

void main() {
  float vida = max(aMeta.y, 0.001);
  float idade = uTempo - aMeta.z;
  float t = idade / vida;
  if (t < 0.0 || t >= 1.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vCanto = aCanto;
    vCor = aCor;
    vAlpha = 0.0;
    return;
  }

  float fadeIn = smoothstep(0.0, 0.12, t);
  float fadeOut = 1.0 - smoothstep(0.55, 1.0, t);
  float pulso = 0.85 + 0.15 * sin(uTempo * 3.0 + aMeta.w * 6.28318);
  vAlpha = fadeIn * fadeOut * pulso;
  vCor = aCor;
  vCanto = aCanto;

  float fase = aMeta.w * 6.28318;
  vec3 drift = aVel * idade;
  drift.x += sin(idade * 1.4 + fase) * 0.12;
  drift.z += cos(idade * 1.1 + fase) * 0.12;
  vec3 mundo = aPos + drift;

  float cresce = mix(0.55, 1.15, sin(t * 3.14159));
  float tam = aMeta.x * cresce;
  vec3 mundoOff = mundo + uDireita * (aCanto.x * tam) + uCima * (aCanto.y * tam);
  gl_Position = projectionMatrix * viewMatrix * vec4(mundoOff, 1.0);
}
`;

const FRAG = /* glsl */ `
varying vec2 vCanto;
varying vec3 vCor;
varying float vAlpha;
uniform float uBrilho;

void main() {
  float d = length(vCanto);
  float nucleo = exp(-d * d * 6.5);
  float halo = exp(-d * d * 1.8) * 0.45;
  float a = (nucleo + halo) * vAlpha * uBrilho;
  if (a < 0.01) discard;
  vec3 cor = vCor * (0.55 + nucleo * 1.4);
  gl_FragColor = vec4(cor, a);
  #include <colorspace_fragment>
}
`;

function texturaHalo() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  const rad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  rad.addColorStop(0, "rgba(255,252,230,1)");
  rad.addColorStop(0.22, "rgba(255,230,150,0.75)");
  rad.addColorStop(0.55, "rgba(255,196,90,0.28)");
  rad.addColorStop(1, "rgba(255,180,60,0)");
  g.fillStyle = rad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function texturaRaio() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const g = c.getContext("2d");
  const rad = g.createLinearGradient(32, 0, 32, 256);
  rad.addColorStop(0, "rgba(255,250,220,0)");
  rad.addColorStop(0.15, "rgba(255,236,170,0.55)");
  rad.addColorStop(0.5, "rgba(255,220,120,0.85)");
  rad.addColorStop(0.85, "rgba(255,200,90,0.35)");
  rad.addColorStop(1, "rgba(255,180,60,0)");
  g.fillStyle = rad;
  g.fillRect(0, 0, 64, 256);
  const img = g.getImageData(0, 0, 64, 256);
  const px = img.data;
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      const nx = (x - 32) / 32;
      const mask = Math.exp(-nx * nx * 5.5);
      px[i + 3] = Math.min(255, (px[i + 3] * mask) | 0);
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function criarGeometria(cap) {
  const geo = new THREE.InstancedBufferGeometry();
  const pos = new Float32Array(18);
  for (let i = 0; i < 6; i++) {
    pos[i * 3] = CANTOS[i * 2];
    pos[i * 3 + 1] = CANTOS[i * 2 + 1];
    pos[i * 3 + 2] = 0;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aCanto", new THREE.BufferAttribute(new Float32Array(CANTOS), 2));
  geo.instanceCount = cap;

  const aPos = new Float32Array(cap * 3);
  const aVel = new Float32Array(cap * 3);
  const aMeta = new Float32Array(cap * 4);
  const aCor = new Float32Array(cap * 3);
  for (let i = 0; i < cap; i++) {
    aMeta[i * 4 + 2] = -100;
    aMeta[i * 4 + 1] = 1;
  }
  geo.setAttribute("aPos", new THREE.InstancedBufferAttribute(aPos, 3));
  geo.setAttribute("aVel", new THREE.InstancedBufferAttribute(aVel, 3));
  geo.setAttribute("aMeta", new THREE.InstancedBufferAttribute(aMeta, 4));
  geo.setAttribute("aCor", new THREE.InstancedBufferAttribute(aCor, 3));
  return { geo, aPos, aVel, aMeta, aCor };
}

/**
 * Partículas sagradas + halo + raios.
 * @param {THREE.Scene} scene
 */
export function criarLuzSagrada(scene) {
  const cap = LUZ.cap;
  const { geo, aPos, aVel, aMeta, aCor } = criarGeometria(cap);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTempo: { value: 0 },
      uCima: { value: new THREE.Vector3(0, 1, 0) },
      uDireita: { value: new THREE.Vector3(1, 0, 0) },
      uBrilho: { value: LUZ.brilho },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "particulas-sagradas";
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  scene.add(mesh);

  const texHalo = texturaHalo();
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texHalo,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: HALO.opacidade,
      toneMapped: false,
      fog: false,
    })
  );
  halo.name = "halo-sagrado";
  halo.position.set(ARCEUS.x, LUZ.centroY + 0.2, ARCEUS.z - 0.55);
  halo.scale.set(HALO.escala, HALO.escala, 1);
  halo.renderOrder = 1;
  scene.add(halo);

  const texRaio = texturaRaio();
  const raios = [];
  for (let i = 0; i < RAIOS.qtd; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(RAIOS.largura, RAIOS.altura),
      new THREE.MeshBasicMaterial({
        map: texRaio,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: RAIOS.opacidade,
        side: THREE.DoubleSide,
        toneMapped: false,
        fog: false,
      })
    );
    m.name = `raio-sagrado-${i}`;
    const ang = (i / RAIOS.qtd) * Math.PI * 2;
    m.position.set(
      Math.cos(ang) * 0.15,
      LUZ.centroY + RAIOS.altura * 0.15,
      Math.sin(ang) * 0.15
    );
    m.rotation.y = ang;
    m.renderOrder = 2;
    scene.add(m);
    raios.push({ mesh: m, ang, fase: i * 1.7 });
  }

  let tempo = 0;
  let cursor = 0;
  let acumEmit = 0;
  const _direita = new THREE.Vector3();
  const _cima = new THREE.Vector3(0, 1, 0);
  const _frente = new THREE.Vector3();

  function emitirUma() {
    const i = cursor;
    cursor = (cursor + 1) % cap;
    const ang = Math.random() * Math.PI * 2;
    // Anel: evita saturar o peito do Arceus na câmera.
    const r = LUZ.raioEmit * (0.35 + Math.random() * 0.65);
    const y = LUZ.centroY - LUZ.alturaEmit * 0.25 + Math.random() * LUZ.alturaEmit;
    aPos[i * 3] = ARCEUS.x + Math.cos(ang) * r;
    aPos[i * 3 + 1] = y;
    aPos[i * 3 + 2] = ARCEUS.z + Math.sin(ang) * r - 0.15;
    const subida =
      LUZ.velSubidaMin + Math.random() * (LUZ.velSubidaMax - LUZ.velSubidaMin);
    aVel[i * 3] = Math.cos(ang + 0.8) * LUZ.espiral * (0.3 + Math.random());
    aVel[i * 3 + 1] = subida;
    aVel[i * 3 + 2] = Math.sin(ang + 0.8) * LUZ.espiral * (0.3 + Math.random());
    aMeta[i * 4] =
      LUZ.tamanhoMin + Math.random() * (LUZ.tamanhoMax - LUZ.tamanhoMin);
    aMeta[i * 4 + 1] =
      LUZ.vidaMin + Math.random() * (LUZ.vidaMax - LUZ.vidaMin);
    aMeta[i * 4 + 2] = tempo;
    aMeta[i * 4 + 3] = Math.random();
    const ouro = Math.random();
    aCor[i * 3] = 0.95 + ouro * 0.05;
    aCor[i * 3 + 1] = 0.82 + ouro * 0.12;
    aCor[i * 3 + 2] = 0.45 + ouro * 0.35;
  }

  for (let i = 0; i < Math.min(120, cap); i++) {
    emitirUma();
    const idx = (cursor - 1 + cap) % cap;
    aMeta[idx * 4 + 2] = tempo - Math.random() * LUZ.vidaMax;
  }
  geo.attributes.aPos.needsUpdate = true;
  geo.attributes.aVel.needsUpdate = true;
  geo.attributes.aMeta.needsUpdate = true;
  geo.attributes.aCor.needsUpdate = true;

  return {
    /**
     * @param {number} dt
     * @param {THREE.Camera} camera
     */
    avancar(dt, camera) {
      tempo += dt;
      mat.uniforms.uTempo.value = tempo;

      camera.updateMatrixWorld();
      camera.matrixWorld.extractBasis(_direita, _cima, _frente);
      _direita.normalize();
      _cima.normalize();
      mat.uniforms.uDireita.value.copy(_direita);
      mat.uniforms.uCima.value.copy(_cima);

      acumEmit += LUZ.emitPorSeg * dt;
      let sujo = false;
      while (acumEmit >= 1) {
        acumEmit -= 1;
        emitirUma();
        sujo = true;
      }
      if (sujo) {
        geo.attributes.aPos.needsUpdate = true;
        geo.attributes.aVel.needsUpdate = true;
        geo.attributes.aMeta.needsUpdate = true;
        geo.attributes.aCor.needsUpdate = true;
      }

      const pulso =
        1 +
        HALO.pulsoAmp *
          Math.sin(tempo * Math.PI * 2 * HALO.pulsoHz);
      halo.material.opacity = HALO.opacidade * pulso;
      halo.scale.setScalar(HALO.escala * (0.96 + 0.04 * pulso));
      halo.position.y = LUZ.centroY + Math.sin(tempo * 0.7) * 0.05;

      for (let i = 0; i < raios.length; i++) {
        const r = raios[i];
        const sway =
          Math.sin(tempo * Math.PI * 2 * RAIOS.swayHz + r.fase) *
          RAIOS.swayAmp;
        r.mesh.rotation.y = r.ang + sway;
        r.mesh.material.opacity =
          RAIOS.opacidade *
          (0.75 + 0.25 * Math.sin(tempo * 1.3 + r.fase));
      }
    },
    liberar() {
      scene.remove(mesh);
      scene.remove(halo);
      for (const r of raios) {
        scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
      }
      geo.dispose();
      mat.dispose();
      texHalo.dispose();
      texRaio.dispose();
      halo.material.dispose();
    },
  };
}
