import { ESCALA, JOGADOR_ESCALA, JOGADOR_FRAME, TILE } from "../config.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import { chaveProfundidade, chaveTopo, empilhar } from "./ordenacaoProfundidade.js";
import { CORES } from "./paleta.js";

/**
 * Sheet gold 4×4, frame 64px, displayScale 0.5.
 * Linhas: 0 sul, 1 oeste, 2 leste, 3 norte (padrão overworld).
 */
/** Mesma camada 0 do terreno — compete por sortKey (Y). */
export function empilharPersonagem(lista, atlas, corpo) {
  const cx = Math.floor(corpo.x);
  const cy = Math.floor(corpo.y);
  // borda da célula sob os pés (no topo do cubo, antes do sprite)
  empilhar(
    lista,
    chaveTopo(cy, corpo.z),
    0,
    (ctx) => desenharBordaCelula(ctx, cx, cy, corpo.z),
    4,
  );

  const sortKey = chaveProfundidade(corpo.y, corpo.z);
  empilhar(
    lista,
    sortKey,
    0,
    (ctx) => desenharPersonagem(ctx, atlas, corpo),
    5,
  );
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
