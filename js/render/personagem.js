import { ESCALA, JOGADOR_ESCALA, JOGADOR_FRAME, TILE } from "../config.js";
import { cobrirPernasAgua } from "./agua2d.js";
import { desenharAsaDelta } from "./asaDeltaVisual.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import { chaveEntidade, chaveTopo, empilhar } from "./ordenacaoProfundidade.js";
import { CORES } from "./paleta.js";
import { empilharSombras } from "./sombra.js";

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

export function desenharPersonagem(ctx, atlas, corpo, tint = null) {
  const sheet = atlas.jogador;
  const frame = JOGADOR_FRAME;
  const linha = corpo.facing | 0;
  const ciclo = [0, 1, 0, 3];
  const col = corpo.andando ? ciclo[Math.floor(corpo.animT * 8) % 4] : 0;
  const dw = frame * JOGADOR_ESCALA * ESCALA;
  const dh = frame * JOGADOR_ESCALA * ESCALA;

  const px = mundoParaTelaX(corpo.x) - dw * 0.5;
  const py = mundoParaTelaY(corpo.y, corpo.z, corpo.hopLift) - dh + 2 * ESCALA;

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
  cobrirPernasAgua(ctx, corpo);

  if (corpo.planando) {
    const ax = mundoParaTelaX(corpo.x);
    const ay = mundoParaTelaY(corpo.y, corpo.z, corpo.hopLift);
    desenharAsaDelta(ctx, corpo, ax, ay, dh * 0.55);
  }
}

export function formulasPersonagem(corpo) {
  const elev = corpo.elevacao ?? corpo.z + (corpo.hopLift || 0);
  const screenY = corpo.y * TILE - elev * TILE;
  const sortKey = chaveEntidade(corpo.y, corpo.z);
  return {
    screenY,
    sortKey,
    textoTela: `screenY = ${corpo.y.toFixed(2)}·${TILE} − elev ${elev.toFixed(2)}·${TILE} = ${screenY.toFixed(1)}`,
    textoSort: `sortKey = entidade(${corpo.y.toFixed(2)}, z${corpo.z}) = ${sortKey.toFixed(4)}`,
  };
}
