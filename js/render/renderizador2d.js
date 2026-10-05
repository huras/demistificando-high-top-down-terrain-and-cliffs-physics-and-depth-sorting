import {
  aplicarCamera,
  seguirAlvo,
} from "./camera.js";
import { desenharPivosSort } from "./debugPivos.js";
import { atualizarPainel, desenharOverlayAjuda } from "./hudDebug.js";
import { desenharHudStamina } from "./hudStamina.js";
import {
  criarListaProfundidade,
  desenharLista,
  limparLista,
} from "./ordenacaoProfundidade.js";
import { empilharAlvoEscalada } from "./alvoEscalada.js";
import { empilharPersonagem } from "./personagem.js";
import { empilharTerreno } from "./terreno.js";
import { usarTiles } from "./atlas.js";

const lista = criarListaProfundidade();

/**
 * Pipeline completo high top-down (câmera + depth sort + HUD).
 */
export function desenharCena2d(ctx, canvas, { atlas, corpo, camera, debug, dt }) {
  seguirAlvo(camera, corpo.x, corpo.y, corpo.z, corpo.hopLift, dt);
  const modoVisual = usarTiles(atlas) ? "real" : "cubos";
  const ocl = atualizarPainel(corpo, camera.zoom, modoVisual, "2d");

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0a100c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  aplicarCamera(ctx, camera);
  limparLista(lista);
  empilharTerreno(lista, atlas, debug, debug ? ocl?.face : null);
  empilharAlvoEscalada(lista, corpo, dt);
  empilharPersonagem(lista, atlas, corpo);
  desenharLista(lista, ctx);

  if (debug) desenharPivosSort(ctx, corpo);

  desenharOverlayAjuda(ctx, camera, debug, ocl, modoVisual, "2d");
  desenharHudStamina(ctx, corpo, canvas.width, canvas.height);

  return { ocl, modoVisual };
}

/**
 * Só HUD por cima do WebGL (canvas 2d transparente).
 */
export function desenharHudSobre3d(ctx, canvas, { corpo, camera3d, debug, modoVisual }) {
  const zoom = camera3d?.distanciaNormalizada?.() ?? 1;
  const ocl = atualizarPainel(corpo, zoom, modoVisual, "3d");

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  desenharOverlayAjuda(ctx, { zoom }, debug, null, modoVisual, "3d");
  desenharHudStamina(ctx, corpo, canvas.width, canvas.height);

  return { ocl, modoVisual };
}
