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
import {
  BLOCOS_INTIMO,
  LADO_INTIMO,
  LADO_MUNDO,
  LADO_TILE,
  LADO_TILE_MUNDO,
  ZOOM_INTIMO,
  ZOOM_TILE,
} from "./grade.js";
import { listarIntimos } from "./intimo.js";
import { cidadesDoMapa, layoutDaCidade, marcasExtras, rotasDoMapa } from "./marcas.js";
import {
  desenharPinSantuario,
  kickTypeShieldsLoad,
} from "../../santuario/mapaPin.js";
import { desenharPinBerry } from "../../mapa/pinBerry.js";
import {
  aquecerPinMissao,
  desenharPinMissao,
  prenderPinNaBorda,
} from "../../mapa/pinMissao.js";
import { filtrarWildParaVista } from "../../mapa/marcasWild.js";
import { desenharPinWild, wildPinVisivelNoZoom } from "../../mapa/pinWild.js";
import { desenharPinSite } from "../../mapa/pinSite.js";
import { pinMissaoAtiva } from "../../quests/pins.js";
import { imagemIcone } from "../../jogo/icones.js";
import { pedirRetrato } from "../../pokemon/retrato.js";

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

function pontoNoMapa(x, y) {
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < LADO_MUNDO && y < LADO_MUNDO;
}

function desenharSegmentoJornada(ctx, pontos, alfa) {
  if (!pontos || pontos.length < 2) return;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(246, 232, 180, ${alfa})`;
  ctx.lineWidth = 3.2;
  // Quebra se algum ponto estiver fora do overworld (bolso de sala/santuário).
  let aberto = false;
  ctx.beginPath();
  for (let i = 0; i < pontos.length; i++) {
    const p = xyPonto(pontos[i]);
    if (!pontoNoMapa(p[0], p[1])) {
      aberto = false;
      continue;
    }
    if (!aberto) {
      ctx.moveTo(p[0], p[1]);
      aberto = true;
    } else {
      ctx.lineTo(p[0], p[1]);
    }
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
  // Tiles de perto (também no minimapa quando o zoom passa do limiar).
  if (vista.zoom >= ZOOM_TILE) {
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
  if (!vista.mini && vista.jornada !== false) desenharJornadaMundo(ctx);
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

  const extrasBrutos = marcasExtras({
    mini: !!vista.mini,
    px: vista.jogadorX,
    py: vista.jogadorY,
  });
  const wildCap = filtrarWildParaVista(
    extrasBrutos.filter((m) => m.tipo === "wild"),
    vista,
  );
  const wildIds = new Set(wildCap.map((m) => m.id));
  const extras = extrasBrutos.filter((m) => m.tipo !== "wild" || wildIds.has(m.id));
  let santuarioVisto = false;
  let berryVisto = false;
  let wildVisto = false;
  for (let i = 0; i < extras.length; i++) {
    const marca = extras[i];
    const sx = (marca.x - vista.cx) * z + w / 2;
    const sy = (marca.y - vista.cy) * z + h / 2;
    if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) continue;
    if (marca.tipo === "santuario") {
      santuarioVisto = true;
      desenharPinSantuario(ctx, marca, sx, sy, { mini: !!vista.mini, dpr });
      if (!vista.mini && marca.nome && vista.hoverMarcaId === marca.id) {
        nomes.push({
          texto: marca.nome,
          x: sx + 10 * dpr,
          y: sy + alturaFonte * 0.3,
          altura: alturaFonte,
          prio: 4,
          dist: (sx - w / 2) * (sx - w / 2) + (sy - h / 2) * (sy - h / 2),
        });
      }
      continue;
    }
    if (marca.tipo === "berry") {
      if (!vista.mini) continue;
      berryVisto = true;
      desenharPinBerry(ctx, marca, sx, sy, { dpr });
      continue;
    }
    if (marca.tipo === "wild") {
      if (!wildPinVisivelNoZoom(vista)) continue;
      wildVisto = true;
      desenharPinWild(ctx, marca, sx, sy, { mini: !!vista.mini, dpr });
      if (!vista.mini && marca.nome && vista.hoverMarcaId === marca.id) {
        nomes.push({
          texto: marca.nome,
          x: sx + 10 * dpr,
          y: sy + alturaFonte * 0.3,
          altura: alturaFonte,
          prio: 4,
          dist: (sx - w / 2) * (sx - w / 2) + (sy - h / 2) * (sy - h / 2),
        });
      }
      continue;
    }
    if (marca.tipo === "letra") {
      const r = (vista.mini ? 4.2 : 5.5) * dpr;
      ctx.fillStyle = marca.cor || "#c9b6ff";
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = marca.cleared ? "rgba(40,90,60,0.85)" : "rgba(40,30,70,0.75)";
      ctx.lineWidth = Math.max(1, 1.2 * dpr);
      ctx.stroke();
      if (!vista.mini) {
        ctx.fillStyle = "#1a1528";
        ctx.font = `700 ${Math.max(9, 10 * dpr)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(marca.letter || "?"), sx, sy + 0.5);
        if (vista.hoverMarcaId === marca.id && marca.nome) {
          nomes.push({
            texto: marca.nome,
            x: sx + 10 * dpr,
            y: sy + alturaFonte * 0.3,
            altura: alturaFonte,
            prio: 4,
            dist: (sx - w / 2) * (sx - w / 2) + (sy - h / 2) * (sy - h / 2),
          });
        }
      }
      continue;
    }
    if (marca.tipo === "site") {
      desenharPinSite(ctx, marca, sx, sy, { mini: !!vista.mini, dpr });
      if (!vista.mini && marca.nome && vista.hoverMarcaId === marca.id) {
        const rotulo = `${marca.emoji ? `${marca.emoji} ` : ""}${marca.nome}`;
        nomes.push({
          texto: rotulo,
          x: sx + 12 * dpr,
          y: sy + alturaFonte * 0.3,
          altura: alturaFonte,
          prio: 4,
          dist: (sx - w / 2) * (sx - w / 2) + (sy - h / 2) * (sy - h / 2),
        });
      }
      continue;
    }
    ctx.fillStyle = marca.cor || "#f2d48a";
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

  const pinQ = pinMissaoAtiva();
  if (pinQ && Number.isFinite(pinQ.x) && Number.isFinite(pinQ.y)) {
    aquecerPinMissao();
    let qx = (pinQ.x - vista.cx) * z + w / 2;
    let qy = (pinQ.y - vista.cy) * z + h / 2;
    // Minimapa: sempre mostra (prende na borda se estiver fora, igual Pokemon AI).
    // Mapa grande: só desenha se estiver perto da janela.
    if (vista.mini) {
      const preso = prenderPinNaBorda(qx, qy, w, h, { mini: true, circular: true });
      qx = preso.x;
      qy = preso.y;
      desenharPinMissao(ctx, pinQ, qx, qy, { mini: true, dpr });
    } else if (qx > -40 && qx < w + 40 && qy > -40 && qy < h + 40) {
      desenharPinMissao(ctx, pinQ, qx, qy, { mini: false, dpr });
    }
  }
  if (santuarioVisto) kickTypeShieldsLoad();
  if (berryVisto) {
    for (let i = 0; i < extras.length; i++) {
      if (extras[i].tipo === "berry") imagemIcone(extras[i].berryKey);
    }
  }
  if (wildVisto) {
    for (let i = 0; i < extras.length; i++) {
      const m = extras[i];
      if (m.tipo === "wild" && m.dex) pedirRetrato(m.dex, !!m.shiny);
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

  if (!vista.mini && vista.jornada !== false) desenharMortesTela(ctx, vista, w, h, dpr, z);

  const px = (vista.jogadorX - vista.cx) * z + w / 2;
  const py = (vista.jogadorY - vista.cy) * z + h / 2;
  desenharMarcadorJogador(ctx, px, py, dpr, vista);
}

/** facing 0=S 1=W 2=E 3=N — fallback quando dirX/dirY estão zerados. */
const FACING_DIR = [
  [0, 1],
  [-1, 0],
  [1, 0],
  [0, -1],
];

function rumoJogador(vista) {
  let dx = Number(vista.jogadorDirX);
  let dy = Number(vista.jogadorDirY);
  if (!Number.isFinite(dx)) dx = 0;
  if (!Number.isFinite(dy)) dy = 0;
  if (dx * dx + dy * dy < 1e-6) {
    const f = FACING_DIR[(vista.jogadorFacing | 0) & 3] || FACING_DIR[0];
    dx = f[0];
    dy = f[1];
  }
  // Canvas: +Y desce. Triângulo local aponta pra cima (−Y); gira pelo rumo mundo.
  return Math.atan2(dx, -dy);
}

/**
 * Triângulo apontando pro rumo do jogador (minimap + mapa grande).
 */
function desenharMarcadorJogador(ctx, px, py, dpr, vista) {
  const pulso = 5.5 * dpr + Math.sin((vista.agora || 0) * 0.006) * 1.4 * dpr;
  ctx.beginPath();
  ctx.arc(px, py, pulso + 4 * dpr, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255, 250, 240, 0.45)";
  ctx.lineWidth = 2 * dpr;
  ctx.stroke();

  const ang = rumoJogador(vista);
  const len = (vista.mini ? 7.2 : 8.4) * dpr;
  const half = len * 0.58;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, -len);
  ctx.lineTo(half, len * 0.62);
  ctx.lineTo(0, len * 0.28);
  ctx.lineTo(-half, len * 0.62);
  ctx.closePath();
  ctx.fillStyle = "#fffaf2";
  ctx.fill();
  ctx.lineWidth = 2 * dpr;
  ctx.strokeStyle = "#1b2420";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}
