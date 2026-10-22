import * as THREE from "three";
import {
  ALTURA_BLOCO,
  FLECHA_GRAVIDADE,
  FLECHA_MAX,
  FLECHA_VEL,
  FLECHA_VEL_MIN,
  FLECHA_VIDA,
} from "../../config.js";
import { raycastVoxel } from "../../mundo/voxel/alvoBloco.js";
import { tentarAcertoFlecha } from "../../pokemon/sistema.js";

const _dir = new THREE.Vector3();
const _look = new THREE.Vector3();

/**
 * Arco no ombro durante a mira e flechas com queda.
 * A carga/tiro vêm do gesto ranged; aqui só visual + física.
 */
export function criarFlechas3d() {
  const grupo = new THREE.Group();
  grupo.name = "flechas";

  const geo = new THREE.CylinderGeometry(0.018, 0.012, 0.72, 5);
  geo.rotateX(Math.PI / 2);
  geo.rotateY(Math.PI);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xd7c4a3,
    roughness: 0.55,
    metalness: 0.05,
  });

  const arco = criarArco(mat);
  grupo.add(arco.grupo);

  /** @type {{mesh: THREE.Mesh, vel: THREE.Vector3, vida: number, presa: boolean, forca: number}[]} */
  const ativas = [];
  let carga = 0;

  function definirCargaVisual(valor) {
    carga = Math.min(1, Math.max(0, Number(valor) || 0));
  }

  function direcaoDisparo(camera3d, corpo) {
    _dir.copy(camera3d.direcaoTiro);
    if (_dir.lengthSq() < 1e-6) _dir.set(0, 0, -1);
    _dir.normalize();
    // Hipfire em órbita quase de cima: usa o facing do corpo.
    if (camera3d.modo !== "mira" && Math.abs(_dir.y) > 0.85) {
      const dx = corpo.dirX || 0;
      const dy = corpo.dirY || 1;
      const len = Math.hypot(dx, dy) || 1;
      _dir.set(dx / len, 0.12, dy / len).normalize();
    }
    return _dir;
  }

  function disparar(camera3d, corpo, forca = 1) {
    if (!camera3d || !corpo) return;
    const origem = poseArco(corpo, camera3d);
    const mesh = obterMesh();
    mesh.position.set(origem.x, origem.y, origem.z);
    mesh.visible = true;

    const dir = direcaoDisparo(camera3d, corpo);
    const t = Math.min(1, Math.max(0, forca));
    const velocidade = FLECHA_VEL_MIN + (FLECHA_VEL - FLECHA_VEL_MIN) * t;
    const vel = new THREE.Vector3(
      dir.x * velocidade + (corpo.vx || 0) * 0.35,
      dir.y * velocidade,
      dir.z * velocidade + (corpo.vy || 0) * 0.35,
    );

    mesh.lookAt(mesh.position.x + vel.x, mesh.position.y + vel.y, mesh.position.z + vel.z);
    ativas.push({ mesh, vel, vida: FLECHA_VIDA, presa: false, forca: t });
  }

  function atualizar(dt, corpo, camera3d) {
    const mirando = !!camera3d && (camera3d.modo === "mira" || camera3d.blend > 0.25);
    const naMira = !!camera3d && camera3d.modo === "mira";

    if (corpo && camera3d && mirando) {
      const pose = poseArco(corpo, camera3d);
      arco.grupo.visible = true;
      arco.grupo.position.set(pose.x, pose.y, pose.z);
      _look.set(pose.x, pose.y, pose.z).add(camera3d.direcaoTiro);
      arco.grupo.lookAt(_look);
      const puxar = (naMira ? carga : 0) * 0.36;
      arco.corda.position.z = -puxar;
      arco.nock.position.z = -puxar + 0.36;
      arco.nock.visible = naMira;
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

      const p = flecha.mesh.position;
      if (tentarAcertoFlecha(p.x, p.z, p.y, flecha.forca)) {
        flecha.presa = true;
        flecha.vel.set(0, 0, 0);
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
    definirCargaVisual,
    atualizar,
    carga: () => carga,
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

function criarArco(matFlecha) {
  const grupo = new THREE.Group();
  grupo.visible = false;
  grupo.rotation.order = "XYZ";
  const madeira = new THREE.MeshStandardMaterial({
    color: 0x8a5a32,
    roughness: 0.72,
  });
  const cordaMat = new THREE.MeshBasicMaterial({ color: 0xf3efe4 });
  const geoArco = new THREE.TorusGeometry(0.46, 0.028, 6, 20, Math.PI);
  geoArco.rotateZ(-Math.PI / 2);
  geoArco.rotateY(-Math.PI / 2);
  const arco = new THREE.Mesh(geoArco, madeira);
  grupo.add(arco);
  const corda = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.9, 4), cordaMat);
  grupo.add(corda);
  const geoNock = new THREE.CylinderGeometry(0.012, 0.02, 0.72, 5);
  geoNock.rotateX(Math.PI / 2);
  const nock = new THREE.Mesh(geoNock, matFlecha);
  nock.castShadow = true;
  nock.visible = false;
  grupo.add(nock);
  return {
    grupo,
    corda,
    nock,
    liberar() {
      arco.geometry.dispose();
      corda.geometry.dispose();
      geoNock.dispose();
      madeira.dispose();
      cordaMat.dispose();
    },
  };
}
