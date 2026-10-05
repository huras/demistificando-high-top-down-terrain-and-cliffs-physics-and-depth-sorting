import * as THREE from "three";
import {
  FLOOR_ROW_OFFSET,
  ROLE_CENTER,
  ROLE_CLIFF_CENTER,
  ROLE_EDGE_S,
  SHEET_COLS,
  TILE_ART,
} from "../../config.js";

/**
 * Extrai um tile 16×16 do sheet (role + bandOffset).
 * @returns {HTMLCanvasElement | null}
 */
export function extrairTileCanvas(img, role, bandOffset = 0) {
  if (!img) return null;
  const col = role % SHEET_COLS;
  const row = bandOffset + ((role / SHEET_COLS) | 0);
  const canvas = document.createElement("canvas");
  canvas.width = TILE_ART;
  canvas.height = TILE_ART;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  const sw = img.width || img.naturalWidth || 0;
  const sh = img.height || img.naturalHeight || 0;
  if (sw < TILE_ART || sh < TILE_ART) return null;
  const sx = col * TILE_ART;
  const sy = row * TILE_ART;
  if (sx + TILE_ART > sw || sy + TILE_ART > sh) return null;
  ctx.drawImage(img, sx, sy, TILE_ART, TILE_ART, 0, 0, TILE_ART, TILE_ART);
  return canvas;
}

/**
 * Tile de cliff opaco: preenche fundo marrom sob pixels transparentes (magenta).
 */
function extrairCliffSeamless(atlas) {
  const sheet = atlas?.cliffSimples || atlas?.cliffDuplo;
  if (!sheet) return null;

  let tile =
    extrairTileCanvas(sheet, ROLE_CLIFF_CENTER, 0) ||
    extrairTileCanvas(sheet, ROLE_EDGE_S, 0);
  if (!tile) return null;

  const out = document.createElement("canvas");
  out.width = TILE_ART;
  out.height = TILE_ART;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#6e4a2e";
  ctx.fillRect(0, 0, TILE_ART, TILE_ART);

  const chao = atlas.terra || atlas.grama;
  const fundo = chao ? extrairTileCanvas(chao, ROLE_CENTER, FLOOR_ROW_OFFSET) : null;
  if (fundo) ctx.drawImage(fundo, 0, 0);

  ctx.drawImage(tile, 0, 0);
  return out;
}

/**
 * Canvas/Image → Texture pixelada (Nearest, sRGB).
 */
export function canvasParaTextura(fonte, { repeat = false } = {}) {
  if (!fonte) return null;
  const tex = new THREE.CanvasTexture(fonte);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  } else {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
  }
  return tex;
}

/**
 * Monta texturas 3D a partir do atlas 2D.
 * @returns {{ grama: THREE.Texture|null, terra: THREE.Texture|null, cliff: THREE.Texture|null, pronto: boolean, liberar: Function }}
 */
export function criarTexturasTerreno3d(atlas) {
  const gramaCanvas = atlas?.grama
    ? extrairTileCanvas(atlas.grama, ROLE_CENTER, FLOOR_ROW_OFFSET)
    : null;
  const terraCanvas = atlas?.terra
    ? extrairTileCanvas(atlas.terra, ROLE_CENTER, FLOOR_ROW_OFFSET)
    : null;
  const cliffCanvas = extrairCliffSeamless(atlas);

  const grama = canvasParaTextura(gramaCanvas, { repeat: true });
  const terra = canvasParaTextura(terraCanvas, { repeat: true });
  const cliff = canvasParaTextura(cliffCanvas, { repeat: true });

  const pronto = !!(grama && cliff);

  return {
    grama,
    terra: terra || grama,
    cliff,
    pronto,
    liberar() {
      grama?.dispose();
      if (terra && terra !== grama) terra.dispose();
      cliff?.dispose();
    },
  };
}
