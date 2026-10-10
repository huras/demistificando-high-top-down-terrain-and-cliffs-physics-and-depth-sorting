/**
 * Cliffs por célula — grass-on-dirt usa *_UNDER; legado usa EDGE_S/OUT_*.
 * Topo GOD: 4 quartos de borda (solo / faixa vertical / horizontal).
 * Laterais W/E: só no sheet legado; no GOD o lip vem dos quartos do chão.
 */
import {
  ESCALA,
  FACE_H,
  FLOOR_ROW_OFFSET,
  GOD_CENTER,
  GOD_COLS,
  GOD_EDGE_E,
  GOD_EDGE_N,
  GOD_EDGE_S,
  GOD_EDGE_S_UNDER,
  GOD_EDGE_W,
  GOD_OUT_NE,
  GOD_OUT_NW,
  GOD_OUT_SE,
  GOD_OUT_SE_UNDER,
  GOD_OUT_SW,
  GOD_OUT_SW_UNDER,
  ROLE_CENTER,
  ROLE_EDGE_E,
  ROLE_EDGE_S,
  ROLE_EDGE_W,
  ROLE_OUT_SE,
  ROLE_OUT_SW,
  SHEET_COLS,
  TILE,
  TILE_ART,
} from "../config.js";
import { solidoEm } from "../mundo/altura.js";
import { sheetCliffDoAtlas, usarGrassOnDirt } from "./atlas.js";
import { kitDoRelevo } from "../mundo/bioma/catalogo.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";

const GOD_HALF = TILE_ART >> 1;

/**
 * Vizinho ainda "alto" nesta camada de topo (z = superfície do tile).
 * Usa solidoEm na laje (z-1), não alturaEm — em caverna/overhang o heightmap
 * do cume mentiria e sumiria as bordas do chão interno.
 */
function vizinhoNaCamada(nx, ny, zTopo) {
  const bz = (zTopo | 0) - 1;
  if (bz < 0) return false;
  return solidoEm(nx, ny, bz);
}

/**
 * Topo grass-on-dirt: 4 quartos (N/S/E/W + solo) a partir das bordas do sheet.
 */
export function desenharTopoGod(ctx, atlas, cx, cy, z) {
  const img = atlas?.grassOnDirt;
  if (!img || !ctx) return;

  const px = Math.round(mundoParaTelaX(cx));
  const py = Math.round(mundoParaTelaY(cy, z));
  const s = TILE * ESCALA;
  const half = s >> 1;
  // Overlap só para o centro do tile — nunca vaza pro vizinho (linhas nas quinas).
  const o = 1;
  const q = half + o;

  const n = vizinhoNaCamada(cx, cy - 1, z);
  const sOk = vizinhoNaCamada(cx, cy + 1, z);
  const w = vizinhoNaCamada(cx - 1, cy, z);
  const e = vizinhoNaCamada(cx + 1, cy, z);

  blitGodQuarto(ctx, img, roleQuartoGod(n, w, GOD_OUT_NW, GOD_EDGE_N, GOD_EDGE_W), 0, px, py, q, q);
  blitGodQuarto(ctx, img, roleQuartoGod(n, e, GOD_OUT_NE, GOD_EDGE_N, GOD_EDGE_E), 1, px + half - o, py, q, q);
  blitGodQuarto(ctx, img, roleQuartoGod(sOk, w, GOD_OUT_SW, GOD_EDGE_S, GOD_EDGE_W), 2, px, py + half - o, q, q);
  blitGodQuarto(ctx, img, roleQuartoGod(sOk, e, GOD_OUT_SE, GOD_EDGE_S, GOD_EDGE_E), 3, px + half - o, py + half - o, q, q);
}

/** cardA/cardB = vizinho naquele eixo ainda alto; senão usa canto/edge. */
function roleQuartoGod(cardA, cardB, out, edgeA, edgeB) {
  if (cardA && cardB) return GOD_CENTER;
  if (!cardA && !cardB) return out;
  if (!cardA) return edgeA;
  return edgeB;
}

/**
 * Face sul: empilha um tile de cliff por degrau.
 */
export function desenharFaceSulSingle(ctx, atlas, cx, cy, zTopo, queda, destacar) {
  if (queda < 1) return;

  const px = Math.round(mundoParaTelaX(cx));
  const topY = Math.round(mundoParaTelaY(cy, zTopo));
  const w = TILE * ESCALA;
  const step = FACE_H * ESCALA;
  // Colado no topo; overlap só na vertical entre degraus (não vaza pra coluna vizinha).
  const py0 = topY + TILE * ESCALA - 1;
  const dw = w;
  const dh = step + 1;

  if (usarGrassOnDirt(atlas)) {
    const sheet = atlas.grassOnDirt;
    const folhaCliff = atlas.cliffs?.[kitDoRelevo(cx, cy)] || sheet;
    for (let i = 0; i < queda; i++) {
      const dy = py0 + i * step;
      // Chão atrás do alpha: só na base (degraus de cima = arredondamento puro).
      if (i === queda - 1) blitGod(ctx, sheet, GOD_CENTER, px, dy, dw, dh);
      desenharUnderGod(ctx, folhaCliff, cx, cy, zTopo, px, dy, dw, dh);
    }
  } else {
    const sheet = sheetCliffDoAtlas(atlas);
    if (!sheet) return;
    const role = papelLabioSulLegado(cx, cy, zTopo);
    const chao =
      zTopo >= 2 && atlas.terra ? atlas.terra : atlas.grama || atlas.terra;
    for (let i = 0; i < queda; i++) {
      const dy = py0 + i * step;
      if (chao) blitRole(ctx, chao, ROLE_CENTER, FLOOR_ROW_OFFSET, px, dy, dw, dh);
      blitRole(ctx, sheet, role, 0, px, dy, dw, dh);
    }
  }

  if (destacar) {
    ctx.strokeStyle = "rgba(255, 220, 80, 0.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py0 + 1, w - 2, queda * step - 2);
  }
}

/**
 * UNDER sul: tile inteiro nas pontas; solo = metade SW + metade SE.
 */
function desenharUnderGod(ctx, sheet, cx, cy, zTopo, px, dy, dw, dh) {
  const wHigh = vizinhoNaCamada(cx - 1, cy, zTopo);
  const eHigh = vizinhoNaCamada(cx + 1, cy, zTopo);
  if (eHigh && !wHigh) {
    blitGod(ctx, sheet, GOD_OUT_SW_UNDER, px, dy, dw, dh);
    return;
  }
  if (wHigh && !eHigh) {
    blitGod(ctx, sheet, GOD_OUT_SE_UNDER, px, dy, dw, dh);
    return;
  }
  if (wHigh && eHigh) {
    blitGod(ctx, sheet, GOD_EDGE_S_UNDER, px, dy, dw, dh);
    return;
  }
  // Solo / faixa 1 de largura: metades com overlap só no centro.
  const halfW = dw >> 1;
  const o = 1;
  blitGodMetade(ctx, sheet, GOD_OUT_SW_UNDER, "w", px, dy, halfW + o, dh);
  blitGodMetade(ctx, sheet, GOD_OUT_SE_UNDER, "e", px + halfW - o, dy, dw - halfW + o, dh);
}

/**
 * Laterais: no grass-on-dirt não desenha (lip no chão).
 * Legado: faixa estreita de EDGE_W/E.
 */
export function desenharFaceLateralSingle(ctx, atlas, cx, cy, zTopo, queda, lado) {
  if (usarGrassOnDirt(atlas)) return;
  const sheet = sheetCliffDoAtlas(atlas);
  if (!sheet || queda < 1) return;

  const px = mundoParaTelaX(cx);
  const topY = mundoParaTelaY(cy, zTopo);
  const s = TILE * ESCALA;
  const step = FACE_H * ESCALA;
  const faixa = Math.max(5, ESCALA * 3);
  const x = lado === "w" ? px : px + s - faixa;
  const role = lado === "w" ? ROLE_EDGE_W : ROLE_EDGE_E;
  const chao =
    zTopo >= 2 && atlas.terra ? atlas.terra : atlas.grama || atlas.terra;

  for (let i = 0; i < queda; i++) {
    const dy = topY + s - 1 + i * step;
    if (chao) {
      blitRoleFaixa(ctx, chao, ROLE_CENTER, FLOOR_ROW_OFFSET, lado, x, dy, faixa, step);
    }
    blitRoleFaixa(ctx, sheet, role, 0, lado, x, dy, faixa, step);
  }
}

function papelLabioSulLegado(cx, cy, zTopo) {
  const wHigh = vizinhoNaCamada(cx - 1, cy, zTopo);
  const eHigh = vizinhoNaCamada(cx + 1, cy, zTopo);
  if (eHigh && !wHigh) return ROLE_OUT_SW;
  if (wHigh && !eHigh) return ROLE_OUT_SE;
  return ROLE_EDGE_S;
}

export function blitGod(ctx, img, role, dx, dy, dw, dh) {
  if (!img || !ctx) return;
  const col = role % GOD_COLS;
  const row = (role / GOD_COLS) | 0;
  ctx.drawImage(
    img,
    col * TILE_ART,
    row * TILE_ART,
    TILE_ART,
    TILE_ART,
    dx,
    dy,
    dw,
    dh,
  );
}

/** q: 0=NW 1=NE 2=SW 3=SE — copia o quarto correspondente do role. */
function blitGodQuarto(ctx, img, role, q, dx, dy, dw, dh) {
  if (!img || !ctx) return;
  const col = role % GOD_COLS;
  const row = (role / GOD_COLS) | 0;
  const sx = col * TILE_ART + ((q & 1) ? GOD_HALF : 0);
  const sy = row * TILE_ART + ((q & 2) ? GOD_HALF : 0);
  ctx.drawImage(img, sx, sy, GOD_HALF, GOD_HALF, dx, dy, dw, dh);
}

function blitGodMetade(ctx, img, role, lado, dx, dy, dw, dh) {
  if (!img || !ctx) return;
  const col = role % GOD_COLS;
  const row = (role / GOD_COLS) | 0;
  const sx = col * TILE_ART + (lado === "e" ? GOD_HALF : 0);
  const sy = row * TILE_ART;
  ctx.drawImage(img, sx, sy, GOD_HALF, TILE_ART, dx, dy, dw, dh);
}

function blitRole(ctx, img, role, bandOffset, dx, dy, dw, dh) {
  if (!img || !ctx) return;
  const col = role % SHEET_COLS;
  const row = ((role / SHEET_COLS) | 0) + bandOffset;
  const sx = col * TILE_ART;
  const sy = row * TILE_ART;
  ctx.drawImage(img, sx, sy, TILE_ART, TILE_ART, dx, dy, dw, dh);
}

function blitRoleFaixa(ctx, img, role, bandOffset, lado, dx, dy, dw, dh) {
  if (!img || !ctx) return;
  const col = role % SHEET_COLS;
  const row = ((role / SHEET_COLS) | 0) + bandOffset;
  const sx0 = col * TILE_ART;
  const sy = row * TILE_ART;
  const srcW = Math.max(3, (TILE_ART * 0.35) | 0);
  const sx = lado === "w" ? sx0 : sx0 + TILE_ART - srcW;
  ctx.drawImage(img, sx, sy, srcW, TILE_ART, dx, dy, dw, dh);
}
