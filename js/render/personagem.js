import { ESCALA, JOGADOR_ESCALA, JOGADOR_FRAME, TILE } from "../config.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import { chaveProfundidade, empilhar } from "./ordenacaoProfundidade.js";

/**
 * Sheet gold 4×4, frame 64px, displayScale 0.5.
 * Linhas: 0 sul, 1 oeste, 2 leste, 3 norte (padrão overworld).
 */
export function empilharPersonagem(lista, atlas, corpo) {
  const sortKey = chaveProfundidade(corpo.y, corpo.z);
  empilhar(
    lista,
    sortKey,
    1,
    (ctx) => desenharPersonagem(ctx, atlas, corpo),
    5,
  );
}

export function desenharPersonagem(ctx, atlas, corpo) {
  const sheet = atlas.jogador;
  const frame = JOGADOR_FRAME;
  const linha = corpo.facing | 0;
  const ciclo = [0, 1, 0, 3];
  const col = corpo.andando ? ciclo[Math.floor(corpo.animT * 8) % 4] : 0;
  const dw = frame * JOGADOR_ESCALA * ESCALA;
  const dh = frame * JOGADOR_ESCALA * ESCALA;

  // âncora nos pés
  const px = mundoParaTelaX(corpo.x) - dw * 0.5;
  const py = mundoParaTelaY(corpo.y, corpo.z, corpo.hopLift) - dh + 2 * ESCALA;

  ctx.imageSmoothingEnabled = false;

  // sombra no chão (sem hop)
  const sombraY = mundoParaTelaY(corpo.y, corpo.z) - 2 * ESCALA;
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(mundoParaTelaX(corpo.x), sombraY, 7 * ESCALA, 3 * ESCALA, 0, 0, Math.PI * 2);
  ctx.fill();

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
}

export function formulasPersonagem(corpo) {
  const screenY = corpo.y * TILE - corpo.z * TILE - corpo.hopLift * TILE;
  const sortKey = chaveProfundidade(corpo.y, corpo.z);
  return {
    screenY,
    sortKey,
    textoTela: `screenY = ${corpo.y.toFixed(2)}·${TILE} − ${corpo.z}·${TILE} − ${corpo.hopLift.toFixed(2)}·${TILE} = ${screenY.toFixed(1)}`,
    textoSort: `sortKey = ${corpo.y.toFixed(2)} + ${corpo.z}·ε = ${sortKey.toFixed(4)}`,
  };
}
