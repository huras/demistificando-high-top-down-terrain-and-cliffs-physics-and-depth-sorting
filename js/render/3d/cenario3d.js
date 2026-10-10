import * as THREE from "three";
import { atualizarVisualAlvoEscalada } from "../alvoEscalada.js";
import { usarTiles } from "../atlas.js";
import { ALTURA_BLOCO, ASA_DELTA_DESCIDA, CAMERA3D_DIST_MAX, CHUNK_XZ, RAIO_STREAM } from "../../config.js";
import { obterRaioStream } from "../../mundo/voxel/storeMundo.js";
import { criarTerrenoSuave, obterRaioSuave } from "./terrenoSuave.js";
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
import { criarVegetacaoBillboard3d } from "./vegetacaoBillboard3d.js";
import { criarVentoAsa3d } from "./ventoAsa3d.js";
import { criarMarcadorHover3d } from "../hoverTile.js";
import { criarCeu } from "./ceu/ceu.js";

let estado = null;

/** Nevoeiro calibrado no raio 5 (disco de ~80 blocos). */
const NEVOA_NEAR = 36;
const NEVOA_FAR = 85;

function aplicarNevoa(raio) {
  if (!estado?.scene.fog) return;
  const escala = Math.max(raio, obterRaioSuave(), 1) / RAIO_STREAM;
  estado.nevoaBase.near = NEVOA_NEAR * escala;
  estado.nevoaBase.far = NEVOA_FAR * escala;
  const fog = estado.scene.fog;
  fog.near = estado.nevoaBase.near;
  fog.far = estado.nevoaBase.far;
  const cam = estado.camera3d.cam;
  const farCam = Math.max(200, fog.far + CAMERA3D_DIST_MAX + CHUNK_XZ);
  if (cam.far !== farCam) {
    cam.far = farCam;
    cam.updateProjectionMatrix();
  }
}

/**
 * Inicializa cena Three.js uma vez (fica quente entre toggles).
 * @param {HTMLCanvasElement} canvas
 * @param {object} [atlas]
 */
export function iniciarCenario3d(canvas, atlas = null) {
  if (estado?.pronto) {
    if (atlas) aplicarAtlasNaCena(atlas);
    return estado;
  }

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
  renderer.toneMappingExposure = 1.12;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1512);
  scene.fog = new THREE.Fog(0x2a221c, 36, 85);

  const camera3d = criarCamera3d(largura / altura);

  const hemi = new THREE.HemisphereLight(0xf5e6c8, 0x292524, 0.35);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xc4b5a5, 0.32);
  scene.add(ambient);

  const sol = new THREE.DirectionalLight(0xffe4c4, 1.55);
  sol.position.set(28, 42, 18);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  sol.shadow.camera.near = 2;
  sol.shadow.camera.far = 90;
  sol.shadow.camera.left = -18;
  sol.shadow.camera.right = 18;
  sol.shadow.camera.top = 18;
  sol.shadow.camera.bottom = -18;
  sol.shadow.bias = -0.0003;
  sol.shadow.normalBias = 0.04;
  scene.add(sol);
  scene.add(sol.target);

  const fill = new THREE.DirectionalLight(0x9db4c8, 0.42);
  fill.position.set(-20, 12, -10);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xf0a060, 0.58);
  rim.position.set(2, 8, -18);
  scene.add(rim);

  const terreno = criarTerrenoMalha(atlas);
  scene.add(terreno.grupo);

  const terrenoSuave = criarTerrenoSuave();
  terreno.grupo.add(terrenoSuave.mesh);
  terrenoSuave.aplicarTexturas(terreno.obterTexturasTopo?.());

  const vegetacao = criarVegetacaoBillboard3d();
  scene.add(vegetacao.grupo);

  const personagem = criarPersonagem3d({
    nome: "personagem",
    sprite: atlas?.jogador ?? null,
  });
  scene.add(personagem.grupo);

  const agente3d = criarPersonagem3d({
    nome: "agente",
    sprite: atlas?.jogador ?? null,
    tint: 0x5ec8e8,
  });
  scene.add(agente3d.grupo);

  const ventoAsa = criarVentoAsa3d();
  scene.add(ventoAsa.objeto);

  const alvoEscalada = criarMarcadorAlvoEscalada();
  scene.add(alvoEscalada.mesh);

  const hoverTile = criarMarcadorHover3d(THREE);
  scene.add(hoverTile.mesh);

  const ceu = criarCeu({ scene, renderer, sol, hemi, ambient, fill, rim });

  estado = {
    canvas,
    renderer,
    scene,
    camera3d,
    sol,
    rim,
    terreno,
    terrenoSuave,
    vegetacao,
    personagem,
    agente3d,
    ventoAsa,
    alvoEscalada,
    hoverTile,
    ceu,
    nevoaBase: { near: NEVOA_NEAR, far: NEVOA_FAR },
    _alvoCeu: new THREE.Vector3(),
    pronto: true,
    distanciaNormalizada: () => distanciaNormalizada(camera3d),
    yaw: () => yawCamera(camera3d),
  };

  if (atlas) aplicarAtlasNaCena(atlas);

  return estado;
}

function aplicarAtlasNaCena(atlas) {
  if (!estado) return;
  estado.terreno.aplicarAtlas?.(atlas);
  estado.terrenoSuave?.aplicarTexturas?.(estado.terreno.obterTexturasTopo?.());
  estado.vegetacao?.aplicarAtlas?.(atlas);
  estado.personagem.definirSprite?.(atlas?.jogador ?? null);
  estado.agente3d.definirSprite?.(atlas?.jogador ?? null);
  const tiles = usarTiles(atlas);
  estado.terreno.aplicarVisual(tiles);
  estado.terrenoSuave?.aplicarVisual?.(tiles);
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
      mesh.position.set(alvo.x, (alvo.vz ?? alvo.z) * ALTURA_BLOCO + 0.04, alvo.y);
    },
  };
}

export function obterCenario3d() {
  return estado;
}

export function sincronizarVisualTerreno(atlas) {
  if (!estado) return;
  const tiles = usarTiles(atlas);
  estado.terreno.aplicarVisual(tiles);
  estado.terrenoSuave?.aplicarVisual?.(tiles);
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
  aplicarNevoa(obterRaioStream());
  estado.terreno.tickMalha?.(corpo.x, corpo.y);
  estado.terrenoSuave?.tick(corpo.x, corpo.y, estado.terreno.chunksExibidos?.());
  estado.terreno.aplicarAnel?.(corpo.x, corpo.y, !!estado.terrenoSuave?.visivel?.());
  seguirAlvo3d(estado.camera3d, corpo, dt);

  const yaw = yawCamera(estado.camera3d);
  estado.vegetacao?.atualizar?.(yaw);
  estado.personagem.atualizar(corpo, estado.camera3d.cam, yaw);
  if (agente && estado.agente3d) {
    estado.agente3d.atualizar(agente, estado.camera3d.cam, yaw);
  }
  estado.alvoEscalada.atualizar(corpo, dt);
  estado.hoverTile?.atualizar();

  const elev = corpo.elevacao ?? corpo.z ?? 0;
  const elevVis = elev * ALTURA_BLOCO;
  const planando = !!corpo.planando;
  const voando = !!corpo.voando;
  estado.ventoAsa.atualizar(dt, {
    gliding: planando || voando,
    x: corpo.x,
    y: corpo.y,
    elev,
    vx: corpo.vx ?? 0,
    vy: corpo.vy ?? 0,
    fx: corpo.dirX ?? 0,
    fy: corpo.dirY ?? 1,
    queda: planando ? ASA_DELTA_DESCIDA : voando ? 2.5 : 0,
    lift: Math.max(0, elev - (corpo.z ?? 0)),
  });

  estado._alvoCeu.set(corpo.x, elevVis, corpo.y);
  estado.ceu.atualizar(dt, {
    camera: estado.camera3d.cam,
    alvo: estado._alvoCeu,
    nevoa: estado.nevoaBase,
  });

  estado.renderer.render(estado.scene, estado.camera3d.cam);
  return estado;
}

export function redimensionarCenario3d(w, h) {
  if (!estado) return;
  estado.renderer.setSize(w, h, false);
  estado.camera3d.cam.aspect = w / h;
  estado.camera3d.cam.updateProjectionMatrix();
}
