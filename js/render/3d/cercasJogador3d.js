/**
 * Instanced quads / boxes para cercas do jogador.
 */
import * as THREE from "three";
import { alturaDoRelevo } from "../../mundo/bioma/catalogo.js";
import { listarCercas, versaoEstruturasJogador } from "../../construir/estruturas.js";
import { FENCE_KIND } from "../../construir/cerca/tipos.js";
import { roleCerca } from "../../construir/cerca/autotile.js";

const RAIO = 48;

/**
 * @returns {{ grupo: THREE.Group, atualizar: (px:number, py:number) => void, invalidar: () => void }}
 */
export function criarCercasJogador3d() {
  const grupo = new THREE.Group();
  grupo.name = "cercas-jogador";

  /** @type {Map<string, THREE.Object3D>} */
  const vivos = new Map();
  let versao = -1;
  let pxA = NaN;
  let pyA = NaN;

  const matSeg = new THREE.MeshStandardMaterial({
    color: 0xf5f5f4,
    roughness: 0.7,
  });
  const matGate = new THREE.MeshStandardMaterial({
    color: 0xa8a29e,
    roughness: 0.65,
  });

  function meshCerca(kind, role) {
    const isGate = kind === FENCE_KIND.GATE;
    const geo = isGate
      ? new THREE.BoxGeometry(0.85, 1.35, 0.18)
      : new THREE.BoxGeometry(0.95, 1.05, 0.16);
    const mesh = new THREE.Mesh(geo, isGate ? matGate : matSeg);
    mesh.position.y = isGate ? 0.67 : 0.52;
    if (role === "ew" || role === "e" || role === "w") mesh.rotation.y = Math.PI / 2;
    return mesh;
  }

  function liberar(id) {
    const m = vivos.get(id);
    if (!m) return;
    grupo.remove(m);
    m.geometry?.dispose?.();
    vivos.delete(id);
  }

  function sync(px, py) {
    const manter = new Set();
    const r2 = RAIO * RAIO;
    for (const c of listarCercas()) {
      const cx = c.tx + 0.5;
      const cy = c.ty + 0.5;
      const dx = cx - px;
      const dy = cy - py;
      if (dx * dx + dy * dy > r2) continue;
      const id = `${c.tx},${c.ty}`;
      manter.add(id);
      if (vivos.has(id)) continue;
      const role = roleCerca(c.tx, c.ty) || "post";
      const mesh = meshCerca(c.kind, role);
      mesh.name = id;
      const z = alturaDoRelevo(cx, cy);
      mesh.position.set(cx, z, cy);
      grupo.add(mesh);
      vivos.set(id, mesh);
    }
    for (const id of [...vivos.keys()]) {
      if (!manter.has(id)) liberar(id);
    }
    versao = versaoEstruturasJogador();
  }

  return {
    grupo,
    invalidar() {
      versao = -1;
      pxA = NaN;
    },
    atualizar(px, py) {
      const v = versaoEstruturasJogador();
      const moveu = !Number.isFinite(pxA) || Math.hypot(px - pxA, py - pyA) >= 3;
      if (v !== versao || moveu) {
        pxA = px;
        pyA = py;
        sync(px, py);
      }
    },
  };
}
