import * as THREE from "three";
import { ALTURA_NUVEM } from "./parametros.js";

const MAX_PONTOS = 96;
const MAX_VERTS = MAX_PONTOS * 12;

function ladoDe(a, b, destino) {
  destino.set(-(b.z - a.z), 0, b.x - a.x);
  const len = Math.hypot(destino.x, destino.z);
  if (len < 1e-4) destino.set(1, 0, 0);
  else destino.multiplyScalar(1 / len);
  return destino;
}

function deslocar(pontos, amplitude, passos) {
  let atual = pontos;
  let amp = amplitude;
  const lado = new THREE.Vector3();
  for (let s = 0; s < passos; s++) {
    const prox = [atual[0]];
    for (let i = 0; i < atual.length - 1; i++) {
      const a = atual[i];
      const b = atual[i + 1];
      const m = new THREE.Vector3().lerpVectors(a, b, 0.5);
      ladoDe(a, b, lado);
      m.addScaledVector(lado, (Math.random() - 0.5) * 2 * amp);
      m.y += (Math.random() - 0.5) * amp * 0.2;
      prox.push(m, b);
    }
    atual = prox;
    amp *= 0.55;
  }
  return atual;
}

function escreverFita(pontos, largura, pos, cor, pi, brilho, tint) {
  const lado = new THREE.Vector3();
  let cursor = pi;
  for (let i = 0; i < pontos.length - 1 && cursor < MAX_VERTS - 6; i++) {
    const a = pontos[i];
    const b = pontos[i + 1];
    ladoDe(a, b, lado);
    const afunila = 0.35 + 0.65 * (1 - i / (pontos.length - 1));
    const w = largura * afunila;
    const ax = a.x + lado.x * w;
    const az = a.z + lado.z * w;
    const bx = a.x - lado.x * w;
    const bz = a.z - lado.z * w;
    const cx = b.x + lado.x * w;
    const cz = b.z + lado.z * w;
    const dx = b.x - lado.x * w;
    const dz = b.z - lado.z * w;
    const tris = [
      ax, a.y, az, bx, a.y, bz, cx, b.y, cz,
      bx, a.y, bz, dx, b.y, dz, cx, b.y, cz,
    ];
    for (let k = 0; k < 18; k++) pos[cursor * 3 + k] = tris[k];
    for (let v = 0; v < 6; v++) {
      const ci = (cursor + v) * 3;
      cor[ci] = tint.r * brilho;
      cor[ci + 1] = tint.g * brilho;
      cor[ci + 2] = tint.b * brilho;
    }
    cursor += 6;
  }
  return cursor;
}

/**
 * Raio em fita (largura real — linewidth do GL não passa de 1px no Windows)
 * mais um clarão pontual. O flash de exposição fica no céu.
 */
export function criarRelampago() {
  const pos = new Float32Array(MAX_VERTS * 3);
  const cor = new Float32Array(MAX_VERTS * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(cor, 3));
  geo.setDrawRange(0, 0);

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });

  const fita = new THREE.Mesh(geo, material);
  fita.frustumCulled = false;
  fita.renderOrder = 6;
  fita.visible = false;

  const disco = new THREE.Mesh(
    new THREE.CircleGeometry(4.2, 18),
    new THREE.MeshBasicMaterial({
      color: 0xc9dcff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
  );
  disco.rotation.x = -Math.PI / 2;
  disco.frustumCulled = false;
  disco.renderOrder = 5;
  disco.visible = false;

  const luz = new THREE.PointLight(0xd6e6ff, 0, 56, 2);
  luz.castShadow = false;

  const grupo = new THREE.Group();
  grupo.name = "ceu-relampago";
  grupo.add(fita, disco, luz);

  const tintGlow = new THREE.Color(0x8eb4ff);
  const tintMiolo = new THREE.Color(0xf7fbff);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  let flash = 0;
  let espera = 2.5 + Math.random() * 2;
  let eco = 0;

  function disparar(alvo, secundario) {
    const alcance = 8 + Math.random() * 16;
    const ang = Math.random() * Math.PI * 2;
    const x = alvo.x + Math.cos(ang) * alcance;
    const z = alvo.z + Math.sin(ang) * alcance;
    const topo = ALTURA_NUVEM - 1.5;
    const chao = alvo.y + 0.2;
    a.set(x + (Math.random() - 0.5) * 6, topo, z + (Math.random() - 0.5) * 6);
    b.set(x, chao, z);
    const tronco = deslocar([a.clone(), b.clone()], 4.5, 5);
    const meio = tronco[Math.max(1, (tronco.length * 0.42) | 0)];
    const ramoFim = meio.clone();
    ramoFim.x += (Math.random() - 0.5) * 10;
    ramoFim.y = chao + 6 + Math.random() * 8;
    ramoFim.z += (Math.random() - 0.5) * 10;
    const ramo = deslocar([meio.clone(), ramoFim], 2.2, 4);

    pos.fill(0);
    cor.fill(0);
    let cursor = 0;
    cursor = escreverFita(tronco, 0.85, pos, cor, cursor, 0.45, tintGlow);
    cursor = escreverFita(ramo, 0.45, pos, cor, cursor, 0.28, tintGlow);
    cursor = escreverFita(tronco, 0.16, pos, cor, cursor, 1, tintMiolo);
    cursor = escreverFita(ramo, 0.08, pos, cor, cursor, 0.8, tintMiolo);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.setDrawRange(0, cursor);

    disco.position.set(b.x, chao + 0.15, b.z);
    luz.position.set(b.x, chao + 6, b.z);
    fita.visible = true;
    disco.visible = true;
    flash = secundario ? Math.max(flash, 0.72) : 1;
    if (!secundario && Math.random() < 0.38) eco = 0.09 + Math.random() * 0.07;
  }

  function atualizar(dt, taxa, alvo) {
    if (taxa > 0.04) {
      espera -= dt * (0.45 + taxa * 1.35);
      if (espera <= 0) {
        disparar(alvo, false);
        espera = 1.6 + Math.random() * 4.2;
      }
      if (eco > 0) {
        eco -= dt;
        if (eco <= 0) {
          eco = 0;
          disparar(alvo, true);
        }
      }
    }
    flash *= Math.exp(-dt * 7.2);
    const visivel = flash > 0.04;
    fita.visible = visivel;
    disco.visible = visivel;
    material.opacity = visivel ? Math.min(1, flash * 1.15) : 0;
    disco.material.opacity = visivel ? flash * 0.45 : 0;
    const escala = 0.6 + flash * 1.4;
    disco.scale.setScalar(escala);
    luz.intensity = visivel ? flash * 36 : 0;
    return flash;
  }

  return {
    grupo,
    atualizar,
    get flash() {
      return flash;
    },
  };
}
