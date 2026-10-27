import * as THREE from "three";
import { atualizarVisualAlvoEscalada } from "../alvoEscalada.js";
import { usarTiles } from "../atlas.js";
import { ALTURA_BLOCO, ASA_DELTA_DESCIDA, BILLBOARD_INCLINACAO, CAMERA3D_DIST_MAX, CHUNK_XZ, RAIO_STREAM } from "../../config.js";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { medidasSala } from "../../mundo/cidade/sala3d.js";
import { obterRaioStream } from "../../mundo/voxel/storeMundo.js";
import { criarTerrenoSuave, obterRaioSuave } from "./terrenoSuave.js";
import { criarTerrenoHorizonte, obterRaioHorizonte } from "./terrenoHorizonte.js";
import {
  ajustarDistancia,
  aplicarFacingMira,
  aplicarOlharMouse,
  criarCamera3d,
  definirModoCamera,
  distanciaNormalizada,
  seguirAlvo3d,
  yawCamera,
  yawDeCameraThree,
} from "./camera3d.js";
import { criarFlechas3d } from "./flechas3d.js";
import { criarMiraArcoBola3d } from "./miraArcoBola3d.js";
import { criarRigCamera3d } from "./rigCamera3d.js";
import { bolaNaMao, cargaRanged, rangedCarregando } from "../../jogo/ranged.js";
import { obterMiraCursor } from "../../pokemon/captura.js";
import { botaoDireitoSegurado } from "../../entrada/ponteiro3d.js";
import {
  alfaSprites,
  definirChecagemMalhaTeleporte,
  focoStreaming,
} from "../../jogo/teleporte.js";
import { criarPersonagem3d } from "./personagem3d.js";
import { atualizarTeleporte3d, criarTeleporte3d } from "./teleporte3d.js";
import { criarPalhaLar3d } from "./palhaLar3d.js";
import { criarTerrenoMalha } from "./terrenoMalha.js";
import { criarEdificiosCidade } from "./edificiosCidade.js";
import { criarDebugVaosPorta } from "./debugVaosPorta.js";
import { atualizarDebugCorpos, criarDebugCorpos } from "./debugCorpos.js";
import { criarDebugCasas } from "./debugCasas.js";
import { criarVegetacaoBillboard3d } from "./vegetacaoBillboard3d.js";
import { criarVegetacaoDistante } from "./vegetacaoDistante.js";
import { criarVegetacaoHorizonte } from "./vegetacaoHorizonte.js";
import { atualizarVentoVeg } from "./vegetacao/ventoVeg.js";
import { criarCidadeHorizonte } from "./cidadeHorizonte.js";
import { criarFxCampo } from "../../campo/fx.js";
import { criarPoeiraPasso3d } from "./poeiraPasso3d.js";
import { criarFxBola3d } from "./fxBola3d.js";
import { criarFxAgua3d } from "./fxAgua3d.js";
import { criarLetrasPlaza3d } from "./letrasPlaza3d.js";
import { criarLetrasArcos3d } from "./letrasArcos3d.js";
import { criarVentoAsa3d } from "./ventoAsa3d.js";
import { criarMarcadorHover3d } from "../hoverTile.js";
import { criarElipsesSelecaoPokemon } from "./elipseSelecaoPokemon.js";
import { criarCeu } from "./ceu/ceu.js";
import { tickClima } from "../../clima/amostra.js";
import { ligarRendererSombra } from "./ceu/sombraEstavel.js";
import { desenharReflexo, marcarLuzReflexo } from "./ceu/reflexoPoca.js";
import { atualizarLuzBillboard } from "./ceu/luzBillboard.js";
import { comecarQuadroLuzes, criarPoolLuzes, definirPesoNoite, resolverLuzes } from "./luzes/pool.js";
import { comecarMapaChao, resolverMapaChao } from "./luzes/mapaChao.js";
import { oferecerLuzesTotemSantuario } from "../../santuario/luzTotem.js";
import { resolverMascaraAguaPoca } from "./ceu/mascaraAguaPoca.js";
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
import { ligarNpc3d, listarNpcsVisiveis, sincronizarNpc3d } from "../../npc/index.js";

let estado = null;
let domoNoVazio = false;

/** Nevoeiro calibrado no raio 5 (disco de ~80 blocos). */
const NEVOA_NEAR = 36;
const NEVOA_FAR = 85;

function aplicarNevoa(raio) {
  if (!estado?.scene.fog) return;
  // Near segue o detalhe perto; far abre com o horizonte terraced.
  const escalaNear = Math.max(raio, obterRaioSuave(), 1) / RAIO_STREAM;
  const escalaFar = Math.max(raio, obterRaioSuave(), obterRaioHorizonte(), 1) / RAIO_STREAM;
  estado.nevoaBase.near = NEVOA_NEAR * escalaNear;
  estado.nevoaBase.far = NEVOA_FAR * escalaFar;
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
  marcarLuzReflexo(luz);
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

/**
 * Dentro, o ciclo do céu não entra.
 * Casa/lab: lâmpada fixa no teto da sala authored.
 * Santuário: a dungeon é voxel — luz segue o jogador no bolso.
 */
function ligarLuzSala(dentro, corpo = null) {
  const lamp = estado.luzSala;
  if (!lamp) return;
  lamp.luz.intensity = dentro ? 4 : 0;
  lamp.bulbo.visible = dentro;
  if (!dentro) return;

  definirPesoNoite(0);
  uniformsNuvem.uForcaSombra.value = 0;

  const ehSantuario = estadoJogo.interior?.papel === "santuario";
  const chaoY = ALTURA_PRACA * ALTURA_BLOCO;
  let lx = lamp.x;
  let ly = lamp.y;
  let lz = lamp.z;
  if (ehSantuario && corpo) {
    lx = corpo.x;
    lz = corpo.y;
    ly = chaoY + 4.2;
    lamp.luz.intensity = 3.2;
    lamp.luz.distance = 28;
    lamp.luz.decay = 1.6;
  } else {
    lamp.luz.distance = 18;
    lamp.luz.decay = 2;
  }
  lamp.luz.position.set(lx, ly, lz);
  lamp.bulbo.position.set(lx, ly, lz);

  const { sol, hemi, ambient, fill, rim } = estado;
  if (ehSantuario) {
    sol.color.set(0xd8e4ff);
    sol.intensity = 0.55;
    hemi.color.set(0xc8d4f0);
    hemi.groundColor.set(0x2a2438);
    hemi.intensity = 0.55;
    ambient.color.set(0xb8c4e0);
    ambient.intensity = 0.42;
    fill.color.set(0xa8b8e8);
    fill.intensity = 0.22;
    estado.renderer.toneMappingExposure = 1.0;
  } else {
    sol.color.set(0xfff4e4);
    sol.intensity = 0.95;
    hemi.color.set(0xfff7ee);
    hemi.groundColor.set(0xe8d2b2);
    hemi.intensity = 0.7;
    ambient.color.set(0xfff3e6);
    ambient.intensity = 0.58;
    fill.color.set(0xffe7c8);
    fill.intensity = 0.28;
    estado.renderer.toneMappingExposure = 1.06;
  }
  sol.castShadow = false;
  sol.position.set(lx, ly + 14, lz);
  sol.target.position.set(lx, chaoY, lz);
  fill.position.set(lx - 8, ly, lz + 5);
  fill.target.position.set(lx, chaoY, lz);
  rim.intensity = 0;
  atualizarLuzBillboard({ sol, ambient, hemi, fill, rim });
}

/**
 * Dentro da sala 3D o overworld some.
 * Casa/lab: some o terreno (a sala authored fica sozinha no preto).
 * Santuário: o dungeon É o terreno voxel — mantém cubos/real.
 */
function aplicarVazioSala(dentro) {
  const cena = estado.scene;
  const domo = cena.getObjectByName("ceu-domo");
  const terreno = estado.terreno.grupo;
  const agua = terreno.getObjectByName("terreno-agua");
  if (!dentro) {
    if (agua) agua.visible = true;
    if (estado.terrenoSuave?.mesh) estado.terrenoSuave.mesh.visible = true;
    if (estado.terrenoHorizonte?.mesh) estado.terrenoHorizonte.mesh.visible = true;
    if (estado.letrasPlaza?.grupo) estado.letrasPlaza.grupo.visible = true;
    if (estado.letrasArcos?.grupo) estado.letrasArcos.grupo.visible = true;
    if (domoNoVazio && domo) domo.visible = true;
    domoNoVazio = false;
    return;
  }
  const ehSantuario = estadoJogo.interior?.papel === "santuario";
  const cubos = terreno.getObjectByName("terreno-cubos");
  const real = terreno.getObjectByName("terreno-real");
  // Só esconde o heightfield outdoor; no santuário a malha voxel é a cena.
  if (!ehSantuario) {
    if (cubos) cubos.visible = false;
    if (real) real.visible = false;
  }
  if (agua) agua.visible = false;
  if (estado.terrenoSuave?.mesh) estado.terrenoSuave.mesh.visible = false;
  if (estado.terrenoHorizonte?.mesh) estado.terrenoHorizonte.mesh.visible = false;
  if (estado.vegetacao?.grupo) estado.vegetacao.grupo.visible = false;
  if (estado.vegetacaoDistante?.grupo) estado.vegetacaoDistante.grupo.visible = false;
  if (estado.vegetacaoHorizonte?.grupo) estado.vegetacaoHorizonte.grupo.visible = false;
  if (estado.cidadeHorizonte?.grupo) estado.cidadeHorizonte.grupo.visible = false;
  if (estado.letrasPlaza?.grupo) estado.letrasPlaza.grupo.visible = false;
  if (estado.letrasArcos?.grupo) estado.letrasArcos.grupo.visible = false;
  if (domo) {
    domo.visible = false;
    domoNoVazio = true;
  }
  const chuva = cena.getObjectByName("ceu-precipitacao");
  const raio = cena.getObjectByName("ceu-relampago");
  if (chuva) chuva.visible = false;
  if (raio) raio.visible = false;
  if (ehSantuario) {
    cena.background.set(0x0a0c14);
    if (cena.fog) {
      cena.fog.color.set(0x0a0c14);
      cena.fog.near = 14;
      cena.fog.far = 48;
    }
  } else {
    cena.background.set(0x000000);
    if (cena.fog) {
      cena.fog.color.set(0x000000);
      cena.fog.near = 500;
      cena.fog.far = 900;
    }
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
  ligarRendererSombra(renderer);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1512);
  scene.fog = new THREE.Fog(0x2a221c, 36, 85);
  ligarPokemon3d(scene);
  ligarNpc3d(scene);
  criarPoolLuzes(scene);

  const camera3d = criarCamera3d(largura / altura);
  verCamadaAuxiliar(camera3d.cam);

  const hemi = new THREE.HemisphereLight(0xf5e6c8, 0x292524, 0.35);
  hemi.name = "luz-ceu";
  marcarLuzReflexo(hemi);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xc4b5a5, 0.32);
  ambient.name = "luz-ambiente";
  marcarLuzReflexo(ambient);
  scene.add(ambient);

  const sol = new THREE.DirectionalLight(0xffe4c4, 1.55);
  sol.name = "luz-sol";
  marcarLuzReflexo(sol);
  sol.position.set(28, 42, 18);
  sol.castShadow = true;
  // mapSize / frustum / bias: dono é criarCeu → sombraEstavel
  scene.add(sol);
  scene.add(sol.target);

  const fill = new THREE.DirectionalLight(0x9db4c8, 0.42);
  fill.name = "luz-preenchimento";
  marcarLuzReflexo(fill);
  fill.position.set(-20, 12, -10);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xf0a060, 0.58);
  rim.name = "luz-contorno";
  marcarLuzReflexo(rim);
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

  const terrenoHorizonte = criarTerrenoHorizonte();
  terreno.grupo.add(terrenoHorizonte.mesh);
  terrenoHorizonte.aplicarTexturas?.(terreno.obterTexturasTopo?.());

  const cidadeHorizonte = criarCidadeHorizonte();
  terreno.grupo.add(cidadeHorizonte.grupo);

  const vegetacao = criarVegetacaoBillboard3d();
  scene.add(vegetacao.grupo);

  const vegetacaoDistante = criarVegetacaoDistante();
  scene.add(vegetacaoDistante.grupo);

  const vegetacaoHorizonte = criarVegetacaoHorizonte();
  scene.add(vegetacaoHorizonte.grupo);

  const fxCampo = criarFxCampo();
  scene.add(fxCampo.grupo);

  const poeiraPasso = criarPoeiraPasso3d();
  scene.add(poeiraPasso.grupo);

  const fxBola = criarFxBola3d();
  scene.add(fxBola.grupo);

  const fxAgua = criarFxAgua3d();
  scene.add(fxAgua.grupo);

  const letrasPlaza = criarLetrasPlaza3d();
  scene.add(letrasPlaza.grupo);
  const letrasArcos = criarLetrasArcos3d();
  scene.add(letrasArcos.grupo);

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
  criarTeleporte3d(scene);
  const palhaLares = criarPalhaLar3d(scene);

  const ventoAsa = criarVentoAsa3d();
  scene.add(ventoAsa.objeto);

  const alvoEscalada = criarMarcadorAlvoEscalada();
  alvoEscalada.mesh.name = "alvo-escalada";
  scene.add(alvoEscalada.mesh);

  const hoverTile = criarMarcadorHover3d(THREE);
  hoverTile.mesh.name = "hover-bloco";
  scene.add(hoverTile.mesh);

  const elipsePokemon = criarElipsesSelecaoPokemon(scene, { canvas });

  const ceu = criarCeu({ scene, renderer, sol, hemi, ambient, fill, rim });
  const luzSala = criarLuzSala(scene);
  verCamadaAuxiliar(sol.shadow.camera);

  const rig = criarRigCamera3d();
  scene.add(rig.grupo);

  const flechas = criarFlechas3d();
  scene.add(flechas.grupo);
  const miraArcoBola = criarMiraArcoBola3d();
  scene.add(miraArcoBola.grupo);

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
    terrenoHorizonte,
    cidadeHorizonte,
    edificios,
    vegetacao,
    vegetacaoDistante,
    vegetacaoHorizonte,
    fxCampo,
    poeiraPasso,
    fxBola,
    fxAgua,
    letrasPlaza,
    letrasArcos,
    palhaLares,
    personagem,
    agente3d,
    ventoAsa,
    alvoEscalada,
    hoverTile,
    elipsePokemon,
    ceu,
    rig,
    flechas,
    miraArcoBola,
    nevoaBase: { near: NEVOA_NEAR, far: NEVOA_FAR },
    _alvoCeu: new THREE.Vector3(),
    pronto: true,
    distanciaNormalizada: () => distanciaNormalizada(camera3d),
    yaw: () => yawCamera(camera3d),
  };

  definirChecagemMalhaTeleporte((x, y) => !!terreno.mioloMalhaPronto?.(x, y, 2));

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

  // Quando a cidade termina de montar (async), recompila na última posição aquecida.
  // No boot o principal já espera quandoPronto + aquecer; isto cobre troca tardia 2D→3D.
  edificios.quandoPronto?.then?.(() =>
    aquecerProgramas3d(estado?._warmPx ?? 0, estado?._warmPy ?? 0),
  );

  return estado;
}

/**
 * Compila programas WebGL fora do loop. O 1º renderer.render sem isso
 * chega a ~700–1000 ms (shader compile) e derruba o FPS no começo.
 * Pós-reboot a GPU recompila do zero — use await no boot.
 */
export async function aquecerProgramas3d(px = 0, py = 0) {
  if (!estado?.renderer || !estado?.scene || !estado?.camera3d?.cam) return;
  try {
    estado._warmPx = px;
    estado._warmPy = py;
    estado.terreno?.tickMalha?.(px, py);
    estado.terrenoSuave?.tick?.(px, py, estado.terreno?.chunksExibidos?.());
    estado.edificios?.atualizar?.(px, py, 0, 0);
    estado.cidadeHorizonte?.tick?.(px, py);
    estado.vegetacao?.atualizar?.(0, 0);
    estado.vegetacaoDistante?.tick?.(px, py, 0, 0);
    estado.vegetacaoHorizonte?.tick?.(px, py, 0, 0);
    estado.palhaLares?.atualizar?.(px, py);
    estado.ceu?.atualizar?.(0, {
      camera: estado.camera3d.cam,
      alvo: estado._alvoCeu?.set(px, 0, py) || undefined,
      nevoa: estado.nevoaBase,
      raioBlocos: obterRaioStream() * CHUNK_XZ,
      galeLigado: true,
    });
    const renderer = estado.renderer;
    const cena = estado.scene;
    const cam = estado.camera3d.cam;
    if (typeof renderer.compileAsync === "function") {
      await renderer.compileAsync(cena, cam);
    } else {
      renderer.compile(cena, cam);
    }
  } catch (err) {
    console.warn("aquecerProgramas3d", err);
  }
}

/** Resolve quando OBJs/sprites da cidade entraram na cena (ou se já prontos). */
export function aguardarEdificios3d() {
  return estado?.edificios?.quandoPronto ?? Promise.resolve();
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
  if (refs.miraArcoBola?.grupo) marcar(refs.miraArcoBola.grupo, "Marcadores", "mira-arco-bola");
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
  estado.terrenoHorizonte?.aplicarTexturas?.(estado.terreno.obterTexturasTopo?.());
  estado.vegetacao?.aplicarAtlas?.(atlas);
  estado.vegetacaoDistante?.aplicarAtlas?.(atlas);
  estado.vegetacaoHorizonte?.aplicarAtlas?.(atlas);
  estado.fxCampo?.aplicarAtlas?.(atlas);
  estado.personagem.definirSprite?.(atlas?.jogador ?? null);
  estado.agente3d.definirSprite?.(atlas?.jogador ?? null);
  const tiles = usarTiles(atlas);
  estado.terreno.aplicarVisual(tiles);
  estado.terrenoSuave?.aplicarVisual?.(tiles);
  estado.terrenoHorizonte?.aplicarVisual?.(tiles);
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
  estado.terrenoHorizonte?.aplicarVisual?.(tiles);
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

/**
 * Atualiza câmera/personagem e renderiza um frame.
 */
export function atualizarEDesenhar3d(corpo, dt, atlas, agente = null) {
  if (!estado) return null;

  sincronizarVisualTerreno(atlas);
  aplicarNevoa(obterRaioStream());
  marcarCorposCrista(corpo, agente, atoresVisiveis());
  const foco = focoStreaming();
  const ancora = estadoJogo.interior;
  const mxMalha = foco?.x ?? corpo.x;
  const myMalha = foco?.y ?? corpo.y;
  // LOD outdoor fica pinado na porta enquanto o corpo está no bolso.
  const mxLod =
    foco?.x ??
    (Number.isFinite(ancora?.outdoorX) ? ancora.outdoorX : corpo.x);
  const myLod =
    foco?.y ??
    (Number.isFinite(ancora?.outdoorY) ? ancora.outdoorY : corpo.y);
  estado.terreno.tickMalha?.(mxMalha, myMalha);
  comecarQuadroLuzes();
  comecarMapaChao();
  estado.terrenoSuave?.tick(mxLod, myLod, estado.terreno.chunksExibidos?.());
  estado.terrenoHorizonte?.tick(mxLod, myLod);
  estado.cidadeHorizonte?.tick?.(mxLod, myLod);
  seguirAlvo3d(estado.camera3d, corpo, dt);
  aplicarFacingMira(corpo, estado.camera3d);
  estado.rig?.atualizar(estado.camera3d);
  estado.flechas?.atualizar(dt, corpo, estado.camera3d);
  estado.miraArcoBola?.atualizar(corpo, estado.camera3d, {
    ativo: bolaNaMao(),
    // Arco na mira E no hipfire enquanto carrega (top-down precisa ver a queda).
    mostrar: botaoDireitoSegurado() || rangedCarregando() || cargaRanged() > 0.02,
    carga: cargaRanged(),
    mira: obterMiraCursor(),
  });

  const elev = corpo.elevacao ?? corpo.z ?? 0;
  const elevVis = elev * ALTURA_BLOCO;
  estado._alvoCeu.set(corpo.x, elevVis, corpo.y);

  const emCena = estaEmCena();
  const camRender = emCena ? obterCameraCena() : estado.camera3d.cam;
  estado.camRender = camRender;
  if (emCena) atualizarCameraCena(dt);
  const yaw = emCena ? yawDaCamera(camRender) : yawCamera(estado.camera3d);

  const interior = !!estadoJogo.interior?.sala3d;
  tickClima(dt, { x: corpo.x, y: corpo.y, interior });
  atualizarVentoVeg(dt);
  estado.ceu.atualizar(dt, {
    camera: camRender,
    alvo: estado._alvoCeu,
    nevoa: estado.nevoaBase,
    raioBlocos: obterRaioStream() * CHUNK_XZ,
    galeLigado: !interior && !emCena,
  });
  ligarLuzSala(interior, corpo);

  // Mira e teleporte: sprites em pé (blend→1), como no arco.
  const blendBb = Math.max(estado.camera3d.blend ?? 0, estado.camera3d.folgaTeleporte ?? 0);
  const inclinacao = BILLBOARD_INCLINACAO * (1 - blendBb);
  estado.edificios?.atualizar?.(mxLod, myLod, yaw, inclinacao);
  estado.vegetacao?.atualizar?.(yaw, inclinacao);
  estado.vegetacaoDistante?.tick?.(mxLod, myLod, yaw, inclinacao);
  estado.vegetacaoHorizonte?.tick?.(mxLod, myLod, yaw, inclinacao);
  estado.palhaLares?.atualizar?.(mxLod, myLod);
  estado.fxCampo?.atualizar?.(yaw, inclinacao, dt);
  estado.poeiraPasso?.atualizar?.();
  estado.fxBola?.atualizar?.(camRender);
  estado.fxAgua?.atualizar?.(camRender);
  estado.letrasPlaza?.atualizar?.(corpo.x, corpo.y);
  estado.letrasArcos?.atualizar?.(corpo);
  anotarEstadoSim(estado.personagem.grupo, corpo);
  estado.personagem.atualizar(corpo, camRender, yaw, inclinacao);
  if (agente && estado.agente3d) {
    anotarEstadoSim(estado.agente3d.grupo, agente);
    estado.agente3d.atualizar(agente, camRender, yaw, inclinacao);
  }
  const sumico = alfaSprites();
  estado.personagem.definirSumico(sumico);
  estado.agente3d?.definirSumico(sumico);
  atualizarTeleporte3d(camRender);
  estado.alvoEscalada.atualizar(corpo, dt);
  estado.hoverTile?.atualizar();
  estado.elipsePokemon?.atualizar(camRender);
  sincronizarNpc3d(listarNpcsVisiveis(), yaw, inclinacao);

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

  atualizarPokemon3d(yaw, camRender, inclinacao);
  atualizarDebugCorpos();
  const camPos = estado.camera3d.cam.position;
  oferecerLuzesTotemSantuario(camPos.x, camPos.z, { interior });
  resolverLuzes(camPos.x, camPos.y, camPos.z, estado.scene.fog?.far ?? 90);
  resolverMapaChao(camPos.x, camPos.z);
  resolverMascaraAguaPoca(camPos.x, camPos.z);
  atualizarRealceCena();
  aplicarVazioSala(!!estadoJogo.interior?.sala3d);
  // Plano do espelho = chão sob os pés (não elevacao/hop).
  const chaoVis = (corpo.z ?? 0) * ALTURA_BLOCO;
  // Só atores no re-pose: vegetação/edifício reescrevem milhares de instâncias 2×/frame.
  desenharReflexo(estado.renderer, estado.scene, camRender, chaoVis, !!estadoJogo.interior?.sala3d, {
    jogador: { x: corpo.x, y: corpo.y },
    prepararBillboards(camVirtual) {
      const yawVirt = yawDeCameraThree(camVirtual);
      const inclReflexo = 0;
      estado.personagem.atualizar(corpo, camVirtual, yawVirt, inclReflexo);
      if (agente && estado.agente3d) {
        estado.agente3d.atualizar(agente, camVirtual, yawVirt, inclReflexo);
      }
      atualizarPokemon3d(yawVirt, camVirtual, inclReflexo, { contribuirChao: false });
    },
    restaurarBillboards() {
      estado.personagem.atualizar(corpo, camRender, yaw, inclinacao);
      if (agente && estado.agente3d) {
        estado.agente3d.atualizar(agente, camRender, yaw, inclinacao);
      }
      atualizarPokemon3d(yaw, camRender, inclinacao, { contribuirChao: false });
    },
  });
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
