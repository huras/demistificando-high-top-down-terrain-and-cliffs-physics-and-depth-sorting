import * as THREE from "three";
import { atualizarVisualAlvoEscalada } from "../alvoEscalada.js";
import { usarTiles } from "../atlas.js";
import { ALTURA_BLOCO, ASA_DELTA_DESCIDA, BILLBOARD_INCLINACAO, CAMERA3D_DIST_MAX, CHUNK_XZ, RAIO_STREAM } from "../../config.js";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { medidasSala } from "../../mundo/cidade/sala3d.js";
import { obterRaioStream } from "../../mundo/voxel/storeMundo.js";
import { criarTerrenoSuave, obterRaioSuave } from "./terrenoSuave.js";
import {
  ajustarDistancia,
  aplicarFacingMira,
  aplicarOlharMouse,
  criarCamera3d,
  definirModoCamera,
  distanciaNormalizada,
  seguirAlvo3d,
  yawCamera,
} from "./camera3d.js";
import { criarFlechas3d } from "./flechas3d.js";
import { criarRigCamera3d } from "./rigCamera3d.js";
import { criarPersonagem3d } from "./personagem3d.js";
import { criarTerrenoMalha } from "./terrenoMalha.js";
import { criarEdificiosCidade } from "./edificiosCidade.js";
import { criarDebugVaosPorta } from "./debugVaosPorta.js";
import { atualizarDebugCorpos, criarDebugCorpos } from "./debugCorpos.js";
import { criarDebugCasas } from "./debugCasas.js";
import { criarVegetacaoBillboard3d } from "./vegetacaoBillboard3d.js";
import { criarVegetacaoDistante } from "./vegetacaoDistante.js";
import { criarFxCampo } from "../../campo/fx.js";
import { criarPoeiraPasso3d } from "./poeiraPasso3d.js";
import { criarFxBola3d } from "./fxBola3d.js";
import { criarFxAgua3d } from "./fxAgua3d.js";
import { criarVentoAsa3d } from "./ventoAsa3d.js";
import { criarMarcadorHover3d } from "../hoverTile.js";
import { criarCeu } from "./ceu/ceu.js";
import { atualizarLuzBillboard } from "./ceu/luzBillboard.js";
import { comecarQuadroLuzes, criarPoolLuzes, definirPesoNoite, resolverLuzes } from "./luzes/pool.js";
import { comecarMapaChao, resolverMapaChao } from "./luzes/mapaChao.js";
import { uniformsNuvem } from "./ceu/parametros.js";
import { estaEmCena } from "../../cena/modoCena.js";
import {
  atualizarCameraCena,
  entrarCameraCena,
  ligarCameraCena,
  obterCameraCena,
  redimensionarCameraCena,
  sincronizarFarCena,
  yawDaCamera,
} from "../../cena/cameraCena.js";
import { registrarObjetoCena, verCamadaAuxiliar } from "../../cena/registroCena.js";
import { atualizarRealceCena, ligarSelecaoCena } from "../../cena/selecaoCena.js";
import { atualizarPokemon3d, ligarPokemon3d } from "../../pokemon/render3d.js";
import { atoresVisiveis } from "../../pokemon/sistema.js";
import { marcarCorposCrista } from "./texturasAgua3d.js";
import { estado as estadoJogo } from "../../jogo/estado.js";

let estado = null;
const puxada = { segurando: false, soltou: false };
let domoNoVazio = false;

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
  sincronizarFarCena(farCam);
}

function criarLuzSala(cena) {
  const m = medidasSala();
  const x = (m.chaoX0 + m.chaoX1) * 0.5;
  const z = (m.chaoY0 + m.chaoY1) * 0.5;
  const y = ALTURA_PRACA * ALTURA_BLOCO + m.alturaParede * ALTURA_BLOCO * 0.82;
  const luz = new THREE.PointLight(0xfff1d4, 0, 18, 2);
  luz.name = "luz-sala";
  luz.position.set(x, y, z);
  luz.castShadow = false;
  cena.add(luz);

  const bulbo = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff6df, toneMapped: false }),
  );
  bulbo.name = "lampada-sala";
  bulbo.position.copy(luz.position);
  bulbo.visible = false;
  cena.add(bulbo);
  return { luz, bulbo, x, y, z };
}

/** Dentro, o ciclo do céu não entra: a sala fica clara por igual, com a lâmpada parada no teto. */
function ligarLuzSala(dentro) {
  const lamp = estado.luzSala;
  if (!lamp) return;
  lamp.luz.intensity = dentro ? 4 : 0;
  lamp.bulbo.visible = dentro;
  if (!dentro) return;

  definirPesoNoite(0);
  uniformsNuvem.uForcaSombra.value = 0;

  const chaoY = ALTURA_PRACA * ALTURA_BLOCO;
  const { sol, hemi, ambient, fill, rim } = estado;
  sol.color.set(0xfff4e4);
  sol.intensity = 0.95;
  sol.castShadow = false;
  sol.position.set(lamp.x, lamp.y + 14, lamp.z);
  sol.target.position.set(lamp.x, chaoY, lamp.z);

  hemi.color.set(0xfff7ee);
  hemi.groundColor.set(0xe8d2b2);
  hemi.intensity = 0.7;

  ambient.color.set(0xfff3e6);
  ambient.intensity = 0.58;

  fill.color.set(0xffe7c8);
  fill.intensity = 0.28;
  fill.position.set(lamp.x - 8, lamp.y, lamp.z + 5);
  fill.target.position.set(lamp.x, chaoY, lamp.z);

  rim.intensity = 0;
  estado.renderer.toneMappingExposure = 1.06;
  atualizarLuzBillboard({ sol, ambient, hemi, fill, rim });
}

/** Dentro da sala 3D o mapa some: sobra a sala e o preto. */
function aplicarVazioSala(dentro) {
  const cena = estado.scene;
  const domo = cena.getObjectByName("ceu-domo");
  const terreno = estado.terreno.grupo;
  const agua = terreno.getObjectByName("terreno-agua");
  if (!dentro) {
    if (agua) agua.visible = true;
    if (estado.terrenoSuave?.mesh) estado.terrenoSuave.mesh.visible = true;
    if (domoNoVazio && domo) domo.visible = true;
    domoNoVazio = false;
    return;
  }
  const cubos = terreno.getObjectByName("terreno-cubos");
  const real = terreno.getObjectByName("terreno-real");
  if (cubos) cubos.visible = false;
  if (real) real.visible = false;
  if (agua) agua.visible = false;
  if (estado.terrenoSuave?.mesh) estado.terrenoSuave.mesh.visible = false;
  if (estado.vegetacao?.grupo) estado.vegetacao.grupo.visible = false;
  if (estado.vegetacaoDistante?.grupo) estado.vegetacaoDistante.grupo.visible = false;
  if (domo) {
    domo.visible = false;
    domoNoVazio = true;
  }
  const chuva = cena.getObjectByName("ceu-precipitacao");
  const raio = cena.getObjectByName("ceu-relampago");
  if (chuva) chuva.visible = false;
  if (raio) raio.visible = false;
  cena.background.set(0x000000);
  if (cena.fog) {
    cena.fog.color.set(0x000000);
    cena.fog.near = 500;
    cena.fog.far = 900;
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
    stencil: true,
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
  ligarPokemon3d(scene);
  criarPoolLuzes(scene);

  const camera3d = criarCamera3d(largura / altura);
  verCamadaAuxiliar(camera3d.cam);

  const hemi = new THREE.HemisphereLight(0xf5e6c8, 0x292524, 0.35);
  hemi.name = "luz-ceu";
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xc4b5a5, 0.32);
  ambient.name = "luz-ambiente";
  scene.add(ambient);

  const sol = new THREE.DirectionalLight(0xffe4c4, 1.55);
  sol.name = "luz-sol";
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
  fill.name = "luz-preenchimento";
  fill.position.set(-20, 12, -10);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xf0a060, 0.58);
  rim.name = "luz-contorno";
  rim.position.set(2, 8, -18);
  scene.add(rim);

  const terreno = criarTerrenoMalha(atlas);
  scene.add(terreno.grupo);

  const edificios = criarEdificiosCidade();
  terreno.grupo.add(edificios.grupo);
  scene.add(criarDebugVaosPorta());
  scene.add(criarDebugCorpos());
  scene.add(criarDebugCasas());

  const terrenoSuave = criarTerrenoSuave();
  terreno.grupo.add(terrenoSuave.mesh);
  terrenoSuave.aplicarTexturas(terreno.obterTexturasTopo?.());

  const vegetacao = criarVegetacaoBillboard3d();
  scene.add(vegetacao.grupo);

  const vegetacaoDistante = criarVegetacaoDistante();
  scene.add(vegetacaoDistante.grupo);

  const fxCampo = criarFxCampo();
  scene.add(fxCampo.grupo);

  const poeiraPasso = criarPoeiraPasso3d();
  scene.add(poeiraPasso.grupo);

  const fxBola = criarFxBola3d();
  scene.add(fxBola.grupo);

  const fxAgua = criarFxAgua3d();
  scene.add(fxAgua.grupo);

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
  alvoEscalada.mesh.name = "alvo-escalada";
  scene.add(alvoEscalada.mesh);

  const hoverTile = criarMarcadorHover3d(THREE);
  hoverTile.mesh.name = "hover-bloco";
  scene.add(hoverTile.mesh);

  const ceu = criarCeu({ scene, renderer, sol, hemi, ambient, fill, rim });
  const luzSala = criarLuzSala(scene);
  verCamadaAuxiliar(sol.shadow.camera);

  const rig = criarRigCamera3d();
  scene.add(rig.grupo);

  const flechas = criarFlechas3d();
  scene.add(flechas.grupo);

  estado = {
    canvas,
    renderer,
    scene,
    camera3d,
    sol,
    hemi,
    ambient,
    fill,
    rim,
    luzSala,
    terreno,
    terrenoSuave,
    edificios,
    vegetacao,
    vegetacaoDistante,
    fxCampo,
    poeiraPasso,
    fxBola,
    fxAgua,
    personagem,
    agente3d,
    ventoAsa,
    alvoEscalada,
    hoverTile,
    ceu,
    rig,
    flechas,
    nevoaBase: { near: NEVOA_NEAR, far: NEVOA_FAR },
    _alvoCeu: new THREE.Vector3(),
    pronto: true,
    distanciaNormalizada: () => distanciaNormalizada(camera3d),
    yaw: () => yawCamera(camera3d),
  };

  publicarObjetosCena(scene, {
    hemi,
    ambient,
    sol,
    fill,
    rim,
    personagem,
    agente3d,
    ventoAsa,
    alvoEscalada,
    hoverTile,
    rig,
    flechas,
  });
  ligarCameraCena(canvas);
  ligarSelecaoCena(scene);

  if (atlas) aplicarAtlasNaCena(atlas);

  return estado;
}

function publicarObjetosCena(scene, refs) {
  const luz = (objeto, rotulo) => registrarObjetoCena(objeto, {
    id: objeto.name,
    pasta: "Luzes",
    rotulo,
    tipo: "luz",
  });
  luz(refs.hemi, "céu");
  luz(refs.ambient, "ambiente");
  luz(refs.sol, "sol");
  luz(refs.fill, "preenchimento");
  luz(refs.rim, "contorno");

  registrarObjetoCena(refs.personagem.grupo, {
    id: "personagem",
    pasta: "Personagens",
    rotulo: "personagem",
    tipo: "personagem",
    segue: true,
  });
  registrarObjetoCena(refs.agente3d.grupo, {
    id: "agente",
    pasta: "Personagens",
    rotulo: "agente",
    tipo: "personagem",
    segue: true,
  });

  const marcar = (objeto, pasta, tipo, auxiliar = false) => {
    if (!objeto?.name) return;
    registrarObjetoCena(objeto, {
      id: objeto.name,
      pasta,
      rotulo: objeto.name,
      tipo,
      auxiliar,
    });
  };
  marcar(scene.getObjectByName("ceu-domo"), "Céu", "céu", true);
  marcar(scene.getObjectByName("ceu-precipitacao"), "Céu", "céu", true);
  marcar(scene.getObjectByName("ceu-relampago"), "Céu", "céu", true);
  marcar(refs.ventoAsa.objeto, "Marcadores", "efeito", true);
  marcar(refs.rig.grupo, "Marcadores", "gizmo", true);
  marcar(refs.alvoEscalada.mesh, "Marcadores", "marcador");
  marcar(refs.hoverTile.mesh, "Marcadores", "marcador");
  marcar(refs.flechas.grupo, "Marcadores", "flechas");
}

function anotarEstadoSim(grupo, sim) {
  if (!grupo || !sim) return;
  grupo.userData.estadoSim = {
    x: sim.x,
    y: sim.y,
    z: sim.z,
    acao: sim.acao || "",
    voando: !!sim.voando,
    escalando: !!sim.escalando,
    nadando: !!sim.nadando,
    planando: !!sim.planando,
  };
}

export function entrarVistaCena(corpo) {
  if (!estado || !corpo) return;
  const elev = (corpo.elevacao ?? corpo.z ?? 0) * ALTURA_BLOCO;
  entrarCameraCena(
    estado.camera3d.cam,
    estado._alvoCeu.set(corpo.x, elev + 1.1, corpo.y),
  );
}

function aplicarAtlasNaCena(atlas) {
  if (!estado) return;
  estado.terreno.aplicarAtlas?.(atlas);
  estado.terrenoSuave?.aplicarTexturas?.(estado.terreno.obterTexturasTopo?.());
  estado.vegetacao?.aplicarAtlas?.(atlas);
  estado.vegetacaoDistante?.aplicarAtlas?.(atlas);
  estado.fxCampo?.aplicarAtlas?.(atlas);
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

export function definirMira3d(ativa) {
  if (!estado) return;
  definirModoCamera(estado.camera3d, ativa ? "mira" : "orbita");
}

export function definirPuxadaFlecha(segurando, soltou) {
  puxada.segurando = !!segurando;
  if (soltou) puxada.soltou = true;
}

/**
 * Atualiza câmera/personagem e renderiza um frame.
 */
export function atualizarEDesenhar3d(corpo, dt, atlas, agente = null) {
  if (!estado) return null;

  sincronizarVisualTerreno(atlas);
  aplicarNevoa(obterRaioStream());
  marcarCorposCrista(corpo, agente, atoresVisiveis());
  estado.terreno.tickMalha?.(corpo.x, corpo.y);
  comecarQuadroLuzes();
  comecarMapaChao();
  estado.terrenoSuave?.tick(corpo.x, corpo.y, estado.terreno.chunksExibidos?.());
  seguirAlvo3d(estado.camera3d, corpo, dt);
  aplicarFacingMira(corpo, estado.camera3d);
  estado.rig?.atualizar(estado.camera3d);
  estado.flechas?.atualizar(dt, corpo, estado.camera3d, puxada);
  puxada.soltou = false;

  const elev = corpo.elevacao ?? corpo.z ?? 0;
  const elevVis = elev * ALTURA_BLOCO;
  estado._alvoCeu.set(corpo.x, elevVis, corpo.y);

  const emCena = estaEmCena();
  const camRender = emCena ? obterCameraCena() : estado.camera3d.cam;
  estado.camRender = camRender;
  if (emCena) atualizarCameraCena(dt);
  const yaw = emCena ? yawDaCamera(camRender) : yawCamera(estado.camera3d);

  estado.ceu.atualizar(dt, {
    camera: camRender,
    alvo: estado._alvoCeu,
    nevoa: estado.nevoaBase,
    raioBlocos: obterRaioStream() * CHUNK_XZ,
  });
  ligarLuzSala(!!estadoJogo.interior?.sala3d);

  const inclinacao = BILLBOARD_INCLINACAO * (1 - (estado.camera3d.blend ?? 0));
  estado.edificios?.atualizar?.(corpo.x, corpo.y, yaw, inclinacao);
  estado.vegetacao?.atualizar?.(yaw, inclinacao);
  estado.vegetacaoDistante?.tick?.(corpo.x, corpo.y, yaw, inclinacao);
  estado.fxCampo?.atualizar?.(yaw, inclinacao, dt);
  estado.poeiraPasso?.atualizar?.();
  estado.fxBola?.atualizar?.();
  estado.fxAgua?.atualizar?.(camRender);
  anotarEstadoSim(estado.personagem.grupo, corpo);
  estado.personagem.atualizar(corpo, camRender, yaw);
  if (agente && estado.agente3d) {
    anotarEstadoSim(estado.agente3d.grupo, agente);
    estado.agente3d.atualizar(agente, camRender, yaw);
  }
  estado.alvoEscalada.atualizar(corpo, dt);
  estado.hoverTile?.atualizar();

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
    queda: planando ? (corpo._glideQueda ?? ASA_DELTA_DESCIDA) : voando ? 2.5 : 0,
    lift: Math.max(0, elev - (corpo.z ?? 0)),
  });

  atualizarPokemon3d(yaw, camRender);
  atualizarDebugCorpos();
  const camPos = estado.camera3d.cam.position;
  resolverLuzes(camPos.x, camPos.y, camPos.z, estado.scene.fog?.far ?? 90);
  resolverMapaChao(camPos.x, camPos.z);
  atualizarRealceCena();
  aplicarVazioSala(!!estadoJogo.interior?.sala3d);
  estado.renderer.render(estado.scene, camRender);
  return estado;
}

export function redimensionarCenario3d(w, h) {
  if (!estado) return;
  estado.renderer.setSize(w, h, false);
  estado.camera3d.cam.aspect = w / h;
  estado.camera3d.cam.updateProjectionMatrix();
  redimensionarCameraCena(w, h);
}
