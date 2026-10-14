import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as clonarEsqueleto } from "three/addons/utils/SkeletonUtils.js";

const loader = new GLTFLoader();
const moldes = new Map();
let indice = null;

const CLIP = {
  Idle: "idle",
  Walk: "walk",
  FlapAround: "walk",
  Attack: "attack",
  Strike: "attack",
  Shoot: "attack",
  Hurt: "hit",
  Sleep: "sleep",
};

function carregarIndice() {
  if (!indice) {
    indice = fetch("/assets/pokemon/malha/indice.json")
      .then((res) => (res.ok ? res.json() : {}))
      .catch(() => ({}));
  }
  return indice;
}

function prepararMolde(cena) {
  cena.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = false;
    obj.receiveShadow = true;
    obj.frustumCulled = true;
    const lista = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (let i = 0; i < lista.length; i++) {
      const mat = lista[i];
      if (!mat) continue;
      if (mat.emissiveMap) {
        mat.userData.mapaBrilhante = mat.emissiveMap;
        mat.emissiveMap = null;
        mat.emissive.setRGB(0, 0, 0);
      }
      mat.metalness = 0;
      mat.roughness = 0.62;
    }
  });
}

export function pedirMolde(dex) {
  const id = dex | 0;
  if (moldes.has(id)) return moldes.get(id);
  const promessa = carregarIndice().then(async (tabela) => {
    if (!tabela || !tabela[String(id)]) return null;
    try {
      const gltf = await loader.loadAsync(`/assets/pokemon/malha/${id}.glb`);
      prepararMolde(gltf.scene);
      return { cena: gltf.scene, clips: gltf.animations };
    } catch {
      return null;
    }
  });
  moldes.set(id, promessa);
  return promessa;
}

export function criarInstancia(molde, shiny) {
  const grupo = clonarEsqueleto(molde.cena);
  grupo.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = false;
    obj.receiveShadow = true;
    obj.frustumCulled = true;
    if (!shiny) return;
    const lista = Array.isArray(obj.material) ? obj.material : [obj.material];
    const clones = [];
    for (let i = 0; i < lista.length; i++) {
      const mat = lista[i];
      if (!mat) {
        clones.push(mat);
        continue;
      }
      const copia = mat.clone();
      if (mat.userData.mapaBrilhante) copia.map = mat.userData.mapaBrilhante;
      copia.userData.proprio = true;
      clones.push(copia);
    }
    obj.material = Array.isArray(obj.material) ? clones : clones[0];
  });
  const mixer = new THREE.AnimationMixer(grupo);
  return { grupo, mixer, clips: molde.clips, acao: null, clip: "", yaw: 0 };
}

export function descartarInstancia(inst) {
  if (!inst) return;
  inst.mixer.stopAllAction();
  inst.grupo.removeFromParent();
  inst.grupo.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const lista = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (let i = 0; i < lista.length; i++) {
      if (lista[i]?.userData?.proprio) lista[i].dispose();
    }
  });
}

export function nomeDoClip(ator) {
  if (ator.morto) return "faint";
  if ((ator.dormindo || 0) > 0) return "sleep";
  return CLIP[ator.visual?.anim] || "idle";
}

function aproximarAngulo(atual, alvo, dt) {
  let delta = alvo - atual;
  if (delta > Math.PI) delta -= Math.PI * 2;
  else if (delta < -Math.PI) delta += Math.PI * 2;
  const passo = 1 - Math.exp(-12 * dt);
  return atual + delta * passo;
}

export function atualizarInstancia(inst, ator, dt) {
  const nome = nomeDoClip(ator);
  if (inst.clip !== nome) {
    const clip = THREE.AnimationClip.findByName(inst.clips, nome)
      || THREE.AnimationClip.findByName(inst.clips, "idle")
      || inst.clips[0];
    if (clip) {
      const umaVez = nome === "faint" || nome === "attack" || nome === "hit";
      const acao = inst.mixer.clipAction(clip);
      acao.setLoop(umaVez ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      acao.clampWhenFinished = umaVez;
      if (inst.acao && inst.acao !== acao) inst.acao.fadeOut(0.14);
      acao.reset().fadeIn(0.14).play();
      inst.acao = acao;
      inst.clip = nome;
    }
  }
  inst.mixer.update(Math.min(Math.max(dt, 0), 0.05));
  if (ator.andando && (ator.dirX || ator.dirY)) {
    inst.yaw = aproximarAngulo(inst.yaw, Math.atan2(ator.dirX, ator.dirY), dt);
  }
  inst.grupo.rotation.y = inst.yaw;
}
