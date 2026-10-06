import { CAMINHOS, ZOOM_PASSO } from "./config.js";
import { ligarEdicaoBlocos } from "./entrada/edicaoBlocos.js";
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
import { SPAWN } from "./mundo/mapaDemo.js";
import {
  atualizarStreaming,
  iniciarMundoAoRedor,
  obterAabbCarregado,
} from "./mundo/voxel/storeMundo.js";
import { ligarControleModo, obterModo, alternarModo, aoMudarModo } from "./modoJogo.js";
import { alternarVisual, montarAtlas, usarTiles } from "./render/atlas.js";
import { ajustarZoom, criarCamera } from "./render/camera.js";
import { desenharCena2d, desenharHudSobre3d } from "./render/renderizador2d.js";
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

  iniciarMundoAoRedor(SPAWN.x, SPAWN.y);
  // Nav só invalida em edição de bloco — streaming não deve rebuildar (era ~18s).
  // #region agent log
  // hypothesisId D: stream dirty ≠ nav invalidate
  // #endregion

  corpo = criarCorpo(SPAWN);
  agente = criarAgente({
    x: SPAWN.x - 1.1,
    y: SPAWN.y + 0.9,
    z: SPAWN.z,
  });
  camera = criarCamera(canvas.width, canvas.height);
  redimensionarCena();

  ligarHudCompanheiro(agente, CAPS_PADRAO);
  ligarControleModo(document.getElementById("btn-modo-3d"));
  aoMudarModo(aoTrocarModo);
  sincronizarCamadas(obterModo());

  ligarEdicaoBlocos({
    canvas2d: canvas,
    canvas3d,
    obterCorpo: () => corpo,
    obterCamera2d: () => camera,
    obterCenario3d: () => (cenario3dPronto ? obterCenario3d() : null),
  });

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

  // #region agent log
  const __t0 = performance.now();
  // #endregion
  atualizarStreaming(corpo.x, corpo.y);
  // #region agent log
  const __tStream = performance.now();
  if (!atualizarStreaming.__lastComp || performance.now() - atualizarStreaming.__lastComp > 500) {
    const aabb = obterAabbCarregado();
    const ax = agente.x|0, ay = agente.y|0;
    const fora = ax < aabb.x0 || ax > aabb.x1 || ay < aabb.y0 || ay > aabb.y1;
    fetch('http://127.0.0.1:7578/ingest/2d17c26e-34d3-4e31-ad4f-513a36a051d1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ac17a'},body:JSON.stringify({sessionId:'8ac17a',runId:'proc-follow',hypothesisId:'H-Unload',location:'principal.js:loop',message:'stream_vs_comp',data:{px:corpo.x|0,py:corpo.y|0,ax,ay,fora,aabb:{x0:aabb.x0,y0:aabb.y0,x1:aabb.x1,y1:aabb.y1},dist:+Math.hypot(corpo.x-agente.x,corpo.y-agente.y).toFixed(1)},timestamp:Date.now()})}).catch(()=>{});
    atualizarStreaming.__lastComp = performance.now();
  }
  // #endregion
  atualizarMovimento(corpo, dt);
  tickFilaPath();
  atualizarAgente(agente, corpo, dt);
  atualizarHudCompanheiro(agente);
  // #region agent log
  const __tSim = performance.now();
  // #endregion

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

  // #region agent log
  const __tEnd = performance.now();
  if (!window.__perfDbg) window.__perfDbg = { n: 0, acc: 0, lastLog: 0 };
  const __pd = window.__perfDbg;
  const __frameMs = __tEnd - __t0;
  __pd.n++;
  __pd.acc += __frameMs;
  if (__tEnd - __pd.lastLog > 1000) {
    const avg = __pd.acc / Math.max(1, __pd.n);
    fetch('http://127.0.0.1:7578/ingest/2d17c26e-34d3-4e31-ad4f-513a36a051d1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ac17a'},body:JSON.stringify({sessionId:'8ac17a',runId:'post-fix',hypothesisId:'A,B,E',location:'principal.js:loop',message:'frame_budget',data:{modo,avgFrameMs:+avg.toFixed(2),streamMs:+(__tStream-__t0).toFixed(2),simMs:+(__tSim-__tStream).toFixed(2),drawMs:+(__tEnd-__tSim).toFixed(2),samples:__pd.n,x:corpo.x|0,y:corpo.y|0},timestamp:Date.now()})}).catch(()=>{});
    __pd.n = 0;
    __pd.acc = 0;
    __pd.lastLog = __tEnd;
  }
  // #endregion

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
