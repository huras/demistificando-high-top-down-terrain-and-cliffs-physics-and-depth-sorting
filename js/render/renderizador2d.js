import { CAVERNA_2D_FUNDO } from "../config.js";
import { alturaEm } from "../mundo/altura.js";
import { obterPathDebug } from "../navegacao/seguirCaminho.js";
import {
  aplicarCamera,
  mundoParaTelaX,
  mundoParaTelaY,
  seguirAlvo,
} from "./camera.js";
import { desenharPivosSort } from "./debugPivos.js";
import { atualizarFadeCobertura } from "./fadeCobertura.js";
import { atualizarPainel, desenharOverlayAjuda } from "./hudDebug.js";
import { desenharHudStamina } from "./hudStamina.js";
import { desenharHoverTile2d, desenharLabelHoverHud, desenharMarcadorTileTela } from "./hoverTile.js";
import { obterPonteiroCanvas } from "../entrada/hoverBloco.js";
import { atorSobPonteiro } from "../pokemon/clique.js";
import {
  criarListaProfundidade,
  desenharLista,
  limparLista,
} from "./ordenacaoProfundidade.js";
import { empilharAlvoEscalada } from "./alvoEscalada.js";
import { empilharAgente, empilharPersonagem } from "./personagem.js";
import { empilharPokemon } from "../pokemon/render2d.js";
import { empilharPoeiraPasso } from "./poeiraPasso2d.js";
import { empilharFxBola } from "./fxBola2d.js";
import { empilharFxAguaChao, empilharFxAguaGotas } from "./fxAgua2d.js";
import { desenharAlvoOrdem, desenharHudPokemon, desenharHoverPokemon, projetar2d, projetarPes2d, projetar3d, projetarChao3d } from "../pokemon/hud.js";
import { avancarTempoAgua, empilharAgua2d } from "./agua2d.js";
import { empilharTerreno } from "./terreno.js";
import { usarTiles } from "./atlas.js";
import { obterVisaoCaverna2d } from "./visaoCaverna2d.js";

const lista = criarListaProfundidade();

/**
 * Pipeline completo high top-down (câmera + depth sort + HUD).
 */
export function desenharCena2d(ctx, canvas, { atlas, corpo, camera, debug, dt, agente }) {
  seguirAlvo(camera, corpo.x, corpo.y, corpo.z, corpo.hopLift, dt);
  const modoVisual = usarTiles(atlas) ? "real" : "cubos";
  const ocl = atualizarPainel(corpo, camera.zoom, modoVisual, "2d");
  const visaoCaverna = obterVisaoCaverna2d(corpo);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = visaoCaverna ? CAVERNA_2D_FUNDO : "#0a100c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  aplicarCamera(ctx, camera);
  atualizarFadeCobertura(corpo, dt, atlas);
  limparLista(lista);
  empilharTerreno(
    lista,
    atlas,
    debug,
    debug ? ocl?.face : null,
    camera,
    visaoCaverna,
  );
  avancarTempoAgua(dt);
  empilharAgua2d(lista, camera);
  empilharFxAguaChao(lista);
  empilharAlvoEscalada(lista, corpo, dt);
  if (agente) empilharAgente(lista, atlas, agente);
  empilharPersonagem(lista, atlas, corpo);
  empilharPokemon(lista);
  empilharFxBola(lista);
  empilharPoeiraPasso(lista);
  empilharFxAguaGotas(lista);
  desenharLista(lista, ctx);
  desenharHoverTile2d(ctx);

  if (debug) {
    desenharPivosSort(ctx, corpo);
    desenharPathAgente(ctx, agente);
  }

  desenharOverlayAjuda(ctx, camera, debug, ocl, modoVisual, "2d");
  const projetar = projetar2d(camera);
  const projetarPes = projetarPes2d(camera);
  desenharHudStamina(ctx, corpo, projetar);
  desenharHudPokemon(ctx, projetar, corpo);
  desenharPokemonSobCursor(ctx, canvas, projetar, projetarPes);
  desenharLabelHoverHud(ctx, canvas.width, canvas.height);

  return { ocl, modoVisual };
}

function desenharPathAgente(ctx, agente) {
  const path = obterPathDebug(agente);
  if (!path?.cells?.length) return;
  const idx = agente.nav?.idx ?? 0;
  ctx.save();
  ctx.lineWidth = 1.25;
  for (let i = 1; i < path.cells.length; i++) {
    const a = path.cells[i - 1];
    const b = path.cells[i];
    const za = a.z != null && a.z > 0 ? a.z : alturaEm(a.cx, a.cy);
    const zb = b.z != null && b.z > 0 ? b.z : alturaEm(b.cx, b.cy);
    const tipo = b.tipo | 0;
    const glide = tipo === 3;
    const climb = tipo === 2;
    const voo = tipo === 4;
    ctx.strokeStyle = voo
      ? "rgba(255, 210, 80, 0.95)"
      : glide
        ? "rgba(80, 255, 220, 0.9)"
        : climb
          ? "rgba(220, 140, 255, 0.9)"
          : path.achou
            ? "rgba(120, 220, 255, 0.75)"
            : "rgba(255, 160, 80, 0.8)";
    if (glide || climb || voo) ctx.setLineDash([4, 3]);
    else ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(mundoParaTelaX(a.cx + 0.5), mundoParaTelaY(a.cy + 0.5, za));
    ctx.lineTo(mundoParaTelaX(b.cx + 0.5), mundoParaTelaY(b.cy + 0.5, zb));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  if (idx < path.cells.length) {
    const c = path.cells[idx];
    const z = c.z != null && c.z > 0 ? c.z : alturaEm(c.cx, c.cy);
    const t = c.tipo | 0;
    ctx.fillStyle =
      t === 4
        ? "rgba(255, 210, 80, 0.95)"
        : t === 3
          ? "rgba(80, 255, 220, 0.95)"
          : "rgba(255, 255, 120, 0.9)";
    ctx.beginPath();
    ctx.arc(
      mundoParaTelaX(c.cx + 0.5),
      mundoParaTelaY(c.cy + 0.5, z),
      2.2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}

function desenharMira(ctx, largura, altura, carga = 0) {
  const cx = largura * 0.5;
  const cy = altura * 0.5;
  ctx.save();
  ctx.strokeStyle = "rgba(255, 248, 230, 0.92)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.moveTo(cx - 14, cy);
  ctx.lineTo(cx - 5, cy);
  ctx.moveTo(cx + 5, cy);
  ctx.lineTo(cx + 14, cy);
  ctx.moveTo(cx, cy - 14);
  ctx.lineTo(cx, cy - 5);
  ctx.moveTo(cx, cy + 5);
  ctx.lineTo(cx, cy + 14);
  ctx.stroke();
  if (carga > 0.02) {
    ctx.strokeStyle = carga > 0.98 ? "rgba(255, 214, 102, 0.95)" : "rgba(255, 248, 230, 0.9)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * carga);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Só HUD por cima do WebGL (canvas 2d transparente).
 */
export function desenharHudSobre3d(ctx, canvas, { corpo, camera3d, debug, modoVisual, emCena = false }) {
  const zoom = camera3d?.distanciaNormalizada?.() ?? 1;
  const ocl = atualizarPainel(corpo, zoom, modoVisual, "3d");

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  desenharOverlayAjuda(ctx, { zoom }, debug, null, modoVisual, "3d");
  const cam = emCena ? null : camera3d?.camRender;
  const projetar = cam ? projetar3d(cam, canvas.width, canvas.height) : null;
  const projetarChao = cam ? projetarChao3d(cam, canvas.width, canvas.height) : null;
  desenharHudStamina(ctx, corpo, projetar);
  desenharHudPokemon(ctx, projetar, corpo, projetarChao);
  if (emCena) {
    desenharTagCena(ctx, canvas.width);
  } else {
    desenharMarcadorTileTela(ctx, projetarChao);
    desenharPokemonSobCursor(ctx, canvas, projetar, projetarChao);
    desenharLabelHoverHud(ctx, canvas.width, canvas.height, false);
    if ((camera3d?.camera3d?.blend ?? 0) > 0.35) {
      desenharMira(ctx, canvas.width, canvas.height, camera3d?.flechas?.carga?.() ?? 0);
    }
  }

  return { ocl, modoVisual };
}

function desenharPokemonSobCursor(ctx, canvas, projetar, projetarPes) {
  const ponteiro = obterPonteiroCanvas(canvas);
  const sob = ponteiro ? atorSobPonteiro(ponteiro.x, ponteiro.y, projetar, projetarPes) : null;
  const ordem = desenharAlvoOrdem(ctx, projetar, projetarPes, sob);
  if (sob) desenharHoverPokemon(ctx, sob, projetar, projetarPes, sob !== ordem);
}

function desenharTagCena(ctx, largura) {
  ctx.save();
  ctx.font = "600 13px Segoe UI, sans-serif";
  const texto = "Cena";
  const w = ctx.measureText(texto).width + 18;
  const x = Math.max(12, (largura - w) * 0.5);
  ctx.fillStyle = "rgba(15, 20, 16, 0.78)";
  ctx.fillRect(x, 10, w, 22);
  ctx.fillStyle = "#7dce6a";
  ctx.fillText(texto, x + 9, 25);
  ctx.restore();
}
