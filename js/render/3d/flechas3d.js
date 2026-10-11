import * as THREE from "three";
import {
  ALTURA_BLOCO,
  FLECHA_GRAVIDADE,
  FLECHA_MAX,
  FLECHA_VEL,
  FLECHA_VIDA,
} from "../../config.js";
import { raycastVoxel } from "../../mundo/voxel/alvoBloco.js";

const _dir = new THREE.Vector3();
const _look = new THREE.Vector3();

/**
 * Arco no ombro durante a mira e flechas com queda.
 */
export function criarFlechas3d() {
  const grupo = new THREE.Group();
  grupo.name = "flechas";

  const geo = new THREE.CylinderGeometry(0.018, 0.012, 0.72, 5);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xd7c4a3,
    roughness: 0.55,
    metalness: 0.05,
  });

  const arco = criarArco();
  grupo.add(arco.grupo);

  /** @type {{mesh: THREE.Mesh, vel: THREE.Vector3, vida: number, presa: boolean}[]} */
  const ativas = [];

  function disparar(camera3d, corpo) {
    if (!camera3d || camera3d.modo !== "mira") return;
    const origem = poseArco(corpo, camera3d);
    const mesh = obterMesh();
    mesh.position.set(origem.x, origem.y, origem.z);
    mesh.visible = true;

    _dir.copy(camera3d.direcaoTiro);
    if (_dir.lengthSq() < 1e-6) _dir.set(0, 0, -1);
    _dir.normalize();

    const vel = new THREE.Vector3(
      _dir.x * FLECHA_VEL + (corpo.vx || 0) * 0.35,
      _dir.y * FLECHA_VEL,
      _dir.z * FLECHA_VEL + (corpo.vy || 0) * 0.35,
    );

    mesh.lookAt(mesh.position.x + vel.x, mesh.position.y + vel.y, mesh.position.z + vel.z);
    ativas.push({ mesh, vel, vida: FLECHA_VIDA, presa: false });
  }

  function atualizar(dt, corpo, camera3d) {
    const mirando = !!camera3d && (camera3d.modo === "mira" || camera3d.blend > 0.25);
    if (corpo && camera3d && mirando) {
      const pose = poseArco(corpo, camera3d);
      arco.grupo.visible = true;
      arco.grupo.position.set(pose.x, pose.y, pose.z);
      arco.grupo.rotation.set(camera3d.pitchMira * 0.85, camera3d.yaw, 0);
    } else {
      arco.grupo.visible = false;
    }

    for (let i = ativas.length - 1; i >= 0; i--) {
      const flecha = ativas[i];
      flecha.vida -= dt;
      if (flecha.vida <= 0 || flecha.mesh.position.y < -4) {
        recolher(i);
        continue;
      }
      if (flecha.presa) continue;

      const passo = flecha.vel.length() * dt;
      const acertou = testarImpacto(flecha.mesh.position, flecha.vel, passo);
      if (acertou) {
        flecha.presa = true;
        flecha.vel.set(0, 0, 0);
        continue;
      }

      flecha.vel.y -= FLECHA_GRAVIDADE * dt;
      flecha.mesh.position.addScaledVector(flecha.vel, dt);
      if (flecha.vel.lengthSq() > 0.01) {
        _look.copy(flecha.mesh.position).add(flecha.vel);
        flecha.mesh.lookAt(_look);
      }
    }
  }

  function obterMesh() {
    if (ativas.length >= FLECHA_MAX) {
      const velha = ativas.shift();
      return velha.mesh;
    }
    const ociosa = grupo.children.find((filho) => filho.isMesh && !filho.visible && filho !== arco.grupo);
    if (ociosa) return ociosa;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.visible = false;
    grupo.add(mesh);
    return mesh;
  }

  function recolher(indice) {
    const flecha = ativas[indice];
    flecha.mesh.visible = false;
    ativas.splice(indice, 1);
  }

  return {
    grupo,
    disparar,
    atualizar,
    liberar() {
      geo.dispose();
      mat.dispose();
      arco.liberar();
    },
  };
}

function testarImpacto(pos, vel, passo) {
  if (passo < 0.02) return false;
  const dx = vel.x;
  const dy = vel.z;
  const dz = vel.y / ALTURA_BLOCO;
  const velocidade = Math.hypot(dx, dy, dz) || 1;
  const avanco = 0.25;
  const ox = pos.x + (dx / velocidade) * avanco;
  const oy = pos.z + (dy / velocidade) * avanco;
  const oz = pos.y / ALTURA_BLOCO + (dz / velocidade) * avanco;
  const hit = raycastVoxel(ox, oy, oz, dx, dy, dz, Math.max(passo, 0.08));
  if (!hit) return false;
  pos.set(
    hit.x + 0.5 + hit.nx * 0.52,
    (hit.z + 0.5 + hit.nz * 0.52) * ALTURA_BLOCO,
    hit.y + 0.5 + hit.ny * 0.52,
  );
  return true;
}

function poseArco(corpo, camera3d) {
  const elev = (corpo.elevacao ?? corpo.z ?? 0) * ALTURA_BLOCO;
  const yaw = camera3d.yaw;
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);
  const altura = elev + (camera3d.alturaPivo ?? 1.15) * 0.72;
  return {
    x: corpo.x + cosY * 0.22 + -sinY * 0.28,
    y: altura,
    z: corpo.y + -sinY * 0.22 + -cosY * 0.28,
  };
}

function criarArco() {
  const grupo = new THREE.Group();
  grupo.visible = false;
  const madeira = new THREE.MeshStandardMaterial({
    color: 0x8a5a32,
    roughness: 0.72,
  });
  const cordaMat = new THREE.MeshBasicMaterial({ color: 0xf3efe4 });
  const arco = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.028, 6, 20, Math.PI), madeira);
  arco.rotation.y = Math.PI / 2;
  grupo.add(arco);
  const corda = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.9, 4), cordaMat);
  grupo.add(corda);
  return {
    grupo,
    liberar() {
      arco.geometry.dispose();
      corda.geometry.dispose();
      madeira.dispose();
      cordaMat.dispose();
    },
  };
}
