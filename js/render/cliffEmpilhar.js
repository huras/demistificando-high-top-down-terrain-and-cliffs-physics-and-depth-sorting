/**
 * Cliffs por célula — grass-on-dirt usa *_UNDER; legado usa EDGE_S/OUT_*.
 * Laterais W/E: só no sheet legado (faixa); no GOD o lip já está no chão.
 */
import {
  ESCALA,
  FACE_H,
  FLOOR_ROW_OFFSET,
  GOD_CENTER,
  GOD_COLS,
  GOD_EDGE_S_UNDER,
  GOD_OUT_SE_UNDER,
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
import { alturaEm } from "../mundo/altura.js";
import { sheetCliffDoAtlas, usarGrassOnDirt } from "./atlas.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";

/**
 * Face sul: empilha um tile de cliff por degrau.
 */
export function desenharFaceSulSingle(ctx, atlas, cx, cy, zTopo, queda, destacar) {
  if (queda < 1) return;

  const px = mundoParaTelaX(cx);
  const topY = mundoParaTelaY(cy, zTopo);
  const w = TILE * ESCALA;
  const step = FACE_H * ESCALA;
  const py0 = topY + TILE * ESCALA + 1;

  if (usarGrassOnDirt(atlas)) {
    // Base de chão no mesmo retângulo da face (alpha do UNDER); não é topo.
    const role = papelUnderGod(cx, cy, zTopo);
    const sheet = atlas.grassOnDirt;
    for (let i = 0; i < queda; i++) {
      const dy = py0 + i * step;
      blitGod(ctx, sheet, GOD_CENTER, px, dy, w, step);
      blitGod(ctx, sheet, role, px, dy, w, step);
    }
  } else {
    const sheet = sheetCliffDoAtlas(atlas);
    if (!sheet) return;
    const role = papelLabioSulLegado(cx, cy, zTopo);
    const chao =
      zTopo >= 2 && atlas.terra ? atlas.terra : atlas.grama || atlas.terra;
    for (let i = 0; i < queda; i++) {
      const dy = py0 + i * step;
      if (chao) blitRole(ctx, chao, ROLE_CENTER, FLOOR_ROW_OFFSET, px, dy, w, step);
      blitRole(ctx, sheet, role, 0, px, dy, w, step);
    }
  }

  if (destacar) {
    ctx.strokeStyle = "rgba(255, 220, 80, 0.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py0 + 1, w - 2, queda * step - 2);
  }
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
    const dy = topY + s + i * step;
    if (chao) {
      blitRoleFaixa(ctx, chao, ROLE_CENTER, FLOOR_ROW_OFFSET, lado, x, dy, faixa, step);
    }
    blitRoleFaixa(ctx, sheet, role, 0, lado, x, dy, faixa, step);
  }
}

function papelUnderGod(cx, cy, zTopo) {
  const wHigh = alturaEm(cx - 1, cy) >= zTopo;
  const eHigh = alturaEm(cx + 1, cy) >= zTopo;
  if (eHigh && !wHigh) return GOD_OUT_SW_UNDER;
  if (wHigh && !eHigh) return GOD_OUT_SE_UNDER;
  return GOD_EDGE_S_UNDER;
}

function papelLabioSulLegado(cx, cy, zTopo) {
  const wHigh = alturaEm(cx - 1, cy) >= zTopo;
  const eHigh = alturaEm(cx + 1, cy) >= zTopo;
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
