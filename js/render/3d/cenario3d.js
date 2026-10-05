import * as THREE from "three";
import { consultarAlvoEscalada } from "../alvoEscalada.js";
import { usarTiles } from "../atlas.js";
import { teclaBaixa } from "../../entrada/teclado.js";
import {
  ajustarDistancia,
  criarCamera3d,
  distanciaNormalizada,
  girarYaw,
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
    atualizar(corpo) {
      const alvo = consultarAlvoEscalada(corpo);
      if (!alvo) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      const pulso = 0.92 + 0.08 * Math.sin(performance.now() * 0.006);
      mesh.scale.setScalar(pulso);
      mesh.position.set(alvo.cx + 0.5, alvo.z + 0.04, alvo.cy + 0.5);
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

/** Q/E orbitam yaw (hold). Chamar antes do movimento pra WASD strafear no yaw atual. */
export function orbitarCamera3d(dt) {
  if (!estado) return;
  let sentido = 0;
  if (teclaBaixa("KeyQ")) sentido -= 1;
  if (teclaBaixa("KeyE")) sentido += 1;
  girarYaw(estado.camera3d, sentido, dt);
}

/**
 * Atualiza câmera/personagem e renderiza um frame.
 */
export function atualizarEDesenhar3d(corpo, dt, atlas) {
  if (!estado) return null;

  sincronizarVisualTerreno(atlas);
  seguirAlvo3d(estado.camera3d, corpo, dt);
  estado.personagem.atualizar(corpo);
  estado.alvoEscalada.atualizar(corpo);

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
