/**
 * Pé opaco do sprite. Mesma regra do scanFeetPivot do Pokemon AI:
 * ignora alpha < 24; y é a fração a partir do topo até a linha abaixo do último pixel.
 */

const ALPHA_PE = 24;
const VAZIO = Object.freeze({ x: 0.5, y: 1 });

/** @type {WeakMap<CanvasImageSource, { x: number, y: number }>} */
const cacheImagem = new WeakMap();
/** @type {WeakMap<CanvasImageSource, Map<string, { x: number, y: number }>>} */
const cacheFrame = new WeakMap();

/** Pivô do PNG inteiro. x e y são frações a partir do canto superior esquerdo. */
export function pivoDaImagem(img) {
  if (!img) return VAZIO;
  const pronto = cacheImagem.get(img);
  if (pronto) return pronto;
  const w = img.naturalWidth || img.width || 0;
  const h = img.naturalHeight || img.height || 0;
  const pivo = w > 0 && h > 0 ? medir(img, 0, 0, w, h) : VAZIO;
  cacheImagem.set(img, pivo);
  return pivo;
}

/** Pivô de um quadro do sheet do jogador (coluna, linha, lado em px). */
export function pivoDoFrame(sheet, col, linha, frame) {
  if (!sheet || !(frame > 0)) return VAZIO;
  let mapa = cacheFrame.get(sheet);
  if (!mapa) {
    mapa = new Map();
    cacheFrame.set(sheet, mapa);
  }
  const chave = `${col}|${linha}|${frame}`;
  const pronto = mapa.get(chave);
  if (pronto) return pronto;
  const pivo = medir(sheet, col * frame, linha * frame, frame, frame);
  mapa.set(chave, pivo);
  return pivo;
}

function medir(fonte, sx, sy, sw, sh) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return VAZIO;
    ctx.drawImage(fonte, sx, sy, sw, sh, 0, 0, sw, sh);
    const data = ctx.getImageData(0, 0, sw, sh).data;
    let minX = sw;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < sh; y++) {
      const row = y * sw;
      for (let x = 0; x < sw; x++) {
        if (data[(row + x) * 4 + 3] < ALPHA_PE) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return VAZIO;
    return {
      x: ((minX + maxX + 1) * 0.5) / sw,
      y: (maxY + 1) / sh,
    };
  } catch {
    return VAZIO;
  }
}
