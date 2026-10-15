import { ESCALA, FACE_H, JOGADOR_ESCALA, JOGADOR_FRAME, TILE } from "../config.js";
import { cobrirPernasAgua } from "./agua2d.js";
import { desenharAsaDelta } from "./asaDeltaVisual.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import { pivoDoFrame } from "./pivoPe.js";
import { carregarPivoJogador, pivoDoJogador } from "./pivoJogador.js";
import { chaveEntidade, chaveTopo, empilhar } from "./ordenacaoProfundidade.js";
import { CORES } from "./paleta.js";
import { empilharSombras } from "./sombra.js";

carregarPivoJogador();

/**
 * Sheet gold 4×4, frame 64px, displayScale 0.5.
 * Linhas: 0 sul, 1 oeste, 2 leste, 3 norte (padrão overworld).
 */
/** Mesma camada 0 do terreno — compete por sortKey (Y). */
export function empilharPersonagem(lista, atlas, corpo, opts = {}) {
  const cx = Math.floor(corpo.x);
  const cy = Math.floor(corpo.y);
  const borda = opts.borda !== false;
  const tint = opts.tint || null;
  const tie = opts.tie ?? 5;

  empilharSombras(lista, corpo);

  if (borda) {
    empilhar(
      lista,
      chaveTopo(cy, corpo.z),
      0,
      (ctx) => desenharBordaCelula(ctx, cx, cy, corpo.z),
      4,
      corpo.z,
    );
  }

  const sortKey = chaveEntidade(corpo.y, corpo.z);
  empilhar(
    lista,
    sortKey,
    0,
    (ctx) => desenharPersonagem(ctx, atlas, corpo, tint),
    tie,
    corpo.z,
  );
}

export function empilharAgente(lista, atlas, agente) {
  empilharPersonagem(lista, atlas, agente, {
    borda: false,
    tint: "hue-rotate(170deg) saturate(1.35) brightness(1.05)",
    tie: 6,
  });
}

function desenharBordaCelula(ctx, cx, cy, z) {
  const px = mundoParaTelaX(cx);
  const py = mundoParaTelaY(cy, z);
  const s = TILE * ESCALA;

  ctx.strokeStyle = CORES.celulaJogadorGlow;
  ctx.lineWidth = 4;
  ctx.strokeRect(px + 1, py + 1, s - 2, s - 2);

  ctx.strokeStyle = CORES.celulaJogador;
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1.5, py + 1.5, s - 3, s - 3);
}

function quadroDoCorpo(corpo) {
  const frame = JOGADOR_FRAME;
  const linha = corpo.facing | 0;
  const ciclo = [0, 1, 0, 3];
  const col = corpo.andando ? ciclo[Math.floor(corpo.animT * 8) % 4] : 0;
  return { frame, linha, col };
}

/** Retângulo na tela com o pé opaco em (footX, footY). */
export function retanguloDoPersonagem(atlas, corpo) {
  const sheet = atlas?.jogador || null;
  const { frame, linha, col } = quadroDoCorpo(corpo);
  const dw = frame * JOGADOR_ESCALA * ESCALA;
  const dh = dw;
  const pivo = sheet ? pivoDoFrame(sheet, col, linha, frame) : { x: 0.5, y: 1 };
  const aj = pivoDoJogador();
  const pxSprite = dw / frame;
  const footX = mundoParaTelaX(corpo.x);
  const footY = mundoParaTelaY(corpo.y, corpo.z, corpo.hopLift) + aj.offsetY * TILE * ESCALA;
  return {
    sheet,
    frame,
    linha,
    col,
    dw,
    dh,
    px: footX - pivo.x * dw + aj.dx * pxSprite,
    py: footY - pivo.y * dh + aj.dy * pxSprite,
    peY: footY,
  };
}

export function desenharPersonagem(ctx, atlas, corpo, tint = null) {
  const rect = retanguloDoPersonagem(atlas, corpo);
  const { sheet, frame, linha, col, dw, dh, px, py } = rect;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (tint) ctx.filter = tint;
  ctx.drawImage(
    sheet,
    col * frame,
    linha * frame,
    frame,
    frame,
    px,
    py,
    dw,
    dh,
  );
  ctx.restore();
  cobrirPernasAgua(ctx, corpo, rect);

  if (corpo.planando) {
    const ax = mundoParaTelaX(corpo.x);
    const ay = mundoParaTelaY(corpo.y, corpo.z, corpo.hopLift);
    desenharAsaDelta(ctx, corpo, ax, ay, dh * 0.55);
  }
}

export function formulasPersonagem(corpo) {
  const elev = corpo.elevacao ?? corpo.z + (corpo.hopLift || 0);
  const screenY = corpo.y * TILE - elev * FACE_H;
  const sortKey = chaveEntidade(corpo.y, corpo.z);
  return {
    screenY,
    sortKey,
    textoTela: `screenY = ${corpo.y.toFixed(2)}·${TILE} − elev ${elev.toFixed(2)}·${FACE_H} = ${screenY.toFixed(1)}`,
    textoSort: `sortKey = entidade(${corpo.y.toFixed(2)}, z${corpo.z}) = ${sortKey.toFixed(4)}`,
  };
}
