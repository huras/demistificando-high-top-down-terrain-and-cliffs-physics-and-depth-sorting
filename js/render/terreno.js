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
import { vegetacaoNaArea } from "../mundo/bioma/propsBioma.js";
import { cssBioma } from "../mundo/bioma/tinta.js";
import { kitDoRelevo } from "../mundo/bioma/catalogo.js";
import {
  obterAabbCarregado,
  obterBloco,
  onDirty,
} from "../mundo/voxel/storeMundo.js";
import { BLOCO } from "../mundo/voxel/tiposBloco.js";
import { usarGrassOnDirt, usarTiles } from "./atlas.js";
import { caixaDoProp, desenhoDoProp, imagemDoProp } from "./propSprite.js";
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
  chaveSobreTopo,
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
    _geracaoMundo +
    "|" +
    seloImagensProp(atlas);

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
    empilharProp(scratch, prop, z, chaveFadeProp(i), tetoCaverna);
  }

  const plantas = vegetacaoNaArea(x0, y0, x1, y1);
  for (let i = 0; i < plantas.length; i++) {
    const prop = plantas[i];
    const px = Math.floor(prop.x);
    const py = Math.floor(prop.y);
    const z = alturaEm(px, py);
    if (tetoCaverna != null && z > tetoCaverna) continue;
    empilharProp(scratch, prop, z, `pb:${prop.id}`, tetoCaverna);
  }

  anexarItens(lista, scratch.itens);
}

/**
 * Quantas imagens de prop já têm largura. Entra na chave do cache:
 * um rebuild com PNG 0×0 não pode gravar "não cruza" para sempre.
 * Quando todas estão prontas, a contagem de chaves basta.
 */
let _seloAtlas = null;
let _seloContagem = -1;
let _seloProntas = -1;
let _seloValor = 0;

function seloImagensProp(atlas) {
  if (!atlas) return 0;
  const sprites = atlas.sprites;
  let contagem = 0;
  if (sprites) {
    for (const id in sprites) {
      if (Object.prototype.hasOwnProperty.call(sprites, id)) contagem++;
    }
  }
  const extra = (imagemPronta(atlas.arvore) ? 2 : 0) | (imagemPronta(atlas.mata) ? 1 : 0);
  if (
    atlas === _seloAtlas &&
    contagem === _seloContagem &&
    _seloProntas === contagem &&
    extra === (_seloValor & 3)
  ) {
    return _seloValor;
  }
  let prontas = 0;
  if (sprites) {
    for (const id in sprites) {
      if (!Object.prototype.hasOwnProperty.call(sprites, id)) continue;
      if (imagemPronta(sprites[id])) prontas++;
    }
  }
  _seloAtlas = atlas;
  _seloContagem = contagem;
  _seloProntas = prontas;
  _seloValor = (prontas << 2) | extra;
  return _seloValor;
}

function imagemPronta(img) {
  return (img?.naturalWidth || img?.width || 0) > 0;
}

/** Draw base na chave da entidade, mais um restore por fileira de topo que corta o sprite. */
function empilharProp(lista, prop, z, fadeChave, tetoCaverna) {
  const desenhar = (ctx) =>
    desenharComFadeCobertura(ctx, fadeChave, () => desenharProp(ctx, prop, z));
  empilhar(lista, chaveEntidade(prop.y, z), 0, desenhar, TIE_PROP, z);
  if (prop.tipo === "placa") return;
  empilharRestoreSobreTopos(lista, prop, z, desenhar, tetoCaverna);
}

/**
 * Repinta o sprite só dentro dos topos de mesmo z que desenham depois dele.
 * Um item por fileira, no vão de chaveSobreTopo, para o personagem nessa
 * fileira e a face do cliff continuarem por cima.
 */
function empilharRestoreSobreTopos(lista, prop, z, desenhar, tetoCaverna) {
  const px = mundoParaTelaX(prop.x);
  const py = mundoParaTelaY(prop.y, z);
  const caixa = caixaDoProp(prop, px, py, _atlas);
  if (!caixa || caixa.x1 <= caixa.x0 || caixa.y1 <= caixa.y0) return;

  const s = TILE * ESCALA;
  const chaveBase = chaveEntidade(prop.y, z);
  const x0 = Math.floor(caixa.x0 / s);
  const x1 = Math.floor((caixa.x1 - 1e-4) / s);
  const yMund0 = (caixa.y0 / ESCALA + z * FACE_H) / TILE;
  const yMund1 = (caixa.y1 / ESCALA + z * FACE_H) / TILE;
  let cy0 = Math.floor(yMund0);
  const cy1 = Math.floor(yMund1 - 1e-4);
  const cyMin = Math.floor(prop.y) + 1;
  if (cy0 < cyMin) cy0 = cyMin;
  if (cy0 > cy1 || x0 > x1) return;

  for (let cy = cy0; cy <= cy1; cy++) {
    if (!(chaveTopo(cy, z) > chaveBase)) continue;
    let celulas = null;
    for (let cx = x0; cx <= x1; cx++) {
      if (!retangulosCruzam(caixa, retanguloTopo(cx, cy, z, s))) continue;
      if (!colunaTemTopo(cx, cy, z, tetoCaverna)) continue;
      if (!celulas) celulas = [];
      celulas.push({ cx, cy, z });
    }
    if (!celulas) continue;
    const clipados = celulas;
    empilhar(
      lista,
      chaveSobreTopo(cy, z),
      0,
      (ctx) => {
        ctx.save();
        clipToposProp(ctx, clipados, s);
        desenhar(ctx);
        ctx.restore();
      },
      TIE_PROP,
      z,
    );
  }
}

function colunaTemTopo(cx, cy, z, tetoCaverna) {
  if (tetoCaverna != null && z > tetoCaverna) return false;
  const topos = coletarPecasColuna(cx, cy).topos;
  for (let i = 0; i < topos.length; i++) {
    if (topos[i] === z) return true;
  }
  return false;
}

function retanguloTopo(cx, cy, z, s) {
  let px = mundoParaTelaX(cx);
  let py = mundoParaTelaY(cy, z);
  if (usarTiles(_atlas)) {
    px = Math.round(px);
    py = Math.round(py);
  }
  return { x0: px, y0: py, x1: px + s, y1: py + s };
}

function retangulosCruzam(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

function clipToposProp(ctx, celulas, s) {
  ctx.beginPath();
  const arredondar = usarTiles(_atlas);
  for (let i = 0; i < celulas.length; i++) {
    const t = celulas[i];
    let px = mundoParaTelaX(t.cx);
    let py = mundoParaTelaY(t.cy, t.z);
    if (arredondar) {
      px = Math.round(px);
      py = Math.round(py);
    }
    ctx.rect(px, py, s, s);
  }
  ctx.clip();
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

function lavarBioma(ctx, x, y, w, h, wx, wy, parede) {
  if (w <= 0 || h <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.globalAlpha *= parede ? 0.74 : 0.6;
  ctx.fillStyle = cssBioma(wx, wy, parede, 1);
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function desenharTopo(ctx, cx, cy, z) {
  const tiles = usarTiles(_atlas);
  if (tiles) desenharTopoReal(ctx, cx, cy, z);
  else desenharTopoProcedural(ctx, cx, cy, z);
  const s = TILE * ESCALA;
  const px = tiles ? Math.round(mundoParaTelaX(cx)) : mundoParaTelaX(cx);
  const py = tiles ? Math.round(mundoParaTelaY(cy, z)) : mundoParaTelaY(cy, z);
  lavarBioma(ctx, px, py, s, s, cx, cy, false);
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

  const px = Math.round(mundoParaTelaX(cx));
  const py = Math.round(mundoParaTelaY(cy, z));
  const s = TILE * ESCALA;
  // Sem bleed pro vizinho — câmera já snapa em pixels; overlap gerava linha nas bordas.
  const id = z > 0 ? obterBloco(cx, cy, z - 1) : BLOCO.AR;
  const img =
    id === BLOCO.TERRA || id === BLOCO.PEDRA || z >= 2
      ? _atlas.terra || _atlas.grama
      : _atlas.grama;
  blitRole(ctx, img, ROLE_CENTER, FLOOR_ROW_OFFSET, px, py, s, s);
}

function desenharFaceSul(ctx, cx, cy, z, queda, destacar = false) {
  if (queda < 1) return;
  const tiles = usarTiles(_atlas);
  if (tiles) desenharFaceSulSingle(ctx, _atlas, cx, cy, z, queda, destacar);
  else   desenharFaceSulProcedural(ctx, cx, cy, z, queda, destacar);
  const px = tiles ? Math.round(mundoParaTelaX(cx)) : mundoParaTelaX(cx);
  const topY = tiles ? Math.round(mundoParaTelaY(cy, z)) : mundoParaTelaY(cy, z);
  const w = TILE * ESCALA;
  const h = queda * FACE_H * ESCALA;
  if (!_atlas?.cliffs?.[kitDoRelevo(cx, cy)]) {
    lavarBioma(ctx, px, topY + w - 1, w, h, cx, cy, true);
  }
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
  if (queda < 1) return;
  if (usarTiles(_atlas)) {
    if (usarGrassOnDirt(_atlas)) return;
    desenharFaceLateralSingle(ctx, _atlas, cx, cy, z, queda, lado);
  } else {
    desenharFaceLateralProcedural(ctx, cx, cy, z, queda, lado);
  }
  const px = mundoParaTelaX(cx);
  const topY = mundoParaTelaY(cy, z);
  const s = TILE * ESCALA;
  const faixa = Math.max(5, ESCALA * 3);
  const x = lado === "w" ? px : px + s - faixa;
  const h = queda * FACE_H * ESCALA;
  lavarBioma(ctx, x, topY + s - 1, faixa, h, cx, cy, true);
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
  const img = imagemDoProp(prop, _atlas);
  if (!img) return false;
  const { escala, fracaoBase } = desenhoDoProp(prop);
  const dw = img.width * ESCALA * escala;
  const dh = img.height * ESCALA * escala;
  const px = mundoParaTelaX(prop.x);
  const py = mundoParaTelaY(prop.y, z);
  ctx.drawImage(img, px - dw * 0.5, py - dh * (1 - fracaoBase), dw, dh);
  return true;
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
