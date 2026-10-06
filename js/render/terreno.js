import {
  ESCALA,
  FACE_H,
  FLOOR_ROW_OFFSET,
  ROLE_CENTER,
  ROLE_CLIFF_CENTER,
  ROLE_EDGE_E,
  ROLE_EDGE_S,
  ROLE_EDGE_S_UNDER,
  ROLE_EDGE_W,
  SHEET_COLS,
  TERRENO_2D_MARGEM,
  TILE,
  TILE_ART,
} from "../config.js";
import { alturaEm, solidoEm } from "../mundo/altura.js";
import { PROPS } from "../mundo/mapaDemo.js";
import { obterAabbCarregado, obterBloco } from "../mundo/voxel/storeMundo.js";
import { BLOCO } from "../mundo/voxel/tiposBloco.js";
import { usarTiles } from "./atlas.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import {
  chaveEntidade,
  chaveFaceLateral,
  chaveFaceSul,
  chaveTopo,
  empilhar,
} from "./ordenacaoProfundidade.js";
import { bordaDoTopo, CORES, coresDoTopo } from "./paleta.js";

const TIE_TOPO = 0;
const TIE_FACE = 1;
const TIE_LATERAL = 2;
const TIE_PROP = 3;
const FOLGA_Z = 20;

let _atlas = null;

/**
 * Terreno 2D — cull pela viewport da câmera quando disponível.
 */
export function empilharTerreno(lista, atlas, debug, faceDestaque = null, camera = null) {
  _atlas = atlas;
  const aabb = obterAabbCarregado();
  let x0 = aabb.x0 | 0;
  let y0 = aabb.y0 | 0;
  let x1 = aabb.x1 | 0;
  let y1 = aabb.y1 | 0;

  if (camera) {
    const viewW = camera.largura / camera.zoom;
    const viewH = camera.altura / camera.zoom;
    const m = TERRENO_2D_MARGEM;
    const inv = 1 / (TILE * ESCALA);
    x0 = Math.max(x0, Math.floor(camera.x * inv) - m);
    x1 = Math.min(x1, Math.ceil((camera.x + viewW) * inv) + m);
    y0 = Math.max(y0, Math.floor(camera.y * inv) - m);
    y1 = Math.min(y1, Math.ceil((camera.y + viewH) * inv) + FOLGA_Z + m);
  }

  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const z = alturaEm(cx, cy);
      if (z <= 0) continue;

      // topo: ar na célula de índice = walk height (acima do bloco z-1)
      if (z > 0 && !solidoEm(cx, cy, z)) {
        const sortTop = chaveTopo(cy, z);
        empilhar(lista, sortTop, 0, (ctx) => desenharTopo(ctx, cx, cy, z), TIE_TOPO, z);
      }

      const quedaS = contarQuedaFace(cx, cy, z, 0, 1);
      if (quedaS > 0) {
        const sortFace = chaveFaceSul(cy, quedaS, z);
        const destacar =
          faceDestaque && faceDestaque.cx === cx && faceDestaque.cy === cy;
        empilhar(
          lista,
          sortFace,
          0,
          (ctx) => desenharFaceSul(ctx, cx, cy, z, quedaS, destacar),
          TIE_FACE,
          z,
        );
      }

      const dzW = contarQuedaFace(cx, cy, z, -1, 0);
      const dzE = contarQuedaFace(cx, cy, z, 1, 0);
      if (dzW > 0) {
        empilhar(
          lista,
          chaveFaceLateral(cy, z),
          0,
          (ctx) => desenharFaceLateral(ctx, cx, cy, z, dzW, "w"),
          TIE_LATERAL,
          z,
        );
      }
      if (dzE > 0) {
        empilhar(
          lista,
          chaveFaceLateral(cy, z),
          0,
          (ctx) => desenharFaceLateral(ctx, cx, cy, z, dzE, "e"),
          TIE_LATERAL,
          z,
        );
      }

      if (debug) {
        empilhar(
          lista,
          chaveTopo(cy, z) + 0.0001,
          0,
          (ctx) => desenharDebug(ctx, cx, cy, z),
          9,
          z,
        );
      }
    }
  }

  for (const prop of PROPS) {
    const px = Math.floor(prop.x);
    const py = Math.floor(prop.y);
    if (px < x0 || px > x1 || py < y0 - 2 || py > y1 + 2) continue;
    const z = alturaEm(px, py);
    empilhar(
      lista,
      chaveEntidade(prop.y, z),
      0,
      (ctx) => desenharProp(ctx, prop, z),
      TIE_PROP,
      z,
    );
  }
}

/** Queda visual: quantos degraus de face até o vizinho (compat heightmap). */
function contarQuedaFace(cx, cy, z, dx, dy) {
  const zn = alturaEm(cx + dx, cy + dy);
  const queda = z - zn;
  return queda > 0 ? queda : 0;
}

function desenharTopo(ctx, cx, cy, z) {
  if (usarTiles(_atlas)) {
    desenharTopoReal(ctx, cx, cy, z);
    return;
  }
  desenharTopoProcedural(ctx, cx, cy, z);
}

function desenharTopoProcedural(ctx, cx, cy, z) {
  const px = mundoParaTelaX(cx);
  const py = mundoParaTelaY(cy, z);
  const s = TILE * ESCALA;
  const cores = coresDoTopo(z);

  ctx.fillStyle = (cx + cy) & 1 ? cores.a : cores.b;
  ctx.fillRect(px, py, s, s);

  ctx.fillStyle = CORES.grade;
  ctx.fillRect(px, py + s - 1, s, 1);
  ctx.fillRect(px + s - 1, py, 1, s);

  const n = alturaEm(cx, cy - 1) < z;
  const sEdge = alturaEm(cx, cy + 1) < z;
  const w = alturaEm(cx - 1, cy) < z;
  const e = alturaEm(cx + 1, cy) < z;
  const f = Math.max(2, ESCALA);
  const borda = bordaDoTopo(z);

  ctx.fillStyle = borda;
  if (n) ctx.fillRect(px, py, s, f);
  if (sEdge) ctx.fillRect(px, py + s - f, s, f);
  if (w) ctx.fillRect(px, py, f, s);
  if (e) ctx.fillRect(px + s - f, py, f, s);
}

function desenharTopoReal(ctx, cx, cy, z) {
  const px = mundoParaTelaX(cx);
  const py = mundoParaTelaY(cy, z);
  const s = TILE * ESCALA;
  // bloco de superfície = z-1
  const id = z > 0 ? obterBloco(cx, cy, z - 1) : BLOCO.AR;
  const img =
    id === BLOCO.TERRA || id === BLOCO.PEDRA || z >= 2
      ? _atlas.terra || _atlas.grama
      : _atlas.grama;
  blitRole(ctx, img, ROLE_CENTER, FLOOR_ROW_OFFSET, px, py, s, s);
}

function desenharFaceSul(ctx, cx, cy, z, queda, destacar = false) {
  if (usarTiles(_atlas)) {
    desenharFaceSulReal(ctx, cx, cy, z, queda, destacar);
    return;
  }
  desenharFaceSulProcedural(ctx, cx, cy, z, queda, destacar);
}

function desenharFaceSulProcedural(ctx, cx, cy, z, queda, destacar = false) {
  const px = mundoParaTelaX(cx);
  const topY = mundoParaTelaY(cy, z);
  const w = TILE * ESCALA;
  const h = queda * FACE_H * ESCALA;
  // 1px abaixo do topo — topo é autoridade da aresta
  const py = topY + TILE * ESCALA + 1;

  const faixa = Math.max(3, ESCALA * 2);
  for (let y = 0; y < h; y += faixa) {
    ctx.fillStyle = (y / faixa) & 1 ? CORES.faceTopo : CORES.faceMeio;
    ctx.fillRect(px, py + y, w, Math.min(faixa, h - y));
  }

  ctx.fillStyle = CORES.faceBase;
  ctx.fillRect(px, py + h - Math.max(2, ESCALA), w, Math.max(2, ESCALA));

  const borda = Math.max(2, ESCALA);
  ctx.fillStyle = CORES.faceSombra;
  if (alturaEm(cx - 1, cy) < z) ctx.fillRect(px, py, borda, h);
  if (alturaEm(cx + 1, cy) < z) ctx.fillRect(px + w - borda, py, borda, h);

  if (destacar) {
    ctx.strokeStyle = "rgba(255, 220, 80, 0.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, w - 2, h - 2);
  }
}

function desenharFaceSulReal(ctx, cx, cy, z, queda, destacar = false) {
  const px = mundoParaTelaX(cx);
  const topY = mundoParaTelaY(cy, z);
  const w = TILE * ESCALA;
  const step = FACE_H * ESCALA;
  // topo autoridade: face começa sob o tile (+1px)
  const py0 = topY + TILE * ESCALA + 1;
  const sheet =
    queda >= 2 && _atlas.cliffDuplo
      ? _atlas.cliffDuplo
      : _atlas.cliffSimples || _atlas.cliffDuplo;
  const chao = z >= 2 && _atlas.terra ? _atlas.terra : _atlas.grama;

  for (let i = 0; i < queda; i++) {
    let role = ROLE_EDGE_S;
    if (queda > 1) {
      if (i === 0) role = ROLE_EDGE_S;
      else if (i === queda - 1 && sheet === _atlas.cliffDuplo) role = ROLE_EDGE_S_UNDER;
      else role = ROLE_CLIFF_CENTER;
    }
    if (role === ROLE_EDGE_S_UNDER && sheet !== _atlas.cliffDuplo) {
      role = ROLE_EDGE_S;
    }
    const dy = py0 + i * step;
    blitRole(ctx, chao, ROLE_CENTER, FLOOR_ROW_OFFSET, px, dy, w, step);
    // crop 1px do lip do ROLE_EDGE_S no primeiro degrau
    if (i === 0) {
      blitRoleCropTopo(ctx, sheet, role, 0, px, dy, w, step, 1);
    } else {
      blitRole(ctx, sheet, role, 0, px, dy, w, step);
    }
  }

  if (destacar) {
    const h = queda * step;
    ctx.strokeStyle = "rgba(255, 220, 80, 0.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py0 + 1, w - 2, h - 2);
  }
}

function desenharFaceLateral(ctx, cx, cy, z, queda, lado) {
  if (usarTiles(_atlas)) {
    desenharFaceLateralReal(ctx, cx, cy, z, queda, lado);
    return;
  }
  desenharFaceLateralProcedural(ctx, cx, cy, z, queda, lado);
}

function desenharFaceLateralProcedural(ctx, cx, cy, z, queda, lado) {
  const px = mundoParaTelaX(cx);
  const topY = mundoParaTelaY(cy, z);
  const s = TILE * ESCALA;
  const h = queda * FACE_H * ESCALA;
  const faixa = Math.max(5, ESCALA * 3);
  const x = lado === "w" ? px : px + s - faixa;
  // só a parede — não overdrawa o topo
  const y0 = topY + s;

  ctx.fillStyle = CORES.faceLateral;
  ctx.fillRect(x, y0, faixa, h);

  ctx.fillStyle = CORES.faceSombra;
  ctx.fillRect(lado === "w" ? x : x + faixa - 1, y0, 1, h);
}

function desenharFaceLateralReal(ctx, cx, cy, z, queda, lado) {
  const px = mundoParaTelaX(cx);
  const topY = mundoParaTelaY(cy, z);
  const s = TILE * ESCALA;
  const step = FACE_H * ESCALA;
  const faixa = Math.max(5, ESCALA * 3);
  const x = lado === "w" ? px : px + s - faixa;
  const sheet = _atlas.cliffDuplo || _atlas.cliffSimples;
  const role = lado === "w" ? ROLE_EDGE_W : ROLE_EDGE_E;
  const chao = z >= 2 && _atlas.terra ? _atlas.terra : _atlas.grama;

  // só parede (começa sob o topo)
  for (let i = 0; i < queda; i++) {
    const dy = topY + s + i * step;
    blitRoleFaixa(ctx, chao, ROLE_CENTER, FLOOR_ROW_OFFSET, lado, x, dy, faixa, step);
    blitRoleFaixa(ctx, sheet, role, 0, lado, x, dy, faixa, step);
  }
}

function desenharProp(ctx, prop, z) {
  if (usarTiles(_atlas) && prop.tipo !== "placa") {
    if (desenharPropReal(ctx, prop, z)) return;
  }
  desenharPropProcedural(ctx, prop, z);
}

function desenharPropReal(ctx, prop, z) {
  const px = mundoParaTelaX(prop.x);
  const py = mundoParaTelaY(prop.y, z);

  if (prop.tipo === "arvore" && _atlas.arvore) {
    const img = _atlas.arvore;
    const dw = img.width * ESCALA;
    const dh = img.height * ESCALA;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, px - dw * 0.5, py - dh + 2 * ESCALA, dw, dh);
    return true;
  }

  if (prop.tipo === "mata" && _atlas.mata) {
    const img = _atlas.mata;
    const dw = img.width * ESCALA * 1.5;
    const dh = img.height * ESCALA * 1.5;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, px - dw * 0.5, py - dh + ESCALA, dw, dh);
    return true;
  }

  return false;
}

function desenharPropProcedural(ctx, prop, z) {
  const px = mundoParaTelaX(prop.x);
  const py = mundoParaTelaY(prop.y, z);

  if (prop.tipo === "arvore") {
    ctx.fillStyle = "#5a3a22";
    ctx.fillRect(px - 3, py - 18, 6, 20);
    ctx.fillStyle = "#2f7a3a";
    ctx.beginPath();
    ctx.arc(px, py - 22, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3f9a4a";
    ctx.beginPath();
    ctx.arc(px - 5, py - 26, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (prop.tipo === "mata") {
    ctx.fillStyle = "#2a6a32";
    ctx.fillRect(px - 6, py - 10, 12, 10);
    ctx.fillStyle = "#3f9a4a";
    ctx.fillRect(px - 4, py - 14, 8, 6);
  } else if (prop.tipo === "placa") {
    ctx.fillStyle = "#6b4a2a";
    ctx.fillRect(px - 2, py - 14, 4, 14);
    ctx.fillStyle = "#d8c27a";
    ctx.fillRect(px - 14, py - 28, 28, 14);
    ctx.fillStyle = "#333";
    ctx.font = "7px monospace";
    const texto = prop.texto || "3→1";
    ctx.fillText(texto, px - 12, py - 18);
  } else {
    ctx.fillStyle = "#7a6a5a";
    ctx.beginPath();
    ctx.ellipse(px, py - 2, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9a8a78";
    ctx.beginPath();
    ctx.ellipse(px - 2, py - 4, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function desenharDebug(ctx, cx, cy, z) {
  const px = mundoParaTelaX(cx);
  const py = mundoParaTelaY(cy, z);
  const s = TILE * ESCALA;
  ctx.strokeStyle = CORES.debugStroke;
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
  ctx.fillStyle = CORES.debug;
  ctx.font = "8px monospace";
  ctx.fillText(`${cx}`, px + 2, py + 9);
  ctx.fillText(`${cy}`, px + 2, py + 17);
  ctx.fillText(`${z}`, px + 2, py + 25);
}

function blitRole(ctx, img, role, bandOffset, dx, dy, dw, dh) {
  if (!img) return;
  const col = role % SHEET_COLS;
  const row = Math.floor(role / SHEET_COLS) + bandOffset;
  const sx = col * TILE_ART;
  const sy = row * TILE_ART;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, TILE_ART, TILE_ART, dx, dy, dw, dh);
}

/** Recorta N px do topo do tile (remove lip duplicado). */
function blitRoleCropTopo(ctx, img, role, bandOffset, dx, dy, dw, dh, cropPx) {
  if (!img) return;
  const col = role % SHEET_COLS;
  const row = Math.floor(role / SHEET_COLS) + bandOffset;
  const sx = col * TILE_ART;
  const sy = row * TILE_ART + cropPx;
  const srcH = TILE_ART - cropPx;
  const dstCrop = (cropPx / TILE_ART) * dh;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, TILE_ART, srcH, dx, dy + dstCrop, dw, dh - dstCrop);
}

function blitRoleFaixa(ctx, img, role, bandOffset, lado, dx, dy, dw, dh) {
  if (!img) return;
  const col = role % SHEET_COLS;
  const row = Math.floor(role / SHEET_COLS) + bandOffset;
  const sx0 = col * TILE_ART;
  const sy = row * TILE_ART;
  const srcW = Math.max(3, Math.round(TILE_ART * 0.35));
  const sx = lado === "w" ? sx0 : sx0 + TILE_ART - srcW;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, srcW, TILE_ART, dx, dy, dw, dh);
}
