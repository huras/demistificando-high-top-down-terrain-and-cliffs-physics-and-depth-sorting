/**
 * Toco recortado da base da própria árvore. Não há folha de toco no atlas.
 */

const ALPHA = 24;
/** @type {WeakMap<CanvasImageSource, { vivo: HTMLCanvasElement, queimado: HTMLCanvasElement }>} */
const cache = new WeakMap();

function limites(data, w, h, y0, y1) {
  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  let algum = false;
  for (let y = y0; y <= y1; y++) {
    const linha = y * w;
    for (let x = 0; x < w; x++) {
      if (data[(linha + x) * 4 + 3] < ALPHA) continue;
      algum = true;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (!algum) return null;
  return { minX, maxX, minY, maxY };
}

function escurecer(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 8) continue;
    const y = (px[i] + px[i + 1] + px[i + 2]) / 3;
    px[i] = y * 0.22;
    px[i + 1] = y * 0.16;
    px[i + 2] = y * 0.13;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function recortar(img) {
  const w = img.naturalWidth || img.width || 0;
  const h = img.naturalHeight || img.height || 0;
  if (!(w > 0 && h > 0)) return null;
  const src = document.createElement("canvas");
  src.width = w;
  src.height = h;
  const sctx = src.getContext("2d", { willReadFrequently: true });
  sctx.drawImage(img, 0, 0);
  const data = sctx.getImageData(0, 0, w, h).data;
  const tudo = limites(data, w, h, 0, h - 1);
  if (!tudo) return null;
  const alturaOpaca = tudo.maxY - tudo.minY + 1;
  const faixa = Math.max(4, Math.round(alturaOpaca * 0.2));
  const y0 = Math.max(0, tudo.maxY - faixa + 1);
  const faixaLim = limites(data, w, h, y0, tudo.maxY) || tudo;
  const cw = faixaLim.maxX - faixaLim.minX + 1;
  const ch = faixaLim.maxY - faixaLim.minY + 1;
  const vivo = document.createElement("canvas");
  vivo.width = cw;
  vivo.height = ch;
  vivo.getContext("2d").drawImage(
    src,
    faixaLim.minX,
    faixaLim.minY,
    cw,
    ch,
    0,
    0,
    cw,
    ch,
  );
  const queimado = document.createElement("canvas");
  queimado.width = cw;
  queimado.height = ch;
  queimado.getContext("2d").drawImage(vivo, 0, 0);
  escurecer(queimado);
  return { vivo, queimado };
}

export function imagemToco(img, queimado) {
  if (!img) return null;
  let par = cache.get(img);
  if (!par) {
    par = recortar(img);
    if (!par) return img;
    cache.set(img, par);
  }
  return queimado ? par.queimado : par.vivo;
}
