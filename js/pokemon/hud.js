import { colunaEmocao, folhaEmocoes } from "./emocoes.js";
import { flutuantes } from "./flutuantes.js";
import { bolaEmMira, cargaAtual, obterMiraBola } from "./captura.js";
import { alvoDeOrdem } from "./party.js";
import { pedirRetrato } from "./retrato.js";
import { atoresVisiveis, pokemonLigado, relogioPokemon } from "./sistema.js";
import { ALTURA_BLOCO } from "../config.js";
import { COR_TIPO, nomeTipo } from "./tipos.js";
import { mundoParaTelaX, mundoParaTelaY } from "../render/camera.js";
import { hotbarAtivo, contar, uiAberta } from "../jogo/estado.js";
import { TIPO_ITEM } from "../wild/catalogo.js";
import * as THREE from "three";

const _ponto = new THREE.Vector3();

export function projetar2d(camera) {
  const zoom = camera?.zoom || 1;
  return (x, y, z, hop) => ({
    x: (mundoParaTelaX(x) - camera.x) * zoom,
    y: (mundoParaTelaY(y, z, hop || 0) - 48 - camera.y) * zoom,
  });
}

export function projetarPes2d(camera) {
  const zoom = camera?.zoom || 1;
  return (x, y, z, hop) => ({
    x: (mundoParaTelaX(x) - camera.x) * zoom,
    y: (mundoParaTelaY(y, z, hop || 0) - camera.y) * zoom,
  });
}

export function projetarChao3d(cam, largura, altura) {
  return (x, y, z) => {
    if (!cam) return null;
    _ponto.set(x, (z || 0) * ALTURA_BLOCO + 0.08, y);
    _ponto.project(cam);
    if (_ponto.z < -1 || _ponto.z > 1) return null;
    return {
      x: (_ponto.x * 0.5 + 0.5) * largura,
      y: (-_ponto.y * 0.5 + 0.5) * altura,
    };
  };
}

function bolaNaMao() {
  if (uiAberta()) return false;
  const item = hotbarAtivo();
  if (!item || item.tipo !== TIPO_ITEM.BOLA) return false;
  return contar(item.tipo, item.key) > 0;
}

function corCarga(carga, alfa) {
  const t = Math.max(0, Math.min(1, carga));
  const r = Math.round(170 + (255 - 170) * t);
  const g = Math.round(220 + (206 - 220) * t);
  const b = Math.round(255 + (120 - 255) * t);
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

function pontosAnel(x, y, raio, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([x + Math.cos(a) * raio, y + Math.sin(a) * raio]);
  }
  return pts;
}

function pontosCapsula(x, y, ux, uy, comp, raio) {
  const px = -uy;
  const py = ux;
  const recuo = Math.min(0.45, comp * 0.2);
  const x0 = x + ux * recuo;
  const y0 = y + uy * recuo;
  const x1 = x + ux * comp;
  const y1 = y + uy * comp;
  const pts = [[x0 + px * raio, y0 + py * raio]];
  const passos = 12;
  for (let i = 0; i <= passos; i++) {
    const ang = (i / passos) * Math.PI;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    pts.push([
      x1 + px * raio * c + ux * raio * s,
      y1 + py * raio * c + uy * raio * s,
    ]);
  }
  pts.push([x0 - px * raio, y0 - py * raio]);
  return pts;
}

function tracarMundo(ctx, pts, projetar, z, fechar) {
  let comecou = false;
  let algum = false;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const s = projetar(pts[i][0], pts[i][1], z, 0);
    if (!s) {
      comecou = false;
      continue;
    }
    if (!comecou) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
    comecou = true;
    algum = true;
  }
  if (fechar && algum) ctx.closePath();
  return algum;
}

function desenharMira(ctx, projetar, corpo) {
  if (!bolaNaMao() || !bolaEmMira() || !projetar || !corpo) return;
  const geo = obterMiraBola(corpo);
  if (!geo) return;
  const z = geo.z;
  const raio = geo.largura * 0.5;
  const comp = Math.max(raio + 0.2, geo.voo - raio);
  const anel = pontosAnel(geo.x0, geo.y0, geo.alcance, 72);
  const faixa = pontosCapsula(geo.x0, geo.y0, geo.ux, geo.uy, comp, raio);
  const pontaX = geo.x0 + geo.ux * comp;
  const pontaY = geo.y0 + geo.uy * comp;
  const ponta = pontosAnel(pontaX, pontaY, geo.largura * 0.52, 20);

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.fillStyle = "rgba(90, 170, 255, 0.08)";
  ctx.strokeStyle = "rgba(186, 226, 255, 0.82)";
  ctx.lineWidth = 2;
  if (tracarMundo(ctx, anel, projetar, z, true)) {
    ctx.fill();
    ctx.stroke();
  }

  ctx.shadowColor = "rgba(80, 170, 255, 0.45)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = corCarga(geo.carga, 0.28 + geo.carga * 0.22);
  ctx.strokeStyle = corCarga(geo.carga, 0.95);
  ctx.lineWidth = 2.25;
  if (tracarMundo(ctx, faixa, projetar, z, true)) {
    ctx.fill();
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  ctx.fillStyle = corCarga(geo.carga, 0.55);
  if (tracarMundo(ctx, ponta, projetar, z, true)) ctx.fill();

  const eixo = [
    [geo.x0 + geo.ux * 0.45, geo.y0 + geo.uy * 0.45],
    [pontaX, pontaY],
  ];
  ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 6]);
  if (tracarMundo(ctx, eixo, projetar, z, false)) ctx.stroke();
  ctx.restore();
}
export function projetar3d(cam, largura, altura) {
  return (x, y, z, hop) => {
    if (!cam) return null;
    _ponto.set(x, ((z || 0) + (hop || 0)) * ALTURA_BLOCO + 1.15, y);
    _ponto.project(cam);
    if (_ponto.z < -1 || _ponto.z > 1) return null;
    return {
      x: (_ponto.x * 0.5 + 0.5) * largura,
      y: (-_ponto.y * 0.5 + 0.5) * altura,
    };
  };
}

function barra(ctx, x, y, w, h, t, cor, fundo) {
  ctx.fillStyle = fundo;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = cor;
  ctx.fillRect(x, y, Math.max(0, Math.min(w, w * t)), h);
}

/** Painel canvas legado (HP/bolas/"B · mochila") — substituído pelo HUD HTML. */
function painel(_ctx) {
  /* no-op: hotbar + corações + dinheiro são DOM */
}

function marcador(ctx, ator, p) {
  const hp = ator.morto ? 0 : ator.hp / ator.hpMax;
  if (!ator.morto) {
    barra(ctx, p.x - 16, p.y - 8, 32, 4, hp, ator.faccao === "party" ? "#4ade80" : "#f87171", "rgba(0,0,0,0.55)");
  }
  const revelar = ator.morto && relogioPokemon() - ator.morreuEm > 0.8;
  if (revelar) {
    const face = pedirRetrato(ator.especie.dex, ator.shiny);
    if (face) {
      desenharRetrato(ctx, p.x, p.y - 8, face);
      return;
    }
  }
  if (ator.emocao == null || !folhaEmocoes()) return;
  desenharEmocao(ctx, p.x, p.y - 10, ator);
}

function desenharRetrato(ctx, x, y, face) {
  const lado = 46;
  const topo = y - lado - 8;
  const esq = x - lado / 2;
  ctx.save();
  ctx.fillStyle = "rgba(6, 8, 14, 0.4)";
  ctx.fillRect(esq + 2, topo + 3, lado, lado);
  ctx.fillStyle = "rgba(226, 232, 240, 0.92)";
  ctx.fillRect(esq, topo, lado, lado);
  ctx.save();
  ctx.beginPath();
  ctx.rect(esq + 3, topo + 3, lado - 6, lado - 6);
  ctx.clip();
  ctx.filter = "grayscale(0.85) brightness(0.95)";
  ctx.drawImage(face, esq + 3, topo + 3, lado - 6, lado - 6);
  ctx.restore();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.95)";
  ctx.strokeRect(esq, topo, lado, lado);
  ctx.beginPath();
  ctx.moveTo(x - 6, topo + lado);
  ctx.lineTo(x + 6, topo + lado);
  ctx.lineTo(x, topo + lado + 8);
  ctx.closePath();
  ctx.fillStyle = "rgba(226, 232, 240, 0.92)";
  ctx.fill();
  ctx.restore();
}

function desenharEmocao(ctx, x, y, ator) {
  const folha = folhaEmocoes();
  if (!folha) return;
  const colunas = 8;
  const linhas = 10;
  const fw = folha.naturalWidth / colunas;
  const fh = folha.naturalHeight / linhas;
  const col = colunaEmocao(ator);
  const row = ator.emocao | 0;
  const dw = fw * 1.15;
  const dh = fh * 1.15;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(folha, col * fw, row * fh, fw, fh, x - dw / 2, y - dh, dw, dh);
}

function textos(ctx, projetar) {
  const lista = flutuantes();
  ctx.save();
  ctx.font = "700 16px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(20, 16, 12, 0.88)";
  for (let i = 0; i < lista.length; i++) {
    const f = lista[i];
    const p = projetar(f.x, f.y, f.z, 0);
    if (!p) continue;
    ctx.globalAlpha = Math.max(0, 1 - f.idade / 0.85);
    ctx.strokeText(f.texto, p.x, p.y);
    ctx.fillStyle = f.cor;
    ctx.fillText(f.texto, p.x, p.y);
  }
  ctx.restore();
}

function carga(ctx, projetar, corpo) {
  const t = cargaAtual();
  if (t <= 0 || !corpo) return;
  const z = corpo.elevacao ?? corpo.z ?? 0;
  const p = projetar(corpo.x, corpo.y, z, 0);
  if (!p) return;
  ctx.save();
  ctx.strokeStyle = "rgba(248, 250, 252, 0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(p.x, p.y - 28, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
  ctx.stroke();
  ctx.restore();
}

function tintaSobre(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  if (!Number.isFinite(n)) return "#f8fafc";
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.3 * r + 0.59 * g + 0.11 * b > 160 ? "#1c1917" : "#f8fafc";
}

const ANEL_HOVER = {
  rx: 28,
  ry: 12,
  fill: "rgba(45, 212, 191, 0.4)",
  borda: "rgba(6, 18, 22, 0.9)",
  linha: "#ecfeff",
  trava: false,
};
const ANEL_ALVO = {
  rx: 34,
  ry: 14,
  fill: "rgba(248, 113, 113, 0.4)",
  borda: "rgba(40, 8, 8, 0.92)",
  linha: "#fecaca",
  trava: true,
};

function desenharAnel(ctx, p, estilo, pulso) {
  const k = pulso || 0;
  const rx = estilo.rx + k * 2;
  const ry = estilo.ry + k;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = estilo.fill;
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = estilo.borda;
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = estilo.linha;
  ctx.stroke();
  if (estilo.trava) {
    const folga = 5;
    ctx.beginPath();
    ctx.moveTo(p.x - rx - folga, p.y);
    ctx.lineTo(p.x - rx + 7, p.y);
    ctx.moveTo(p.x + rx - 7, p.y);
    ctx.lineTo(p.x + rx + folga, p.y);
    ctx.moveTo(p.x, p.y - ry - folga);
    ctx.lineTo(p.x, p.y - ry + 5);
    ctx.moveTo(p.x, p.y + ry - 5);
    ctx.lineTo(p.x, p.y + ry + folga);
    ctx.stroke();
  }
  ctx.restore();
}

function desenharPlacaAlvo(ctx, x, y, nome) {
  const texto = nome || "Alvo";
  ctx.save();
  ctx.font = "700 12px Segoe UI, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const largura = ctx.measureText(texto).width + 22;
  const altura = 18;
  let px = x - largura * 0.5;
  let py = y - altura - 18;
  const canvas = ctx.canvas;
  if (canvas) {
    const maxX = canvas.width - largura - 8;
    const maxY = canvas.height - altura - 8;
    if (px < 8) px = 8;
    else if (px > maxX) px = maxX;
    if (py < 8) py = 8;
    else if (py > maxY) py = maxY;
  }
  ctx.fillStyle = "rgba(48, 10, 12, 0.92)";
  ctx.fillRect(px, py, largura, altura);
  ctx.fillStyle = "#f87171";
  ctx.fillRect(px, py, 3, altura);
  ctx.fillStyle = "#fff1f2";
  ctx.fillText(texto, px + 10, py + altura * 0.5);
  ctx.restore();
}

/**
 * Trava vermelha no selvagem que o time foi mandado atacar.
 * A placa some se o cursor já está em cima — o hover mostra o nome.
 * Devolve o ator marcado, ou null.
 */
export function desenharAlvoOrdem(ctx, projetar, projetarPes, sobCursor) {
  const alvo = alvoDeOrdem();
  if (!ctx || !alvo || !projetar) return null;
  const z = alvo.elevacao ?? alvo.z ?? 0;
  const hop = alvo.hopLift || 0;
  const corpo = projetar(alvo.x, alvo.y, z, hop);
  if (!corpo) return alvo;
  const pes = projetarPes ? projetarPes(alvo.x, alvo.y, z, hop) : null;
  const pulso = Math.sin(relogioPokemon() * 4.2) * 0.5;
  if (pes) desenharAnel(ctx, pes, ANEL_ALVO, pulso);
  if (sobCursor !== alvo) desenharPlacaAlvo(ctx, corpo.x, corpo.y, alvo.especie?.nome);
  return alvo;
}

/**
 * Placa com nome, nível e tipos do Pokémon sob o cursor.
 */
export function desenharHoverPokemon(ctx, ator, projetar, projetarPes, comAnel = true) {
  if (!ctx || !ator || !projetar) return;
  const z = ator.elevacao ?? ator.z ?? 0;
  const hop = ator.hopLift || 0;
  const corpo = projetar(ator.x, ator.y, z, hop);
  if (!corpo) return;
  const pes = projetarPes ? projetarPes(ator.x, ator.y, z, hop) : null;
  if (pes && comAnel) desenharAnel(ctx, pes, ANEL_HOVER, 0);

  const tipos = ator.tipos || ator.especie?.tipos || [];
  const nome = `${ator.shiny ? "★ " : ""}${ator.especie?.nome || "Pokémon"}`;
  const nivel = `Nv ${ator.nivel | 0}`;
  ctx.save();
  ctx.font = "700 14px Segoe UI, sans-serif";
  ctx.textBaseline = "middle";
  const nomeW = ctx.measureText(nome).width;
  const nivelW = ctx.measureText(nivel).width;
  ctx.font = "700 11px Segoe UI, sans-serif";
  const chips = [];
  let chipsW = 0;
  for (let i = 0; i < tipos.length; i++) {
    const rotulo = nomeTipo(tipos[i]);
    const w = ctx.measureText(rotulo).width + 12;
    chips.push({ rotulo, tipo: tipos[i], w });
    chipsW += w;
    if (i) chipsW += 4;
  }
  const miolo = Math.max(nomeW + 10 + nivelW, chipsW);
  const largura = miolo + 20;
  const altura = chips.length ? 46 : 28;
  const canvas = ctx.canvas;
  let x = corpo.x - largura * 0.5;
  let y = corpo.y - altura - 16;
  if (canvas) {
    x = Math.max(8, Math.min(canvas.width - largura - 8, x));
    y = Math.max(8, Math.min(canvas.height - altura - 8, y));
  }

  ctx.fillStyle = ator.morto ? "rgba(20, 18, 16, 0.82)" : "rgba(8, 12, 10, 0.86)";
  ctx.fillRect(x, y, largura, altura);
  ctx.strokeStyle = "rgba(255, 248, 220, 0.92)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, largura - 1, altura - 1);

  ctx.font = "700 14px Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = ator.morto ? "#a8a29e" : "#f8fafc";
  ctx.fillText(nome, x + 10, y + 14);
  ctx.fillStyle = "rgba(255, 236, 180, 0.95)";
  ctx.textAlign = "right";
  ctx.fillText(nivel, x + largura - 10, y + 14);

  ctx.font = "700 11px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  let cx = x + (largura - chipsW) * 0.5;
  for (let i = 0; i < chips.length; i++) {
    const chip = chips[i];
    const cor = COR_TIPO[chip.tipo] || "#78716c";
    const cy = y + 28;
    ctx.fillStyle = cor;
    ctx.fillRect(cx, cy, chip.w, 14);
    ctx.fillStyle = tintaSobre(cor);
    ctx.fillText(chip.rotulo, cx + chip.w * 0.5, cy + 7);
    cx += chip.w + 4;
  }
  ctx.restore();
}

/**
 * Marcadores em espaço de tela. `projetar(x, y, z, hop)` devolve {x, y} ou null.
 */
export function desenharHudPokemon(ctx, projetar, corpo, projetarChao) {
  painel(ctx);
  if (!pokemonLigado() || !projetar) return;
  desenharMira(ctx, projetarChao || projetar, corpo);
  const atores = atoresVisiveis();
  for (let i = 0; i < atores.length; i++) {
    const a = atores[i];
    const p = projetar(a.x, a.y, a.z, a.hopLift || 0);
    if (!p) continue;
    marcador(ctx, a, p);
  }
  textos(ctx, projetar);
  carga(ctx, projetar, corpo);
}
