import {
  ESCALA,
  FACE_H,
  FLOOR_ROW_OFFSET,
  ROLE_CENTER,
  SHEET_COLS,
  TERRENO_2D_MARGEM,
  TILE,
  TILE_ART,
} from "../config.js";
import { alturaEm, solidoEm } from "../mundo/altura.js";
import { PROPS } from "../mundo/mapaDemo.js";
import {
  obterAabbCarregado,
  obterBloco,
  onDirty,
} from "../mundo/voxel/storeMundo.js";
import { BLOCO } from "../mundo/voxel/tiposBloco.js";
import { usarGrassOnDirt, usarTiles } from "./atlas.js";
import { coletarPecasColuna } from "./camadasVoxel2d.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import {
  desenharFaceLateralSingle,
  desenharFaceSulSingle,
  desenharTopoGod,
} from "./cliffEmpilhar.js";
import {
  chaveFadeFaceSul,
  chaveFadeLateral,
  chaveFadeProp,
  chaveFadeTopo,
  desenharComFadeCobertura,
} from "./fadeCobertura.js";
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

/** Cache do empilhamento estático (invalida com cull/mundo/debug). */
const _cacheTerreno = { chave: "", itens: [] };
let _geracaoMundo = 0;
let _dirtyOk = false;

function garantirDirtyTerreno() {
  if (_dirtyOk) return;
  _dirtyOk = true;
  onDirty(() => {
    _geracaoMundo++;
    _cacheTerreno.chave = "";
  });
}

function anexarItens(destino, origem) {
  const dest = destino.itens;
  for (let i = 0; i < origem.length; i++) dest.push(origem[i]);
}

/**
 * Terreno 2D — cull pela viewport da câmera quando disponível.
 * @param {{ teto: number, elev: number } | null} visaoCaverna
 *   Se setado, só empilha geometria sob o teto (visão de caverna).
 */
export function empilharTerreno(
  lista,
  atlas,
  debug,
  faceDestaque = null,
  camera = null,
  visaoCaverna = null,
) {
  garantirDirtyTerreno();
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

  const tetoCaverna = visaoCaverna ? visaoCaverna.teto : null;
  const faceCx = faceDestaque ? faceDestaque.cx | 0 : -1;
  const faceCy = faceDestaque ? faceDestaque.cy | 0 : -1;
  const chave =
    x0 +
    "|" +
    y0 +
    "|" +
    x1 +
    "|" +
    y1 +
    "|" +
    (tetoCaverna == null ? "" : tetoCaverna) +
    "|" +
    (debug ? 1 : 0) +
    "|" +
    faceCx +
    "," +
    faceCy +
    "|" +
    _geracaoMundo;

  if (chave === _cacheTerreno.chave && _cacheTerreno.itens.length) {
    anexarItens(lista, _cacheTerreno.itens);
    return;
  }

  const scratch = { itens: [] };
  _cacheTerreno.chave = chave;
  _cacheTerreno.itens = scratch.itens;

  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const pecas = coletarPecasColuna(cx, cy);
      const zSurf = pecas.zSurf;
      if (zSurf <= 0) continue;

      for (let i = 0; i < pecas.topos.length; i++) {
        const zTop = pecas.topos[i];
        if (tetoCaverna != null && zTop > tetoCaverna) continue;
        const naSuperficie = zTop === zSurf;
        const fadeTop = naSuperficie ? chaveFadeTopo(cx, cy) : null;
        empilhar(
          scratch,
          chaveTopo(cy, zTop),
          0,
          (ctx) => {
            if (fadeTop) {
              desenharComFadeCobertura(ctx, fadeTop, () =>
                desenharTopo(ctx, cx, cy, zTop),
              );
            } else {
              desenharTopo(ctx, cx, cy, zTop);
            }
          },
          TIE_TOPO,
          zTop,
        );
      }

      // Face sul = cliff. W/E só no sheet legado (GOD já tem lip no chão).
      empilharFaces(
        scratch,
        pecas.facesS,
        "s",
        cx,
        cy,
        zSurf,
        tetoCaverna,
        faceDestaque,
      );
      if (!usarGrassOnDirt(atlas)) {
        empilharFaces(
          scratch,
          pecas.facesW,
          "w",
          cx,
          cy,
          zSurf,
          tetoCaverna,
          null,
        );
        empilharFaces(
          scratch,
          pecas.facesE,
          "e",
          cx,
          cy,
          zSurf,
          tetoCaverna,
          null,
        );
      }

      if (debug && (tetoCaverna == null || zSurf <= tetoCaverna)) {
        empilhar(
          scratch,
          chaveTopo(cy, zSurf) + 0.0001,
          0,
          (ctx) => desenharDebug(ctx, cx, cy, zSurf),
          9,
          zSurf,
        );
      }
    }
  }

  for (let i = 0; i < PROPS.length; i++) {
    const prop = PROPS[i];
    const px = Math.floor(prop.x);
    const py = Math.floor(prop.y);
    if (px < x0 || px > x1 || py < y0 - 2 || py > y1 + 2) continue;
    const z = alturaEm(px, py);
    if (tetoCaverna != null && z > tetoCaverna) continue;
    const fadeProp = chaveFadeProp(i);
    empilhar(
      scratch,
      chaveEntidade(prop.y, z),
      0,
      (ctx) =>
        desenharComFadeCobertura(ctx, fadeProp, () =>
          desenharProp(ctx, prop, z),
        ),
      TIE_PROP,
      z,
    );
  }

  anexarItens(lista, scratch.itens);
}

/** Empilha faces S/W/E; em caverna corta no teto. */
function empilharFaces(
  lista,
  runs,
  lado,
  cx,
  cy,
  zSurf,
  tetoCaverna,
  faceDestaque,
) {
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    let zBase = run.zBase;
    let zTopo = run.zTopo;
    if (tetoCaverna != null) {
      if (zBase >= tetoCaverna) continue;
      if (zTopo > tetoCaverna) zTopo = tetoCaverna;
    }
    const queda = zTopo - zBase;
    if (queda <= 0) continue;

    const naSuperficie = zTopo === zSurf;

    const destacar =
      lado === "s" &&
      naSuperficie &&
      faceDestaque &&
      faceDestaque.cx === cx &&
      faceDestaque.cy === cy;

    if (lado === "s") {
      const fadeFace = naSuperficie ? chaveFadeFaceSul(cx, cy) : null;
      empilhar(
        lista,
        chaveFaceSul(cy, queda, zTopo),
        0,
        (ctx) => {
          const draw = () =>
            desenharFaceSul(ctx, cx, cy, zTopo, queda, destacar);
          if (fadeFace) desenharComFadeCobertura(ctx, fadeFace, draw);
          else draw();
        },
        TIE_FACE,
        zTopo,
      );
    } else {
      const fadeLat =
        zTopo === zSurf ? chaveFadeLateral(cx, cy, lado) : null;
      empilhar(
        lista,
        chaveFaceLateral(cy, zTopo),
        0,
        (ctx) => {
          const draw = () =>
            desenharFaceLateral(ctx, cx, cy, zTopo, queda, lado);
          if (fadeLat) desenharComFadeCobertura(ctx, fadeLat, draw);
          else draw();
        },
        TIE_LATERAL,
        zTopo,
      );
    }
  }
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

  const bz = z - 1;
  const n = bz < 0 || !solidoEm(cx, cy - 1, bz);
  const sEdge = bz < 0 || !solidoEm(cx, cy + 1, bz);
  const w = bz < 0 || !solidoEm(cx - 1, cy, bz);
  const e = bz < 0 || !solidoEm(cx + 1, cy, bz);
  const f = Math.max(2, ESCALA);
  const borda = bordaDoTopo(z);

  ctx.fillStyle = borda;
  if (n) ctx.fillRect(px, py, s, f);
  if (sEdge) ctx.fillRect(px, py + s - f, s, f);
  if (w) ctx.fillRect(px, py, f, s);
  if (e) ctx.fillRect(px + s - f, py, f, s);
}

function desenharTopoReal(ctx, cx, cy, z) {
  if (usarGrassOnDirt(_atlas)) {
    desenharTopoGod(ctx, _atlas, cx, cy, z);
    return;
  }

  const px = mundoParaTelaX(cx);
  const py = mundoParaTelaY(cy, z);
  const s = TILE * ESCALA;
  // +1 overlap tapa fresta entre células (zoom/câmera).
  const dw = s + 1;
  const dh = s + 1;
  const id = z > 0 ? obterBloco(cx, cy, z - 1) : BLOCO.AR;
  const img =
    id === BLOCO.TERRA || id === BLOCO.PEDRA || z >= 2
      ? _atlas.terra || _atlas.grama
      : _atlas.grama;
  blitRole(ctx, img, ROLE_CENTER, FLOOR_ROW_OFFSET, px, py, dw, dh);
}

function desenharFaceSul(ctx, cx, cy, z, queda, destacar = false) {
  if (usarTiles(_atlas)) {
    desenharFaceSulSingle(ctx, _atlas, cx, cy, z, queda, destacar);
    return;
  }
  desenharFaceSulProcedural(ctx, cx, cy, z, queda, destacar);
}

function desenharFaceSulProcedural(ctx, cx, cy, z, queda, destacar = false) {
  const px = mundoParaTelaX(cx);
  const topY = mundoParaTelaY(cy, z);
  const w = TILE * ESCALA;
  const h = queda * FACE_H * ESCALA;
  const py = topY + TILE * ESCALA - 1;

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

function desenharFaceLateral(ctx, cx, cy, z, queda, lado) {
  if (usarTiles(_atlas)) {
    desenharFaceLateralSingle(ctx, _atlas, cx, cy, z, queda, lado);
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
  const y0 = topY + s;

  ctx.fillStyle = CORES.faceLateral;
  ctx.fillRect(x, y0, faixa, h);

  ctx.fillStyle = CORES.faceSombra;
  ctx.fillRect(lado === "w" ? x : x + faixa - 1, y0, 1, h);
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
    ctx.drawImage(img, px - dw * 0.5, py - dh + 2 * ESCALA, dw, dh);
    return true;
  }

  if (prop.tipo === "mata" && _atlas.mata) {
    const img = _atlas.mata;
    const dw = img.width * ESCALA * 1.5;
    const dh = img.height * ESCALA * 1.5;
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
  ctx.drawImage(img, sx, sy, TILE_ART, TILE_ART, dx, dy, dw, dh);
}
