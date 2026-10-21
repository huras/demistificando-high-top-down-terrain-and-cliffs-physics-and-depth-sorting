import * as THREE from "three";
import { criarArceus } from "./arceus.js";
import { CAM } from "./config.js";
import { criarEspaco } from "./espaco.js";
import { criarLuzSagrada } from "./luzSagrada.js";

/** @type {null | {
 *   canvas: HTMLCanvasElement,
 *   renderer: THREE.WebGLRenderer,
 *   scene: THREE.Scene,
 *   camera: THREE.PerspectiveCamera,
 *   espaco: ReturnType<typeof criarEspaco>,
 *   arceus: ReturnType<typeof criarArceus>,
 *   luz: ReturnType<typeof criarLuzSagrada>,
 *   chave: THREE.DirectionalLight,
 *   fill: THREE.DirectionalLight,
 *   tempo: number,
 * }} */
let estado = null;

const alvo = new THREE.Vector3(0, CAM.alvoY, 0);

function redimensionar() {
  if (!estado) return;
  const { canvas, renderer, camera } = estado;
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  if (w < 1 || h < 1) return;
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== (w * pr) | 0 || canvas.height !== (h * pr) | 0) {
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
  }
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/**
 * @param {HTMLCanvasElement} canvas
 */
export async function ligarAbertura(canvas) {
  if (estado) liberarAbertura();

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.setClearColor(0x02010a, 1);
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02010a);
  scene.fog = null;

  const camera = new THREE.PerspectiveCamera(CAM.fov, 1, 0.1, 200);
  camera.position.set(0, CAM.alvoY + 0.4, CAM.dist);

  const hemi = new THREE.HemisphereLight(0xffe8b0, 0x1a1040, 0.55);
  hemi.name = "luz-hemi-abertura";
  scene.add(hemi);

  const chave = new THREE.DirectionalLight(0xffe2a0, 1.35);
  chave.name = "luz-chave-abertura";
  chave.position.set(2.4, 5.5, 3.2);
  scene.add(chave);

  const fill = new THREE.DirectionalLight(0x7aa8ff, 0.45);
  fill.name = "luz-fill-abertura";
  fill.position.set(-3.2, 2.2, -2.4);
  scene.add(fill);

  const espaco = criarEspaco();
  scene.add(espaco.mesh);

  const arceus = criarArceus(scene);
  await arceus.preparar();

  const luz = criarLuzSagrada(scene);

  estado = {
    canvas,
    renderer,
    scene,
    camera,
    espaco,
    arceus,
    luz,
    chave,
    fill,
    tempo: 0,
  };

  redimensionar();
  window.addEventListener("resize", redimensionar);
  return estado;
}

/** @param {number} dt */
export function avancarAbertura(dt) {
  if (!estado) return;
  const t = Math.min(0.05, Math.max(0, dt));
  estado.tempo += t;
  const agora = performance.now() / 1000;

  estado.espaco.avancar(t);
  estado.arceus.avancar(t, estado.camera, agora);
  estado.luz.avancar(t, estado.camera);

  const orb =
    Math.sin((estado.tempo * Math.PI * 2) / CAM.orbitaPeriodo) * CAM.orbitaAmp;
  const bob =
    Math.sin(estado.tempo * Math.PI * 2 * CAM.bobHz) * CAM.bobAmp;
  const cx = Math.sin(orb) * CAM.dist;
  const cz = Math.cos(orb) * CAM.dist;
  estado.camera.position.set(cx, CAM.alvoY + 0.15 + bob, cz);
  alvo.set(0, CAM.alvoY + bob * 0.35, 0);
  estado.camera.lookAt(alvo);

  const pulso = 1 + 0.06 * Math.sin(estado.tempo * 1.7);
  estado.chave.intensity = 1.35 * pulso;
}

export function desenharAbertura() {
  if (!estado) return;
  redimensionar();
  estado.renderer.render(estado.scene, estado.camera);
}

export function liberarAbertura() {
  if (!estado) return;
  window.removeEventListener("resize", redimensionar);
  estado.luz.liberar();
  estado.arceus.liberar();
  estado.espaco.liberar();
  estado.renderer.dispose();
  estado = null;
}

export function obterAbertura() {
  return estado;
}
