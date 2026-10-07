/**
 * Empilha cliffs single no dual-grid.
 * Cada degrau de altura = 1 camada do sheet 5x3 (double = 2 singles, etc.).
 */
import {
  ESCALA,
  FACE_H,
  FLOOR_ROW_OFFSET,
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
import { obterBloco } from "../mundo/voxel/storeMundo.js";
import { BLOCO } from "../mundo/voxel/tiposBloco.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import {
  CANTOS_DUAL,
  amostrarCantos,
  idDoRole,
  indiceCantoAlto,
  mascaraDosCantos,
  ROLE_SUL,
  rolesDaMascara,
  sheetCliffDoAtlas,
} from "./cliffDualGrid.js";
import { chaveProfundidade, empilhar } from "./ordenacaoProfundidade.js";

const TIE_CLIFF = 1;
/** Neste pack single, IN_NE/IN_NW sao magenta puro — pular evita underfill fantasma. */
const ROLE_VAZIO_SINGLE = Object.freeze({ IN_NE: true, IN_NW: true });

/**
 * @param {object} lista
 * @param {object} atlas
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {number | null} tetoCaverna
 * @param {{ cx: number, cy: number } | null} faceDestaque
 */
export function empilharCliffsSimples(
  lista,
  atlas,
  x0,
  y0,
  x1,
  y1,
  tetoCaverna,
  faceDestaque,
) {
  const sheet = sheetCliffDoAtlas(atlas);
  if (!sheet || !lista) return;

  const s = TILE * ESCALA;
  const chaoGrama = atlas.grama;
  const chaoTerra = atlas.terra || atlas.grama;

  for (let vy = y0; vy <= y1 + 1; vy++) {
    for (let vx = x0; vx <= x1 + 1; vx++) {
      const amostra = amostrarCantos(vx, vy, alturaEm);
      if (!amostra) continue;

      const { h, max } = amostra;
      const wx = vx - 0.5;
      const wy = vy - 0.5;

      // Cada nivel com silhueta = uma camada single empilhada.
      for (let nivel = 1; nivel <= max; nivel++) {
        if (tetoCaverna != null && nivel > tetoCaverna) continue;
        const mask = mascaraDosCantos(h, nivel);
        const roles = rolesDaMascara(mask);
        if (!roles) continue;

        const iAlto = indiceCantoAlto(h, nivel);
        const chao = escolherChao(chaoGrama, chaoTerra, vx, vy, iAlto, nivel);

        // Camada sul mais baixa deste vertice? Half-cell deixa vao de 0.5 tile
        // ate o chao — fundo #0a100c vazava (nao e sombra).
        const maskAbaixo = nivel > 1 ? mascaraDosCantos(h, nivel - 1) : 0;
        const rolesAbaixo = rolesDaMascara(maskAbaixo);
        const sulMaisBaixa = !temRoleSul(rolesAbaixo);

        for (let r = 0; r < roles.length; r++) {
          const nome = roles[r];
          if (ROLE_VAZIO_SINGLE[nome]) continue;
          const roleId = idDoRole(nome);
          if (roleId < 0) continue;

          const eSul = !!ROLE_SUL[nome];
          const destacar =
            !!faceDestaque &&
            eSul &&
            (faceDestaque.cx === vx - 1 || faceDestaque.cx === vx) &&
            faceDestaque.cy === vy - 1;

          const chaoVao = eSul && sulMaisBaixa
            ? escolherChaoBaixo(chaoGrama, chaoTerra, vx, vy, h, nivel)
            : null;

          empilhar(
            lista,
            chaveProfundidade(wy + 0.97, nivel),
            0,
            criarDesenhoCamada(
              sheet,
              chao,
              roleId,
              wx,
              wy,
              nivel,
              s,
              destacar,
              eSul && sulMaisBaixa,
              chaoVao,
            ),
            TIE_CLIFF,
            nivel,
          );
        }
      }
    }
  }
}

function temRoleSul(roles) {
  if (!roles) return false;
  for (let i = 0; i < roles.length; i++) {
    if (ROLE_SUL[roles[i]]) return true;
  }
  return false;
}

/**
 * Face sul de caverna: empilha o mesmo single (EDGE_S / cantos) por degrau.
 */
export function desenharFaceSulSingle(ctx, atlas, cx, cy, zTopo, queda, destacar) {
  const sheet = sheetCliffDoAtlas(atlas);
  if (!sheet || queda < 1) return;

  const px = mundoParaTelaX(cx);
  const topY = mundoParaTelaY(cy, zTopo);
  const w = TILE * ESCALA;
  const step = FACE_H * ESCALA;
  const py0 = topY + TILE * ESCALA + 1;
  const role = papelLabioSulCell(cx, cy, zTopo);
  const chao =
    zTopo >= 2 && atlas.terra ? atlas.terra : atlas.grama || atlas.terra;

  for (let i = 0; i < queda; i++) {
    const dy = py0 + i * step;
    if (chao) blitRole(ctx, chao, ROLE_CENTER, FLOOR_ROW_OFFSET, px, dy, w, step);
    blitRole(ctx, sheet, role, 0, px, dy, w, step);
  }

  if (destacar) {
    ctx.strokeStyle = "rgba(255, 220, 80, 0.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py0 + 1, w - 2, queda * step - 2);
  }
}

/** Faixa lateral W/E — recorte do EDGE_W/E single, empilhado. */
export function desenharFaceLateralSingle(ctx, atlas, cx, cy, zTopo, queda, lado) {
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

function criarDesenhoCamada(
  sheet,
  chao,
  roleId,
  wx,
  wy,
  z,
  s,
  destacar,
  preencherVaoSul,
  chaoVao,
) {
  return (ctx) => {
    const px = mundoParaTelaX(wx);
    const py = mundoParaTelaY(wy, z);
    // Magenta do single → chao do plato alto (bake Pokemon AI).
    if (chao) blitRole(ctx, chao, ROLE_CENTER, FLOOR_ROW_OFFSET, px, py, s, s);
    blitRole(ctx, sheet, roleId, 0, px, py, s, s);

    // Dual-grid half-cell: fundo da pilha sul fica 0.5 tile acima do chao baixo.
    if (preencherVaoSul) {
      const gap = s >> 1;
      const dy = py + s;
      if (chaoVao) {
        blitRole(ctx, chaoVao, ROLE_CENTER, FLOOR_ROW_OFFSET, px, dy, s, gap);
      }
      blitRoleFaixaSul(ctx, sheet, roleId, px, dy, s, gap);
    }

    if (destacar) {
      ctx.strokeStyle = "rgba(255, 220, 80, 0.95)";
      ctx.lineWidth = 2;
      const h = preencherVaoSul ? s + (s >> 1) : s;
      ctx.strokeRect(px + 1, py + 1, s - 2, h - 2);
    }
  };
}

function escolherChao(grama, terra, vx, vy, iAlto, nivel) {
  if (iAlto < 0) return terra || grama;
  const c = CANTOS_DUAL[iAlto];
  const cx = vx + c.dx;
  const cy = vy + c.dy;
  const id = nivel > 0 ? obterBloco(cx, cy, nivel - 1) : BLOCO.AR;
  if (id === BLOCO.TERRA || id === BLOCO.PEDRA || nivel >= 2) {
    return terra || grama;
  }
  return grama || terra;
}

/** Chao do lado baixo (cantos SW/SE) pra underfill do vao sul. */
function escolherChaoBaixo(grama, terra, vx, vy, hCantos, nivel) {
  let bestI = -1;
  let bestH = -1;
  for (let i = 0; i < 4; i++) {
    if (hCantos[i] < nivel && hCantos[i] > bestH) {
      bestH = hCantos[i];
      bestI = i;
    }
  }
  if (bestI < 0) return grama || terra;
  return escolherChao(grama, terra, vx, vy, bestI, Math.max(1, bestH));
}

/** Metade de baixo do tile de cliff → preenche o vao sul. */
function blitRoleFaixaSul(ctx, img, role, dx, dy, dw, dh) {
  if (!img || !ctx || dh < 1) return;
  const col = role % SHEET_COLS;
  const row = (role / SHEET_COLS) | 0;
  const sx = col * TILE_ART;
  const half = TILE_ART >> 1;
  const sy = row * TILE_ART + half;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, TILE_ART, half, dx, dy, dw, dh);
}

function papelLabioSulCell(cx, cy, zTopo) {
  const wHigh = alturaEm(cx - 1, cy) >= zTopo;
  const eHigh = alturaEm(cx + 1, cy) >= zTopo;
  if (eHigh && !wHigh) return ROLE_OUT_SW;
  if (wHigh && !eHigh) return ROLE_OUT_SE;
  return ROLE_EDGE_S;
}

function blitRole(ctx, img, role, bandOffset, dx, dy, dw, dh) {
  if (!img || !ctx) return;
  const col = role % SHEET_COLS;
  const row = ((role / SHEET_COLS) | 0) + bandOffset;
  const sx = col * TILE_ART;
  const sy = row * TILE_ART;
  ctx.imageSmoothingEnabled = false;
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
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, srcW, TILE_ART, dx, dy, dw, dh);
}
