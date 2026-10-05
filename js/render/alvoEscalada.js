import { ESCALA, TILE } from "../config.js";
import { encontrarFacePerto } from "../mundo/facesCliff.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import { chaveTopo, empilhar } from "./ordenacaoProfundidade.js";

/**
 * Tile de topo onde o jogador sairia no mantle (mesmo alvo de fazerMantle).
 * Visível com face detectada — antes e durante a escalada.
 */
export function consultarAlvoEscalada(corpo) {
  if (!corpo) return null;

  if (corpo.escalando && corpo.escalada) {
    const e = corpo.escalada;
    return { cx: e.cx, cy: e.cy, z: e.zTopo };
  }

  if ((corpo.stamina ?? 0) <= 1e-4) return null;

  const zRef = corpo.noChao ? corpo.z : (corpo.elevacao ?? corpo.z);
  const face = encontrarFacePerto(corpo.x, corpo.y, zRef);
  if (!face) return null;

  return { cx: face.cx, cy: face.cy, z: face.zTopo };
}

export function empilharAlvoEscalada(lista, corpo) {
  const alvo = consultarAlvoEscalada(corpo);
  if (!alvo) return null;

  const sortKey = chaveTopo(alvo.cy, alvo.z);
  empilhar(
    lista,
    sortKey,
    0,
    (ctx) => desenharCirculoAlvo(ctx, alvo),
    12, // depois do topo/face/player da célula
    alvo.z,
  );
  return alvo;
}

function desenharCirculoAlvo(ctx, alvo) {
  const sx = mundoParaTelaX(alvo.cx + 0.5);
  const sy = mundoParaTelaY(alvo.cy + 0.5, alvo.z);
  const base = TILE * ESCALA * 0.38;
  const pulso = 0.92 + 0.08 * Math.sin(performance.now() * 0.006);
  const r = base * pulso;

  ctx.save();
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(125, 206, 106, 0.28)";
  ctx.fill();
  ctx.strokeStyle = "rgba(200, 255, 170, 0.95)";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(sx, sy, r * 0.45, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(125, 206, 106, 0.7)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}
