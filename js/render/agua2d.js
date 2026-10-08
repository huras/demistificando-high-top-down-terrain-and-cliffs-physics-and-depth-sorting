/**
 * Lâmina e cachoeira no high top-down.
 * O topo fica entre o chão (cy+0.97) e o sprite (cy+0.971).
 */
import { ESCALA, FACE_H, JOGADOR_ESCALA, JOGADOR_FRAME, TILE } from "../config.js";
import { colunaAgua } from "../mundo/agua/fluxo.js";
import { cssAgua } from "../mundo/agua/amostra.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import { chaveProfundidade, empilhar } from "./ordenacaoProfundidade.js";

let tempo = 0;

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
  const px = mundoParaTelaX(cx);
  const py = mundoParaTelaY(cy, col.superficie);
  const prof = col.caindo
    ? Math.max(1, col.superficie - col.pisoQueda)
    : col.profundidade || 1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, s, s);
  ctx.clip();
  ctx.fillStyle = cssAgua(prof, col.caindo ? 0.5 : 0.72);
  ctx.fillRect(px, py, s, s);
  const faixa = Math.max(2, ESCALA + 1);
  const ciclo = s + faixa;
  const vel = (col.fluxoX || col.fluxoY) ? 28 : 10;
  const desloc = (tempo * vel) % ciclo;
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

function desenharQueda(ctx, cx, cy, col) {
  const s = TILE * ESCALA;
  const px = mundoParaTelaX(cx);
  const py = mundoParaTelaY(cy, col.superficie);
  const drop = Math.max(1, col.superficie - col.pisoQueda) * FACE_H * ESCALA;
  const prof = Math.max(1, col.superficie - col.pisoQueda);
  ctx.save();
  ctx.fillStyle = cssAgua(prof, 0.48);
  ctx.fillRect(px + s * 0.08, py + s * 0.35, s * 0.84, drop);
  const faixa = Math.max(2, ESCALA);
  const ciclo = 18 * ESCALA;
  const y = (py + (tempo * 46) % ciclo) % (drop + ciclo);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(px + s * 0.08, py + s * 0.35 + (y % drop), s * 0.84, faixa);
  ctx.restore();
}

/** Cobre as pernas abaixo da linha d'água. Chamar depois do sprite. */
export function cobrirPernasAgua(ctx, corpo) {
  const agua = amostraDoCorpo(corpo);
  if (!agua || agua.imersao < 0.12) return;
  const dw = JOGADOR_FRAME * JOGADOR_ESCALA * ESCALA;
  const dh = dw;
  const px = mundoParaTelaX(corpo.x) - dw * 0.5;
  const py = mundoParaTelaY(corpo.y, corpo.z, corpo.hopLift) - dh + 2 * ESCALA;
  const peY = py + dh;
  const aguaY = mundoParaTelaY(corpo.y, agua.superficie, 0);
  const y0 = Math.max(py, aguaY);
  const h = peY - y0;
  if (h <= 1) return;
  const prof = agua.caindo
    ? Math.max(1, agua.superficie - agua.pisoQueda)
    : agua.profundidade || agua.imersao;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, y0, dw, h);
  ctx.clip();
  ctx.fillStyle = cssAgua(prof, 0.62);
  ctx.fillRect(px, y0, dw, h);
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
