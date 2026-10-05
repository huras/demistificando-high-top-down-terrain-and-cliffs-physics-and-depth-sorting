import * as THREE from "three";
import { atualizarVisualAlvoEscalada } from "../alvoEscalada.js";
import { usarTiles } from "../atlas.js";
import {
  ajustarDistancia,
  aplicarOlharMouse,
  criarCamera3d,
  distanciaNormalizada,
  seguirAlvo3d,
  yawCamera,
} from "./camera3d.js";
import { criarPersonagem3d } from "./personagem3d.js";
import { criarTerrenoMalha } from "./terrenoMalha.js";

let estado = null;

/**
 * Inicializa cena Three.js uma vez (fica quente entre toggles).
 */
export function iniciarCenario3d(canvas) {
  if (estado?.pronto) return estado;

  const largura = canvas.width || 960;
  const altura = canvas.height || 540;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(largura, altura, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a100c);
  scene.fog = new THREE.FogExp2(0x0a100c, 0.028);

  const camera3d = criarCamera3d(largura / altura);

  const hemi = new THREE.HemisphereLight(0xb8d4ff, 0x3a2818, 0.55);
  scene.add(hemi);

  const sol = new THREE.DirectionalLight(0xfff2d6, 1.35);
  sol.position.set(28, 42, 18);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  sol.shadow.camera.near = 2;
  sol.shadow.camera.far = 120;
  sol.shadow.camera.left = -40;
  sol.shadow.camera.right = 40;
  sol.shadow.camera.top = 40;
  sol.shadow.camera.bottom = -40;
  sol.shadow.bias = -0.00025;
  sol.shadow.normalBias = 0.04;
  scene.add(sol);
  scene.add(sol.target);

  const fill = new THREE.DirectionalLight(0x6a8aaa, 0.25);
  fill.position.set(-20, 12, -10);
  scene.add(fill);

  const terreno = criarTerrenoMalha();
  scene.add(terreno.mesh);

  const personagem = criarPersonagem3d();
  scene.add(personagem.grupo);

  const agente3d = criarPersonagem3d({
    nome: "agente",
    cor: 0x5ec8e8,
    emissive: 0x0a3048,
    detalhe: 0xe8a040,
  });
  scene.add(agente3d.grupo);

  const alvoEscalada = criarMarcadorAlvoEscalada();
  scene.add(alvoEscalada.mesh);

  estado = {
    canvas,
    renderer,
    scene,
    camera3d,
    sol,
    terreno,
    personagem,
    agente3d,
    alvoEscalada,
    pronto: true,
    distanciaNormalizada: () => distanciaNormalizada(camera3d),
    yaw: () => yawCamera(camera3d),
  };

  return estado;
}

function criarMarcadorAlvoEscalada() {
  const geo = new THREE.RingGeometry(0.22, 0.38, 28);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x7dce6a,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  mesh.renderOrder = 2;

  const disco = new THREE.Mesh(
    new THREE.CircleGeometry(0.2, 24),
    new THREE.MeshBasicMaterial({
      color: 0x7dce6a,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  disco.rotation.x = -Math.PI / 2;
  disco.position.y = 0.01;
  mesh.add(disco);

  return {
    mesh,
    atualizar(corpo, dt = 1 / 60) {
      const alvo = atualizarVisualAlvoEscalada(corpo, dt);
      if (!alvo) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      const pulso = 0.92 + 0.08 * Math.sin(performance.now() * 0.006);
      mesh.scale.setScalar(pulso);
      mesh.position.set(alvo.x, (alvo.vz ?? alvo.z) + 0.04, alvo.y);
    },
  };
}

export function obterCenario3d() {
  return estado;
}

export function sincronizarVisualTerreno(atlas) {
  if (!estado) return;
  estado.terreno.aplicarVisual(usarTiles(atlas));
}

export function ajustarZoom3d(fator) {
  if (!estado) return;
  ajustarDistancia(estado.camera3d, fator);
}

export function resetarCamera3d() {
  if (!estado) return;
  estado.camera3d.pronta = false;
}

/** Aplica deltas de mouse-look (pixels) na câmera 3D. */
export function olharCamera3d(dx, dy) {
  if (!estado) return;
  aplicarOlharMouse(estado.camera3d, dx, dy);
}

/**
 * Atualiza câmera/personagem e renderiza um frame.
 */
export function atualizarEDesenhar3d(corpo, dt, atlas, agente = null) {
  if (!estado) return null;

  sincronizarVisualTerreno(atlas);
  seguirAlvo3d(estado.camera3d, corpo, dt);
  estado.personagem.atualizar(corpo);
  if (agente && estado.agente3d) estado.agente3d.atualizar(agente);
  estado.alvoEscalada.atualizar(corpo, dt);

  // sombra do sol acompanha o jogador (frustum apertado = qualidade)
  estado.sol.target.position.set(corpo.x, corpo.elevacao ?? corpo.z, corpo.y);
  estado.sol.position.set(corpo.x + 28, (corpo.elevacao ?? corpo.z) + 42, corpo.y + 18);

  estado.renderer.render(estado.scene, estado.camera3d.cam);
  return estado;
}

export function redimensionarCenario3d(w, h) {
  if (!estado) return;
  estado.renderer.setSize(w, h, false);
  estado.camera3d.cam.aspect = w / h;
  estado.camera3d.cam.updateProjectionMatrix();
}
