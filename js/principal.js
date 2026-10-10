import { CAMINHOS, CHUNK_XZ, RAIO_STREAM_MAX, RAIO_STREAM_MIN, ZOOM_PASSO } from "./config.js";
import { ligarEdicaoBlocos } from "./entrada/edicaoBlocos.js";
import { atualizarHoverBloco, ligarHoverBloco } from "./entrada/hoverBloco.js";
import {
  consumirMovimentoMouse,
  desligarPonteiro3d,
  ligarPonteiro3d,
} from "./entrada/ponteiro3d.js";
import { iniciarTeclado, teclaAgora } from "./entrada/teclado.js";
import { atualizarAgente, criarAgente, resetarNav } from "./fisica/agente.js";
import { atualizarMovimento, criarCorpo } from "./fisica/movimento.js";
import { iniciarStamina } from "./fisica/stamina.js";
import { tickFilaPath } from "./navegacao/filaPath.js";
import { CAPS_PADRAO } from "./navegacao/capacidades.js";
import { carregarCatalogo } from "./mundo/bioma/catalogo.js";
import { SPAWN } from "./mundo/mapaDemo.js";
import {
  atualizarStreaming,
  definirRaioStream,
  iniciarMundoAoRedor,
  obterRaioStream,
} from "./mundo/voxel/storeMundo.js";
import { ligarControleModo, obterModo, alternarModo, aoMudarModo } from "./modoJogo.js";
import { alternarVisual, montarAtlas, usarTiles } from "./render/atlas.js";
import { ajustarZoom, criarCamera } from "./render/camera.js";
import { desenharCena2d, desenharHudSobre3d } from "./render/renderizador2d.js";
import { ligarAjudaAtalhos } from "./ui/ajudaAtalhos.js";
import { ligarHudCompanheiro, atualizarHudCompanheiro } from "./ui/hudCompanheiro.js";
import {
  ativarInputRelativoCamera,
  desativarInputRelativoCamera,
} from "./render/3d/adaptadorInput3d.js";
import {
  ajustarZoom3d,
  atualizarEDesenhar3d,
  iniciarCenario3d,
  olharCamera3d,
  obterCenario3d,
  redimensionarCenario3d,
  resetarCamera3d,
} from "./render/3d/cenario3d.js";

const canvas = document.getElementById("canvas");
const canvas3d = document.getElementById("canvas-3d");
const viewport = document.querySelector(".palco__viewport");
const ctx = canvas.getContext("2d", { alpha: true });

let atlas;
let corpo;
let agente;
let camera;
let debug = false;
let ultimo = 0;
let cenario3dPronto = false;

function tamanhoViewport() {
  const rect = viewport?.getBoundingClientRect();
  const w = Math.max(320, Math.floor(rect?.width || window.innerWidth));
  const h = Math.max(240, Math.floor(rect?.height || window.innerHeight));
  return { w, h };
}

function redimensionarCena() {
  const { w, h } = tamanhoViewport();
  if (canvas.width === w && canvas.height === h) return;
  canvas.width = w;
  canvas.height = h;
  canvas3d.width = w;
  canvas3d.height = h;
  if (camera) {
    camera.largura = w;
    camera.altura = h;
  }
  if (cenario3dPronto) redimensionarCenario3d(w, h);
}

async function iniciar() {
  iniciarTeclado();
  redimensionarCena();
  atlas = await montarAtlas(CAMINHOS);
  window.__atlas = atlas;

  await carregarCatalogo();
  iniciarMundoAoRedor(SPAWN.x, SPAWN.y);
  // Nav só invalida em edição de bloco — streaming não deve rebuildar (era ~18s).

  corpo = criarCorpo(SPAWN);
  agente = criarAgente({
    x: SPAWN.x - 1.1,
    y: SPAWN.y + 0.9,
    z: SPAWN.z,
  });
  camera = criarCamera(canvas.width, canvas.height);
  redimensionarCena();

  ligarHudCompanheiro(agente, CAPS_PADRAO);
  ligarRaioStream();
  ligarAjudaAtalhos();
  ligarControleModo(document.getElementById("btn-modo-3d"));
  aoMudarModo(aoTrocarModo);
  sincronizarCamadas(obterModo());

  const optsPonteiro = {
    canvas2d: canvas,
    canvas3d,
    obterCorpo: () => corpo,
    obterCamera2d: () => camera,
    obterCenario3d: () => (cenario3dPronto ? obterCenario3d() : null),
  };
  ligarEdicaoBlocos(optsPonteiro);
  ligarHoverBloco(optsPonteiro);

  const onWheel = (ev) => {
    ev.preventDefault();
    const fator = ev.deltaY < 0 ? ZOOM_PASSO : 1 / ZOOM_PASSO;
    if (obterModo() === "3d") ajustarZoom3d(fator);
    else ajustarZoom(camera, fator);
  };
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas3d.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("resize", redimensionarCena);

  window.__demo = {
    get corpo() {
      return corpo;
    },
    get camera() {
      return camera;
    },
    get modo() {
      return obterModo();
    },
    get agente() {
      return agente;
    },
    teleporte(x, y, z) {
      corpo.x = x;
      corpo.y = y;
      corpo.z = z;
      corpo.elevacao = z;
      corpo.vx = 0;
      corpo.vy = 0;
      corpo.vz = 0;
      corpo.pulo = null;
      corpo.escalada = null;
      corpo.mantle = null;
      corpo.pulando = false;
      corpo.planando = false;
      corpo.escalando = false;
      corpo.voando = false;
      corpo.nadando = false;
      corpo.afogandoT = 0;
      corpo.noChao = true;
      corpo.hopLift = 0;
      corpo.puloCortado = false;
      corpo.coyoteT = 0;
      corpo.puloBufferT = 0;
      corpo.tempoAr = 0;
      iniciarStamina(corpo);
      if (agente) {
        agente.x = x - 1.1;
        agente.y = y + 0.9;
        agente.z = z;
        agente.elevacao = z;
        agente.vx = 0;
        agente.vy = 0;
        agente.vz = 0;
        agente.hopLift = 0;
        agente.noChao = true;
        agente.pulando = false;
        agente.planando = false;
        agente.voando = false;
        agente.escalando = false;
        agente.nadando = false;
        agente.afogandoT = 0;
        agente.escalada = null;
        agente.mantle = null;
        agente.puloCortado = false;
        agente.coyoteT = 0;
        agente.tempoAr = 0;
        resetarNav(agente);
      }
      camera.pronta = false;
      resetarCamera3d();
      atualizarStreaming(x, y);
    },
  };

  ultimo = performance.now();
  requestAnimationFrame(loop);
}

function ligarRaioStream() {
  const input = document.getElementById("raio-stream");
  const valor = document.getElementById("raio-stream-valor");
  if (!input) return;
  input.min = String(RAIO_STREAM_MIN);
  input.max = String(RAIO_STREAM_MAX);
  input.value = String(obterRaioStream());

  const aplicar = () => {
    const n = definirRaioStream(Number(input.value));
    input.value = String(n);
    if (valor) {
      valor.textContent =
        n === 0 ? "só este chunk" : `${n} · ${n * CHUNK_XZ} blocos`;
    }
    if (corpo) atualizarStreaming(corpo.x, corpo.y);
  };

  input.addEventListener("input", aplicar);
  aplicar();
}

function garantir3d() {
  if (cenario3dPronto) return obterCenario3d();
  const cen = iniciarCenario3d(canvas3d, atlas);
  cenario3dPronto = true;
  return cen;
}

function aoTrocarModo(modo) {
  sincronizarCamadas(modo);
  if (modo === "3d") {
    const cen = garantir3d();
    resetarCamera3d();
    ativarInputRelativoCamera(() => cen.yaw());
    ligarPonteiro3d(canvas3d);
  } else {
    desligarPonteiro3d();
    desativarInputRelativoCamera();
    camera.pronta = false;
  }
}

function sincronizarCamadas(modo) {
  const em3d = modo === "3d";
  canvas3d.classList.toggle("palco__camada--ativa", em3d);
  canvas3d.classList.toggle("palco__camada--oculta", !em3d);
  canvas.classList.toggle("palco__camada--hud", em3d);
  canvas.classList.toggle("palco__camada--ativa", !em3d);
  document.body.dataset.modo = modo;
}

function loop(agora) {
  const dt = Math.min(0.05, (agora - ultimo) / 1000);
  ultimo = agora;

  if (teclaAgora("Backquote")) debug = !debug;
  if (teclaAgora("KeyT")) alternarVisual(atlas);
  if (teclaAgora("Digit3") || teclaAgora("Numpad3")) alternarModo();

  const modo = obterModo();
  if (modo === "3d") {
    garantir3d();
    const mouse = consumirMovimentoMouse();
    olharCamera3d(mouse.dx, mouse.dy);
    if (teclaAgora("Equal") || teclaAgora("NumpadAdd")) ajustarZoom3d(ZOOM_PASSO);
    if (teclaAgora("Minus") || teclaAgora("NumpadSubtract")) {
      ajustarZoom3d(1 / ZOOM_PASSO);
    }
  } else {
    if (teclaAgora("Equal") || teclaAgora("NumpadAdd")) ajustarZoom(camera, ZOOM_PASSO);
    if (teclaAgora("Minus") || teclaAgora("NumpadSubtract")) {
      ajustarZoom(camera, 1 / ZOOM_PASSO);
    }
  }

  atualizarStreaming(corpo.x, corpo.y);
  atualizarMovimento(corpo, dt);
  tickFilaPath();
  atualizarAgente(agente, corpo, dt);
  atualizarHudCompanheiro(agente);
  atualizarHoverBloco();

  try {
    if (modo === "3d") {
      garantir3d();
      const cen = atualizarEDesenhar3d(corpo, dt, atlas, agente);
      const modoVisual = usarTiles(atlas) ? "real" : "cubos";
      desenharHudSobre3d(ctx, canvas, {
        corpo,
        camera3d: cen,
        debug,
        modoVisual,
      });
    } else {
      desenharCena2d(ctx, canvas, { atlas, corpo, camera, debug, dt, agente });
    }
  } catch (err) {
    console.error("Erro no frame:", err);
  }

  requestAnimationFrame(loop);
}

iniciar().catch((err) => {
  console.error(err);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#200";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "14px monospace";
  ctx.fillText("Falha ao carregar assets. Sirva a pasta via HTTP.", 24, 40);
  ctx.fillText(String(err), 24, 64);
});
