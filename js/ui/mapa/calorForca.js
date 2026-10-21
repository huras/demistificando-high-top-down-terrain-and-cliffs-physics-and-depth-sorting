/**
 * Overlay de força selvagem no mapa M: bake 64×64 no overworld inteiro.
 */
import { LADO_MUNDO, dentroDoKanto, paraLocalKanto } from "../../mundo/bounds.js";
import { AREA_KANTO, zonaEm } from "../../mundo/regiao/grafoKanto.js";
import {
  CELULA_FORCA,
  GRADE_FORCA,
  TILES_POR_NIVEL,
  corCalor,
  faixaNivelCelulaMundo,
  nivelEscalaCalor,
  nivelNaCelulaMundo,
} from "../../pokemon/distribuicao/forca.js";

const ZOOM_LABEL = 28 / CELULA_FORCA;

/** @type {HTMLCanvasElement | null} */
let bake = null;

function garantirBake() {
  if (bake) return bake;
  const escala = nivelEscalaCalor();
  const canvas = document.createElement("canvas");
  canvas.width = GRADE_FORCA;
  canvas.height = GRADE_FORCA;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  for (let cy = 0; cy < GRADE_FORCA; cy++) {
    for (let cx = 0; cx < GRADE_FORCA; cx++) {
      ctx.fillStyle = corCalor(nivelNaCelulaMundo(cx, cy), 1, escala);
      ctx.fillRect(cx, cy, 1, 1);
    }
  }
  bake = canvas;
  return bake;
}

/** Heat fill no espaço mundo — overworld 8192². */
export function pintarCalorForcaMundo(ctx) {
  const img = garantirBake();
  if (!img) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 0.58;
  ctx.drawImage(img, 0, 0, LADO_MUNDO, LADO_MUNDO);
  ctx.restore();
}

function celulaCidadeVisivel(cx, cy) {
  const wx = cx * CELULA_FORCA + CELULA_FORCA * 0.5;
  const wy = cy * CELULA_FORCA + CELULA_FORCA * 0.5;
  if (!dentroDoKanto(wx, wy)) return false;
  const local = paraLocalKanto(wx, wy);
  const ax = (local.x / AREA_KANTO) | 0;
  const ay = (local.y / AREA_KANTO) | 0;
  return zonaEm(ax, ay)?.tipo === "cidade";
}

/**
 * Empilha labels Lv na fila de nomes do mapa.
 * @param {Array<{texto:string,x:number,y:number,altura:number,prio:number,dist:number}>} nomes
 */
export function coletarLabelsCalor(nomes, vista, w, h, dpr, z) {
  if (vista.zoom < ZOOM_LABEL) return;
  const areaPx = CELULA_FORCA * vista.zoom;
  if (areaPx < 28) return;

  const meioW = w / (2 * z);
  const meioH = h / (2 * z);
  const x0 = vista.cx - meioW;
  const y0 = vista.cy - meioH;
  const x1 = vista.cx + meioW;
  const y1 = vista.cy + meioH;
  const cx0 = Math.max(0, (x0 / CELULA_FORCA) | 0);
  const cy0 = Math.max(0, (y0 / CELULA_FORCA) | 0);
  const cx1 = Math.min(GRADE_FORCA - 1, (x1 / CELULA_FORCA) | 0);
  const cy1 = Math.min(GRADE_FORCA - 1, (y1 / CELULA_FORCA) | 0);

  const altura = Math.max(8, Math.min(12, Math.round(areaPx * 0.13))) * dpr;
  const half = CELULA_FORCA * 0.5;

  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      if (celulaCidadeVisivel(cx, cy)) continue;
      const faixa = faixaNivelCelulaMundo(cx, cy);
      if (faixa.max <= 0) continue;
      const wx = cx * CELULA_FORCA + half;
      const wy = cy * CELULA_FORCA + half;
      const sx = (wx - vista.cx) * z + w / 2;
      const sy = (wy - vista.cy) * z + h / 2;
      if (sx < -40 || sy < -40 || sx > w + 40 || sy > h + 40) continue;
      const texto =
        faixa.min === faixa.max ? `Lv ${faixa.min}` : `Lv ${faixa.min}–${faixa.max}`;
      const approx = texto.length * altura * 0.33;
      nomes.push({
        texto,
        x: sx - approx * 0.5,
        y: sy + altura * 0.35,
        altura,
        prio: -1,
        dist: (sx - w / 2) * (sx - w / 2) + (sy - h / 2) * (sy - h / 2),
      });
    }
  }
}

/** Legenda fixa no canto inferior esquerdo (espaço tela). */
export function pintarLegendaCalor(ctx, w, h, dpr) {
  const escala = nivelEscalaCalor();
  const pad = 14 * dpr;
  const barW = 140 * dpr;
  const barH = 10 * dpr;
  const x = pad;
  const y = h - pad - barH - 52 * dpr;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `600 ${11 * dpr}px "Segoe UI", sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(16, 22, 18, 0.72)";
  ctx.fillRect(x - 8 * dpr, y - 18 * dpr, barW + 16 * dpr, barH + 48 * dpr);

  ctx.fillStyle = "#f6f0e4";
  ctx.fillText("Força selvagem", x, y - 4 * dpr);

  const grad = ctx.createLinearGradient(x, 0, x + barW, 0);
  grad.addColorStop(0, corCalor(1, 1, escala));
  grad.addColorStop(1, corCalor(escala, 1, escala));
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, barW, barH);
  ctx.strokeStyle = "rgba(246, 240, 228, 0.55)";
  ctx.lineWidth = Math.max(1, dpr);
  ctx.strokeRect(x, y, barW, barH);

  const mini = 9 * dpr;
  ctx.font = `600 ${mini}px "Segoe UI", sans-serif`;
  ctx.fillStyle = "rgba(246, 240, 228, 0.92)";
  ctx.fillText("Cidades", x, y + barH + 12 * dpr);
  const fim = `Lv ${escala}`;
  const fimW = ctx.measureText(fim).width;
  ctx.fillText(fim, x + barW - fimW, y + barH + 12 * dpr);
  ctx.fillStyle = "rgba(246, 240, 228, 0.7)";
  ctx.fillText(`+1 / ${TILES_POR_NIVEL} tiles`, x, y + barH + 24 * dpr);
  ctx.restore();
}
