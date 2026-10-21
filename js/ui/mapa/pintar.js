/**
 * Pintura do mapa: terreno, rotas, layout da cidade, orbes e o jogador.
 */
import { obterJornada } from "../../jogo/jornada.js";
import { canvasAtlas, listarTiles } from "./atlas.js";
import {
  coletarLabelsCalor,
  pintarCalorForcaMundo,
  pintarLegendaCalor,
} from "./calorForca.js";
import { BLOCOS_INTIMO, LADO_INTIMO, LADO_MUNDO, LADO_TILE, LADO_TILE_MUNDO, ZOOM_INTIMO } from "./grade.js";
import { listarIntimos } from "./intimo.js";
import { cidadesDoMapa, layoutDaCidade, marcasExtras, rotasDoMapa } from "./marcas.js";

const ZOOM_NOME_ROTA = 0.36;
const ZOOM_LAYOUT = 64;

let cidades = null;
let rotas = null;

function garantir() {
  if (cidades) return;
  cidades = cidadesDoMapa();
  rotas = rotasDoMapa();
}

function orbe(ctx, x, y, raio, tema = "cidade") {
  const g = ctx.createRadialGradient(x - raio * 0.35, y - raio * 0.4, raio * 0.1, x, y, raio);
  if (tema === "teste") {
    g.addColorStop(0, "#f4fff8");
    g.addColorStop(0.42, "#3dd68c");
    g.addColorStop(1, "#0f5c3a");
  } else {
    g.addColorStop(0, "#fff7f4");
    g.addColorStop(0.42, "#ff5c4c");
    g.addColorStop(1, "#8a1a16");
  }
  ctx.beginPath();
  ctx.arc(x, y, raio, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1, raio * 0.18);
  ctx.strokeStyle = "rgba(255,248,242,0.9)";
  ctx.stroke();
}

function cabe(caixa, ocupadas) {
  for (let i = 0; i < ocupadas.length; i++) {
    const o = ocupadas[i];
    if (caixa.x < o.x + o.w && caixa.x + caixa.w > o.x && caixa.y < o.y + o.h && caixa.y + caixa.h > o.y) {
      return false;
    }
  }
  return true;
}

function desenharRota(ctx, rota) {
  const pontos = rota.pontos;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = rota.agua ? "#163e5c" : "#6a4b2a";
  ctx.lineWidth = rota.agua ? 9 : 11;
  ctx.beginPath();
  if (pontos.length < 2) {
    ctx.arc(pontos[0][0], pontos[0][1], 16, 0, Math.PI * 2);
    ctx.fillStyle = rota.agua ? "#d5e8f4" : "#e2c48a";
    ctx.fill();
    return;
  }
  ctx.moveTo(pontos[0][0], pontos[0][1]);
  for (let i = 1; i < pontos.length; i++) ctx.lineTo(pontos[i][0], pontos[i][1]);
  ctx.stroke();
  ctx.strokeStyle = rota.agua ? "#d5e8f4" : "#e7c98a";
  ctx.lineWidth = rota.agua ? 5 : 6.5;
  ctx.stroke();
}

function xyPonto(p) {
  return Array.isArray(p) ? [p[0], p[1]] : [p.x, p.y];
}

function desenharSegmentoJornada(ctx, pontos, alfa) {
  if (!pontos || pontos.length < 2) return;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(246, 232, 180, ${alfa})`;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  const p0 = xyPonto(pontos[0]);
  ctx.moveTo(p0[0], p0[1]);
  for (let i = 1; i < pontos.length; i++) {
    const p = xyPonto(pontos[i]);
    ctx.lineTo(p[0], p[1]);
  }
  ctx.stroke();
  ctx.strokeStyle = `rgba(255, 248, 220, ${alfa * 0.55})`;
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function desenharJornadaMundo(ctx) {
  const j = obterJornada();
  const segs = j.segmentos;
  const n = segs.length;
  for (let i = 0; i < n; i++) {
    const idade = (i + 1) / n;
    const alfa = 0.22 + idade * 0.45;
    desenharSegmentoJornada(ctx, segs[i].pontos, alfa);
  }
  for (let i = 0; i < j.teleportes.length; i++) {
    const tp = j.teleportes[i];
    ctx.strokeStyle = "rgba(160, 210, 255, 0.55)";
    ctx.lineWidth = 2.2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(tp.de.x, tp.de.y);
    const mx = (tp.de.x + tp.para.x) * 0.5;
    const my = (tp.de.y + tp.para.y) * 0.5 - Math.hypot(tp.para.x - tp.de.x, tp.para.y - tp.de.y) * 0.12;
    ctx.quadraticCurveTo(mx, my, tp.para.x, tp.para.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(160, 210, 255, 0.75)";
    ctx.beginPath();
    ctx.arc(tp.de.x, tp.de.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tp.para.x, tp.para.y, 4.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function desenharMortesTela(ctx, vista, w, h, dpr, z) {
  const mortes = obterJornada().mortes;
  const s = 5.5 * dpr;
  for (let i = 0; i < mortes.length; i++) {
    const m = mortes[i];
    const sx = (m.x - vista.cx) * z + w / 2;
    const sy = (m.y - vista.cy) * z + h / 2;
    if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) continue;
    ctx.strokeStyle = "rgba(220, 70, 70, 0.9)";
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.moveTo(sx - s, sy - s);
    ctx.lineTo(sx + s, sy + s);
    ctx.moveTo(sx + s, sy - s);
    ctx.lineTo(sx - s, sy + s);
    ctx.stroke();
  }
}

function desenharLayout(ctx, cidade, z) {
  const layout = layoutDaCidade(cidade);
  if (!layout) return;
  const largura = (layout.fp.x1 - layout.fp.x0) * z;
  if (largura < ZOOM_LAYOUT) return;
  const ox = layout.ox;
  const oy = layout.oy;
  const fp = layout.fp;
  ctx.fillStyle = "rgba(92, 76, 48, 0.38)";
  ctx.fillRect(ox + fp.x0, oy + fp.y0, fp.x1 - fp.x0, fp.y1 - fp.y0);
  ctx.strokeStyle = "#d9c396";
  ctx.lineWidth = 7;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(ox + fp.x0, oy + fp.cy);
  ctx.lineTo(ox + fp.x1, oy + fp.cy);
  ctx.moveTo(ox + fp.cx, oy + fp.y0);
  ctx.lineTo(ox + fp.cx, oy + fp.y1);
  ctx.stroke();
  const volumes = layout.volumes;
  for (let i = 0; i < volumes.length; i++) {
    const v = volumes[i];
    ctx.fillStyle = v.papel === "casa" ? "#f4ead4" : "#f7f1e2";
    ctx.fillRect(ox + v.x0, oy + v.y0, v.x1 - v.x0, v.y1 - v.y0);
    ctx.strokeStyle = "rgba(72, 54, 32, 0.55)";
    ctx.lineWidth = 0.6;
    ctx.strokeRect(ox + v.x0, oy + v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }
}

function desenharNomes(ctx, fila, w, h) {
  fila.sort((a, b) => b.prio - a.prio || a.dist - b.dist);
  const ocupadas = [];
  for (let i = 0; i < fila.length; i++) {
    const item = fila[i];
    ctx.font = `600 ${item.altura}px "Segoe UI", sans-serif`;
    const largura = ctx.measureText(item.texto).width;
    const caixa = { x: item.x, y: item.y - item.altura, w: largura + 4, h: item.altura + 2 };
    if (caixa.x < 8 || caixa.y < 8 || caixa.x + caixa.w > w - 8 || caixa.y + caixa.h > h - 28) continue;
    if (!cabe(caixa, ocupadas)) continue;
    ocupadas.push(caixa);
    ctx.lineWidth = Math.max(3, item.altura * 0.28);
    ctx.strokeStyle = "rgba(16, 22, 18, 0.82)";
    ctx.strokeText(item.texto, item.x, item.y);
    ctx.fillStyle = "#f6f0e4";
    ctx.fillText(item.texto, item.x, item.y);
  }
}

export function pintarMapa(ctx, w, h, dpr, vista) {
  garantir();
  const z = vista.zoom * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#143e66";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  ctx.translate(w / 2, h / 2);
  ctx.scale(z, z);
  ctx.translate(-vista.cx, -vista.cy);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const atlas = canvasAtlas();
  if (atlas) ctx.drawImage(atlas, 0, 0, LADO_MUNDO, LADO_MUNDO);
  if (!vista.mini && vista.zoom >= 0.42) {
    const visiveis = listarTiles();
    for (let i = 0; i < visiveis.length; i++) {
      const tile = visiveis[i];
      if (!tile.canvas) continue;
      ctx.drawImage(
        tile.canvas,
        0,
        0,
        LADO_TILE,
        LADO_TILE,
        tile.tx * LADO_TILE_MUNDO,
        tile.ty * LADO_TILE_MUNDO,
        LADO_TILE_MUNDO,
        LADO_TILE_MUNDO,
      );
    }
  }
  if (!vista.mini && vista.zoom >= ZOOM_INTIMO) {
    ctx.imageSmoothingEnabled = false;
    const intimos = listarIntimos();
    for (let i = 0; i < intimos.length; i++) {
      const tile = intimos[i];
      ctx.drawImage(
        tile.canvas,
        0,
        0,
        LADO_INTIMO,
        LADO_INTIMO,
        tile.ox,
        tile.oy,
        BLOCOS_INTIMO,
        BLOCOS_INTIMO,
      );
    }
  }
  if (vista.calorForca && !vista.mini) pintarCalorForcaMundo(ctx);
  for (let i = 0; i < rotas.length; i++) desenharRota(ctx, rotas[i]);
  for (let i = 0; i < cidades.length; i++) desenharLayout(ctx, cidades[i], z);
  if (!vista.mini) desenharJornadaMundo(ctx);
  ctx.restore();

  const nomes = [];
  const alturaFonte = Math.max(12, Math.round(13 * dpr));
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  const raio = 7 * dpr;
  for (let i = 0; i < cidades.length; i++) {
    const cidade = cidades[i];
    const sx = (cidade.x - vista.cx) * z + w / 2;
    const sy = (cidade.y - vista.cy) * z + h / 2;
    if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) continue;
    orbe(ctx, sx, sy, vista.mini ? raio * 0.72 : raio, cidade.tipo === "teste" ? "teste" : "cidade");
    if (vista.mini) continue;
    nomes.push({
      texto: cidade.nome,
      x: sx + raio + 4 * dpr,
      y: sy + alturaFonte * 0.3,
      altura: alturaFonte,
      prio: cidade.tipo === "teste" ? 3 : 2,
      dist: (sx - w / 2) * (sx - w / 2) + (sy - h / 2) * (sy - h / 2),
    });
  }

  const extras = marcasExtras();
  for (let i = 0; i < extras.length; i++) {
    const marca = extras[i];
    const sx = (marca.x - vista.cx) * z + w / 2;
    const sy = (marca.y - vista.cy) * z + h / 2;
    if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) continue;
    ctx.fillStyle = "#f2d48a";
    ctx.beginPath();
    ctx.arc(sx, sy, 4.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
    if (!vista.mini && marca.nome) {
      nomes.push({
        texto: marca.nome,
        x: sx + 8 * dpr,
        y: sy + alturaFonte * 0.3,
        altura: alturaFonte,
        prio: 0,
        dist: (sx - w / 2) * (sx - w / 2) + (sy - h / 2) * (sy - h / 2),
      });
    }
  }

  if (!vista.mini && vista.zoom >= ZOOM_NOME_ROTA) {
    for (let i = 0; i < rotas.length; i++) {
      const rota = rotas[i];
      const meio = rota.pontos[(rota.pontos.length / 2) | 0];
      const sx = (meio[0] - vista.cx) * z + w / 2;
      const sy = (meio[1] - vista.cy) * z + h / 2;
      nomes.push({
        texto: rota.nome,
        x: sx + 4 * dpr,
        y: sy - 6 * dpr,
        altura: alturaFonte,
        prio: 1,
        dist: (sx - w / 2) * (sx - w / 2) + (sy - h / 2) * (sy - h / 2),
      });
    }
  }

  if (vista.calorForca && !vista.mini) {
    coletarLabelsCalor(nomes, vista, w, h, dpr, z);
  }

  desenharNomes(ctx, nomes, w, h);

  if (vista.calorForca && !vista.mini) {
    pintarLegendaCalor(ctx, w, h, dpr);
  }

  if (!vista.mini) desenharMortesTela(ctx, vista, w, h, dpr, z);

  const px = (vista.jogadorX - vista.cx) * z + w / 2;
  const py = (vista.jogadorY - vista.cy) * z + h / 2;
  const pulso = 5.5 * dpr + Math.sin(vista.agora * 0.006) * 1.4 * dpr;
  ctx.beginPath();
  ctx.arc(px, py, pulso + 4 * dpr, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255, 250, 240, 0.45)";
  ctx.lineWidth = 2 * dpr;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px, py, 5.2 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = "#fffaf2";
  ctx.fill();
  ctx.lineWidth = 2 * dpr;
  ctx.strokeStyle = "#1b2420";
  ctx.stroke();
}
