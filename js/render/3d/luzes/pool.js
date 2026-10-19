import * as THREE from "three";
import { marcarLuzReflexo } from "../ceu/reflexoPoca.js";

const CAP = 8;
const FUNDIR = 2.5;

const luzes = [];
const cartoes = [];
const candidatos = [];
const _cor = new THREE.Color();

let pesoNoite = 0;
let textura = null;

function texturaBrilho() {
  if (textura) return textura;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  textura = new THREE.CanvasTexture(c);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.magFilter = THREE.LinearFilter;
  textura.minFilter = THREE.LinearFilter;
  return textura;
}

export function criarCartaoLuz(cor, raio) {
  const mat = new THREE.SpriteMaterial({
    map: texturaBrilho(),
    color: new THREE.Color(cor),
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    opacity: 0,
  });
  const sprite = new THREE.Sprite(mat);
  const lado = Math.max(0.35, raio * 0.85);
  sprite.scale.set(lado, lado, 1);
  sprite.renderOrder = 4;
  sprite.userData.luzLocal = true;
  cartoes.push(sprite);
  return sprite;
}

export function criarPoolLuzes(scene) {
  for (let i = 0; i < CAP; i++) {
    const luz = new THREE.PointLight("#fff1d0", 0, 6, 2);
    luz.castShadow = false;
    luz.name = `luz-local-${i}`;
    marcarLuzReflexo(luz);
    scene.add(luz);
    luzes.push(luz);
  }
}

export function definirPesoNoite(peso) {
  pesoNoite = Math.max(0, Math.min(1, peso));
}

export function obterPesoNoite() {
  return pesoNoite;
}

export function comecarQuadroLuzes() {
  candidatos.length = 0;
}

export function oferecerLuz(dono, x, y, z, cor, raio, intensidade) {
  candidatos.push({
    dono,
    x,
    y,
    z,
    cor,
    raio: raio > 0 ? raio : 2,
    intensidade: intensidade > 0 ? intensidade : 0,
  });
}

function distancia2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function agrupar(pontos) {
  const usados = new Uint8Array(pontos.length);
  const grupos = [];
  const limite = FUNDIR * FUNDIR;
  for (let i = 0; i < pontos.length; i++) {
    if (usados[i]) continue;
    const grupo = [];
    const fila = [i];
    usados[i] = 1;
    while (fila.length) {
      const a = fila.pop();
      grupo.push(pontos[a]);
      for (let j = 0; j < pontos.length; j++) {
        if (usados[j]) continue;
        if (distancia2(pontos[a], pontos[j]) > limite) continue;
        usados[j] = 1;
        fila.push(j);
      }
    }
    grupos.push(grupo);
  }
  return grupos;
}

function fundir(grupo) {
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let peso = 0;
  let cr = 0;
  let cg = 0;
  let cb = 0;
  let intensidade = 0;
  for (let i = 0; i < grupo.length; i++) {
    const p = grupo[i];
    const m = p.intensidade;
    sx += p.x * m;
    sy += p.y * m;
    sz += p.z * m;
    peso += m;
    _cor.set(p.cor);
    cr += _cor.r * m;
    cg += _cor.g * m;
    cb += _cor.b * m;
    if (m > intensidade) intensidade = m;
  }
  if (peso <= 1e-4) {
    peso = grupo.length;
    sx = 0;
    sy = 0;
    sz = 0;
    cr = 0;
    cg = 0;
    cb = 0;
    for (let i = 0; i < grupo.length; i++) {
      const p = grupo[i];
      sx += p.x;
      sy += p.y;
      sz += p.z;
      _cor.set(p.cor);
      cr += _cor.r;
      cg += _cor.g;
      cb += _cor.b;
    }
  }
  const inv = 1 / peso;
  const centro = { x: sx * inv, y: sy * inv, z: sz * inv };
  let raio = 1.5;
  for (let i = 0; i < grupo.length; i++) {
    const p = grupo[i];
    const d = Math.sqrt(distancia2(centro, p)) + p.raio;
    if (d > raio) raio = d;
  }
  return {
    x: centro.x,
    y: centro.y,
    z: centro.z,
    raio,
    intensidade,
    cor: new THREE.Color(cr * inv, cg * inv, cb * inv),
  };
}

export function resolverLuzes(camX, camY, camZ, alcance = 90) {
  for (let i = 0; i < cartoes.length; i++) {
    cartoes[i].material.opacity = pesoNoite;
  }
  const noite = pesoNoite;
  if (noite <= 0.02) {
    for (let i = 0; i < luzes.length; i++) luzes[i].intensity = 0;
    return;
  }

  const limite = alcance * alcance;
  const porDono = new Map();
  for (let i = 0; i < candidatos.length; i++) {
    const p = candidatos[i];
    let lista = porDono.get(p.dono);
    if (!lista) {
      lista = [];
      porDono.set(p.dono, lista);
    }
    lista.push(p);
  }

  const vagas = [];
  for (const lista of porDono.values()) {
    const grupos = agrupar(lista);
    let melhor = null;
    let melhorD = Infinity;
    for (let g = 0; g < grupos.length; g++) {
      const fonte = fundir(grupos[g]);
      const dx = fonte.x - camX;
      const dy = fonte.y - camY;
      const dz = fonte.z - camZ;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < melhorD) {
        melhorD = d;
        melhor = fonte;
        melhor.d2 = d;
      }
    }
    if (melhor && melhorD <= limite) vagas.push(melhor);
  }

  vagas.sort((a, b) => a.d2 - b.d2);
  const n = Math.min(CAP, vagas.length);
  for (let i = 0; i < luzes.length; i++) {
    const luz = luzes[i];
    if (i >= n) {
      luz.intensity = 0;
      continue;
    }
    const fonte = vagas[i];
    luz.color.copy(fonte.cor);
    luz.intensity = fonte.intensidade * noite;
    luz.distance = fonte.raio;
    luz.position.set(fonte.x, fonte.y, fonte.z);
  }
}
