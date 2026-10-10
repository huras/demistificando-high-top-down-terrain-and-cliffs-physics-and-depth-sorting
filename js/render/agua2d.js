/**
 * Lâmina e cachoeira no high top-down.
 * O topo fica entre o chão (cy+0.97) e o sprite (cy+0.971).
 */
import { ESCALA, TILE } from "../config.js";
import { colunaAgua } from "../mundo/agua/fluxo.js";
import { cssAgua } from "../mundo/agua/amostra.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import { chaveProfundidade, empilhar } from "./ordenacaoProfundidade.js";

let tempo = 0;

/** Folha do Pokemon AI: 4 frames × 3 colunas × 4 linhas, tile de 16. */
const WF_URL = "assets/terrain/waterfall-strip.png";
const WF_CEL = 16;
const WF_COLS = 3;
const WF_FRAME_S = 0.11;
let folhaWf = null;
let pedidoWf = false;

/** Lago 5×3, frames empilhados. Só o CENTER (tile 6) — as bordas tapariam o cliff. */
const LAGO_URL = "assets/terrain/lake-autotile.png";
const LAGO_COLS = 5;
const LAGO_LINHAS = 3;
const LAGO_CENTER = 6;
const LAGO_FRAME_S = 0.48;
let imgLago = null;
let pedidoLago = false;

function folhaCachoeira() {
  if (folhaWf?.complete && folhaWf.naturalWidth > 0) return folhaWf;
  if (!pedidoWf) {
    pedidoWf = true;
    const img = new Image();
    img.onload = () => {
      folhaWf = img;
    };
    img.src = WF_URL;
  }
  return null;
}

function folhaLago() {
  if (imgLago?.complete && imgLago.naturalWidth > 0) return imgLago;
  if (!pedidoLago) {
    pedidoLago = true;
    const img = new Image();
    img.onload = () => {
      imgLago = img;
    };
    img.src = LAGO_URL;
  }
  return null;
}

function blitCentroLago(ctx, dx, dy, dw, dh, alpha) {
  const img = folhaLago();
  if (!img) return false;
  const frames = Math.max(1, Math.floor(img.naturalHeight / (LAGO_LINHAS * WF_CEL)));
  const frame = Math.floor(tempo / LAGO_FRAME_S) % frames;
  const sx = (LAGO_CENTER % LAGO_COLS) * WF_CEL;
  const sy =
    Math.floor(LAGO_CENTER / LAGO_COLS) * WF_CEL + frame * LAGO_LINHAS * WF_CEL;
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, sx, sy, WF_CEL, WF_CEL, dx, dy, dw, dh);
  return true;
}

export function avancarTempoAgua(dt) {
  tempo += dt > 0 ? dt : 0;
}

function chaveAgua(cy, z) {
  return chaveProfundidade(cy + 0.9705, z);
}

function chaveQueda(cy, z) {
  return chaveProfundidade(cy + 0.9708, z);
}

export function empilharAgua2d(lista, camera) {
  if (!camera) return;
  const inv = 1 / (TILE * ESCALA);
  const viewW = camera.largura / Math.max(0.05, camera.zoom);
  const viewH = camera.altura / Math.max(0.05, camera.zoom);
  const m = 3;
  const x0 = Math.floor(camera.x * inv) - m;
  const x1 = Math.ceil((camera.x + viewW) * inv) + m;
  const y0 = Math.floor(camera.y * inv) - m;
  const y1 = Math.ceil((camera.y + viewH) * inv) + 10;

  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const col = colunaAgua(cx, cy);
      if (col.superficie <= 0) continue;
      if (col.caindo) {
        empilhar(
          lista,
          chaveQueda(cy, col.superficie),
          0,
          (ctx) => desenharQueda(ctx, cx, cy, col),
          1,
          col.superficie,
        );
      }
      empilhar(
        lista,
        chaveAgua(cy, col.superficie),
        0,
        (ctx) => desenharTopoAgua(ctx, cx, cy, col),
        1,
        col.superficie,
      );
    }
  }
}

function desenharTopoAgua(ctx, cx, cy, col) {
  const s = TILE * ESCALA;
  const px = Math.round(mundoParaTelaX(cx));
  const py = Math.round(mundoParaTelaY(cy, col.superficie));
  const alpha = col.caindo ? 0.55 : 0.78;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, s, s);
  ctx.clip();
  if (!blitCentroLago(ctx, px, py, s, s, alpha)) {
    const prof = col.caindo
      ? Math.max(1, col.superficie - col.pisoQueda)
      : col.profundidade || 1;
    ctx.fillStyle = cssAgua(prof, alpha);
    ctx.fillRect(px, py, s, s);
  }
  const faixa = Math.max(2, ESCALA + 1);
  const ciclo = s + faixa;
  const vel = col.fluxoX || col.fluxoY ? 28 : 10;
  const desloc = (tempo * vel) % ciclo;
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  if (Math.abs(col.fluxoX) > Math.abs(col.fluxoY)) {
    const x = px + (col.fluxoX < 0 ? ciclo - desloc : desloc) - faixa;
    ctx.fillRect(x, py, faixa, s);
  } else {
    const y = py + (col.fluxoY < 0 ? ciclo - desloc : desloc) - faixa;
    ctx.fillRect(px, y, s, faixa);
  }
  ctx.restore();
}

/**
 * A lâmina fica 1 z acima do sólido, então a face sul do lago começa
 * um tile abaixo do sprite da água. A cortina sobe até o fim desse sprite.
 */
function medidaQueda(cx, cy, col) {
  const s = TILE * ESCALA;
  const lip = mundoParaTelaY(cy, col.superficie);
  let base = mundoParaTelaY(cy, col.fundo > 0 ? col.fundo : col.pisoQueda);
  const fx = col.fluxoX | 0;
  const fy = col.fluxoY | 0;
  if (fx || fy) {
    const dest = colunaAgua(cx + fx, cy + fy);
    if (dest.superficie > 0 && !dest.caindo) {
      const yDest = mundoParaTelaY(cy + fy, dest.superficie);
      if (yDest > lip + 4) base = yDest;
    }
  }
  if (base < lip + s) base = lip + s;
  return { lip, base };
}

function desenharQueda(ctx, cx, cy, col) {
  const s = TILE * ESCALA;
  const px = Math.round(mundoParaTelaX(cx));
  const { lip, base } = medidaQueda(cx, cy, col);
  const y0 = Math.round(lip);
  const y1 = Math.round(base);
  const altura = y1 - y0;
  const img = folhaCachoeira();
  if (!img || altura < 2) return;

  const frames = Math.max(1, Math.floor(img.naturalWidth / (WF_COLS * WF_CEL)));
  const frame = Math.floor(tempo / WF_FRAME_S) % frames;
  const esq = colunaAgua(cx - 1, cy).caindo;
  const dir = colunaAgua(cx + 1, cy).caindo;
  let faixa = 1;
  if (!esq && dir) faixa = 0;
  else if (esq && !dir) faixa = 2;
  const sx = (frame * WF_COLS + faixa) * WF_CEL;

  const blit = (row, dy, dh) => {
    if (dh < 1) return;
    const srcH = Math.max(1, Math.min(WF_CEL, Math.round((WF_CEL * dh) / s)));
    ctx.drawImage(img, sx, row * WF_CEL, WF_CEL, srcH, px, dy, s, dh);
  };

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.beginPath();
  ctx.rect(px, y0, s, altura);
  ctx.clip();
  if (altura <= s * 1.25) {
    blit(3, y0, altura);
  } else {
    blit(0, y0, s);
    const yEspuma = y1 - s;
    let y = y0 + s;
    while (y < yEspuma - 0.5) {
      const dh = Math.min(s, yEspuma - y);
      blit(2, y, dh);
      y += dh;
    }
    blit(3, yEspuma, s);
  }
  ctx.restore();
}

/** Cobre as pernas abaixo da linha d'água. Chamar depois do sprite. */
export function cobrirPernasAgua(ctx, corpo, rect) {
  const agua = amostraDoCorpo(corpo);
  if (!agua || agua.imersao < 0.12 || !rect) return;
  const { px, py, dw, peY } = rect;
  const aguaY = mundoParaTelaY(corpo.y, agua.superficie, 0);
  const y0 = Math.max(py, aguaY);
  const h = peY - y0;
  if (h <= 1) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, y0, dw, h);
  ctx.clip();
  if (!blitCentroLago(ctx, px, y0, dw, h, 0.62)) {
    const prof = agua.caindo
      ? Math.max(1, agua.superficie - agua.pisoQueda)
      : agua.profundidade || agua.imersao;
    ctx.fillStyle = cssAgua(prof, 0.62);
    ctx.fillRect(px, y0, dw, h);
  }
  ctx.restore();
}

function amostraDoCorpo(corpo) {
  const col = colunaAgua(corpo.x, corpo.y);
  if (col.superficie <= 0) return null;
  const elev = corpo.elevacao ?? corpo.z ?? 0;
  return {
    ...col,
    imersao: Math.max(0, col.superficie - elev),
  };
}
