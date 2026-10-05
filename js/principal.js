import { CAMINHOS, ZOOM_PASSO } from "./config.js";
import { iniciarTeclado, teclaAgora } from "./entrada/teclado.js";
import { atualizarMovimento, criarCorpo } from "./fisica/movimento.js";
import { SPAWN } from "./mundo/mapaDemo.js";
import { montarAtlas } from "./render/atlas.js";
import {
  ajustarZoom,
  aplicarCamera,
  criarCamera,
  seguirAlvo,
} from "./render/camera.js";
import { desenharPivosSort } from "./render/debugPivos.js";
import { atualizarPainel, desenharOverlayAjuda } from "./render/hudDebug.js";
import {
  criarListaProfundidade,
  desenharLista,
  limparLista,
} from "./render/ordenacaoProfundidade.js";
import { empilharPersonagem } from "./render/personagem.js";
import { empilharTerreno } from "./render/terreno.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let atlas;
let corpo;
let camera;
let debug = false;
let ultimo = 0;
const lista = criarListaProfundidade();

async function iniciar() {
  iniciarTeclado();
  atlas = await montarAtlas(CAMINHOS);
  corpo = criarCorpo(SPAWN);
  camera = criarCamera(canvas.width, canvas.height);

  canvas.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      ajustarZoom(camera, ev.deltaY < 0 ? ZOOM_PASSO : 1 / ZOOM_PASSO);
    },
    { passive: false },
  );

  window.__demo = {
    get corpo() {
      return corpo;
    },
    get camera() {
      return camera;
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
      corpo.pulando = false;
      corpo.planando = false;
      corpo.escalando = false;
      corpo.noChao = true;
      corpo.hopLift = 0;
      corpo.puloCortado = false;
      corpo.coyoteT = 0;
      corpo.puloBufferT = 0;
      corpo.tempoAr = 0;
      camera.pronta = false;
    },
  };
  ultimo = performance.now();
  requestAnimationFrame(loop);
}

function loop(agora) {
  const dt = Math.min(0.05, (agora - ultimo) / 1000);
  ultimo = agora;

  if (teclaAgora("Backquote")) debug = !debug;
  if (teclaAgora("Equal") || teclaAgora("NumpadAdd")) ajustarZoom(camera, ZOOM_PASSO);
  if (teclaAgora("Minus") || teclaAgora("NumpadSubtract")) {
    ajustarZoom(camera, 1 / ZOOM_PASSO);
  }

  atualizarMovimento(corpo, dt);
  seguirAlvo(camera, corpo.x, corpo.y, corpo.z, corpo.hopLift, dt);
  const ocl = atualizarPainel(corpo, camera.zoom);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0a100c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  aplicarCamera(ctx, camera);
  limparLista(lista);
  empilharTerreno(lista, atlas, debug, debug ? ocl?.face : null);
  empilharPersonagem(lista, atlas, corpo);
  desenharLista(lista, ctx);

  if (debug) desenharPivosSort(ctx, corpo);

  desenharOverlayAjuda(ctx, camera, debug, ocl);

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
