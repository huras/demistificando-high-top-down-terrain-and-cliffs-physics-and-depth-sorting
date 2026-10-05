import { CAMINHOS, ZOOM_PASSO } from "./config.js";
import { iniciarTeclado, teclaAgora } from "./entrada/teclado.js";
import { atualizarAgente, criarAgente, resetarNav } from "./fisica/agente.js";
import { atualizarMovimento, criarCorpo } from "./fisica/movimento.js";
import { iniciarStamina } from "./fisica/stamina.js";
import { tickFilaPath } from "./navegacao/filaPath.js";
import { SPAWN } from "./mundo/mapaDemo.js";
import { ligarControleModo, obterModo, alternarModo, aoMudarModo } from "./modoJogo.js";
import { alternarVisual, montarAtlas, usarTiles } from "./render/atlas.js";
import { ajustarZoom, criarCamera } from "./render/camera.js";
import { desenharCena2d, desenharHudSobre3d } from "./render/renderizador2d.js";
import {
  ativarInputRelativoCamera,
  desativarInputRelativoCamera,
} from "./render/3d/adaptadorInput3d.js";
import {
  ajustarZoom3d,
  atualizarEDesenhar3d,
  iniciarCenario3d,
  obterCenario3d,
  orbitarCamera3d,
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
  corpo = criarCorpo(SPAWN);
  agente = criarAgente({
    x: SPAWN.x - 1.1,
    y: SPAWN.y + 0.9,
    z: SPAWN.z,
  });
  camera = criarCamera(canvas.width, canvas.height);
  redimensionarCena();

  ligarControleModo(document.getElementById("btn-modo-3d"));
  aoMudarModo(aoTrocarModo);
  sincronizarCamadas(obterModo());

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
        agente.escalando = false;
        agente.escalada = null;
        agente.mantle = null;
        agente.puloCortado = false;
        agente.coyoteT = 0;
        agente.tempoAr = 0;
        resetarNav(agente);
      }
      camera.pronta = false;
      resetarCamera3d();
    },
  };

  ultimo = performance.now();
  requestAnimationFrame(loop);
}

function garantir3d() {
  if (cenario3dPronto) return obterCenario3d();
  const cen = iniciarCenario3d(canvas3d);
  cenario3dPronto = true;
  return cen;
}

function aoTrocarModo(modo) {
  sincronizarCamadas(modo);
  if (modo === "3d") {
    const cen = garantir3d();
    resetarCamera3d();
    ativarInputRelativoCamera(() => cen.yaw());
  } else {
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
    orbitarCamera3d(dt);
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

  atualizarMovimento(corpo, dt);
  tickFilaPath();
  atualizarAgente(agente, corpo, dt);

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
