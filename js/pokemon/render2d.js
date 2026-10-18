import { ESCALA, TILE } from "../config.js";
import { alfaSprites } from "../jogo/teleporte.js";
import { oscilacaoNado } from "../fx/fxAgua.js";
import { cobrirPernasAgua } from "../render/agua2d.js";
import { mundoParaTelaX, mundoParaTelaY } from "../render/camera.js";
import { chaveEntidade, empilhar } from "../render/ordenacaoProfundidade.js";
import { obterBola } from "./captura.js";
import { dropsNoChao } from "./drops.js";
import { impactosVivos, projeteisVivos } from "./combate/projeteis.js";
import { carregarFolhasGolpe, poseImpacto, poseTiro, telaFolha } from "./combate/folhasGolpe.js";
import { auraDe, ORBES_KI } from "./combate/ki.js";
import { blitQuadro, centroDoQuadro, quadroDe, garantirAtlas, medidaSprite } from "./sprites.js";
import { atoresVisiveis } from "./sistema.js";
import { COR_TIPO } from "./tipos.js";

/** Na tela, 1 px de arte vira ESCALA px: o voxel mede TILE×ESCALA, então o mundo fica px/TILE. */
const PX = ESCALA;

function desenharSombra(ctx, x, y, escala) {
  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.35)";
  ctx.beginPath();
  ctx.arc(x, y, 8 * escala, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function desenharCorpo(ctx, ator) {
  const alfa = ator.faccao === "party" ? alfaSprites() : 1;
  const medida = medidaSprite(ator);
  const { escala, offsetY, dx, dy } = medida;
  const chaoX = mundoParaTelaX(ator.x);
  const hop = ator.hopLift || 0;
  const chaoY = mundoParaTelaY(ator.y, ator.z, hop);
  const footX = chaoX;
  const footY = mundoParaTelaY(ator.y, ator.z, hop + oscilacaoNado(ator)) + offsetY * TILE * ESCALA;
  const pack = garantirAtlas(ator.especie.dex, ator.shiny);
  const fr = quadroDe(ator, pack);
  const pronto = !!(fr && pack.img && pack.estado === "pronto");
  const centro = centroDoQuadro(fr, medida);
  if (alfa > 0.04) desenharSombra(ctx, chaoX + centro.x * PX * escala, chaoY, escala * alfa);
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.imageSmoothingEnabled = false;
  if (pronto) {
    blitQuadro(ctx, pack.img, pack.atlasW, pack.atlasH, fr, footX, footY, PX * escala, { dx, dy });
  } else {
    const cor = ator.especie.cor || COR_TIPO[ator.tipos?.[0]] || "#94a3b8";
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.arc(footX, footY - 16 * escala, 12 * escala, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  cobrirPernasAgua(ctx, ator, retanguloAgua(pronto ? fr : null, medida, footX, footY));
  desenharKi(ctx, ator, footX, footY, escala);
  desenharFlashCorpo(ctx, ator, footX, footY, escala);
}

/** Caixa do sprite, do mesmo jeito que o blit, para o véu da água. */
function retanguloAgua(fr, medida, footX, footY) {
  const escala = PX * medida.escala;
  if (!fr || !(fr.w > 0)) {
    const r = 12 * medida.escala;
    return {
      px: footX - r,
      py: footY - 28 * medida.escala,
      dw: r * 2,
      peY: footY - 4 * medida.escala,
    };
  }
  const trimX = fr.trimX || 0;
  const trimW = fr.trimW || fr.w;
  const trimH = fr.trimH || fr.h;
  const quadro = fr.w * escala;
  const destW = trimW * escala;
  const destH = trimH * escala;
  const pivotX = 1 - (fr.pivotX ?? 0.5);
  const trimEsq = fr.w - trimX - trimW;
  const px = footX - pivotX * quadro + trimEsq * escala + medida.dx * escala;
  const py = footY - destH + medida.dy * escala;
  return { px, py, dw: destW, peY: py + destH };
}

function desenharFlashCorpo(ctx, ator, x, y, escala) {
  const max = ator.brilhoBolaTipo === "recolher" ? 0.35 : 0.4;
  const resto = ator.brilhoBola;
  if (!(resto > 0) || ator.brilhoBolaTipo !== "envio") return;
  const t = Math.min(1, resto / max);
  const pulso = 0.6 + 0.4 * Math.sin((1 - t) * Math.PI * 5);
  const base = 0.4 * TILE * ESCALA;
  const externo = base * (1.25 + (1 - t) * 0.55);
  const cy = y - 18 * escala;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, cy, externo, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,255,255,${0.28 + 0.55 * t * pulso})`;
  ctx.lineWidth = Math.max(2, base * 0.12);
  ctx.stroke();
  ctx.restore();
}

function desenharKi(ctx, ator, x, y, escala) {
  const aura = auraDe(ator);
  if (!aura?.viva) return;
  const u = aura.u;
  const pulso = 1 + Math.sin(aura.ang * 3) * 0.08;
  const raio = (8 + u * 16) * escala * pulso;
  const cy = y - 18 * escala;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = aura.cor;
  ctx.globalAlpha = 0.35 + u * 0.4;
  ctx.beginPath();
  ctx.arc(x, cy, raio, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(x, cy, raio * 0.38, 0, Math.PI * 2);
  ctx.fill();
  const orb = (16 - u * 8) * escala;
  for (let i = 0; i < ORBES_KI; i++) {
    const a = aura.ang + (i / ORBES_KI) * Math.PI * 2;
    ctx.globalAlpha = 0.55 + u * 0.4;
    ctx.fillStyle = aura.cor;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * orb, cy + Math.sin(a) * orb * 0.55, (2.4 + u * 1.8) * escala, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function desenharDrop(ctx, item) {
  const x = mundoParaTelaX(item.x);
  const y = mundoParaTelaY(item.y, item.z, 0);
  ctx.save();
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x + 6, y - 4);
  ctx.lineTo(x, y + 2);
  ctx.lineTo(x - 6, y - 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function desenharFolha(ctx, p, pose) {
  const tela = telaFolha(pose.chave);
  if (!tela) return false;
  const x = mundoParaTelaX(p.x);
  const y = mundoParaTelaY(p.y, p.z, 0);
  const lado = Math.max(8, pose.escala * TILE * ESCALA);
  const sy = pose.frame * (tela.height / pose.frames);
  const sh = tela.height / pose.frames;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = pose.alpha == null ? 1 : pose.alpha;
  ctx.translate(x, y);
  ctx.rotate(pose.angulo || 0);
  ctx.drawImage(tela, 0, sy, tela.width, sh, -lado / 2, -lado / 2, lado, lado);
  ctx.restore();
  return true;
}

function desenharProjetil(ctx, p) {
  carregarFolhasGolpe();
  const pose = p.impacto ? poseImpacto(p, null, true) : poseTiro(p, null, true);
  if (pose && desenharFolha(ctx, p, pose)) return;
  const x = mundoParaTelaX(p.x);
  const y = mundoParaTelaY(p.y, p.z, 0);
  ctx.save();
  ctx.fillStyle = p.cor || "#fff";
  ctx.translate(x, y);
  ctx.rotate(p.ang || 0);
  const raio = Math.max(4, (p.escala || 0.45) * 16);
  ctx.beginPath();
  ctx.ellipse(0, 0, raio, p.giro ? raio * 0.45 : raio, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function desenharBola(ctx, bola) {
  const x = mundoParaTelaX(bola.x);
  const y = mundoParaTelaY(bola.y, bola.z, 0);
  const pulo = bola.fase === "tremendo" ? Math.sin(bola.faseT * 18) * 3 : 0;
  ctx.save();
  ctx.translate(x, y + pulo);
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(0, 0, 7, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.moveTo(-7, 0);
  ctx.lineTo(7, 0);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function empilharPokemon(lista) {
  const atores = atoresVisiveis();
  for (let i = 0; i < atores.length; i++) {
    const ator = atores[i];
    empilhar(lista, chaveEntidade(ator.y, ator.z), 0, (ctx) => desenharCorpo(ctx, ator), 7, ator.z);
  }
  const drops = dropsNoChao();
  for (let i = 0; i < drops.length; i++) {
    const item = drops[i];
    empilhar(lista, chaveEntidade(item.y, item.z), 0, (ctx) => desenharDrop(ctx, item), 4, item.z);
  }
  const tiros = projeteisVivos();
  for (let i = 0; i < tiros.length; i++) {
    const p = tiros[i];
    empilhar(lista, chaveEntidade(p.y, p.z), 0, (ctx) => desenharProjetil(ctx, p), 8, p.z);
  }
  const impactos = impactosVivos();
  for (let i = 0; i < impactos.length; i++) {
    const p = impactos[i];
    empilhar(lista, chaveEntidade(p.y, p.z), 0, (ctx) => desenharProjetil(ctx, p), 8, p.z);
  }
  const bola = obterBola();
  if (bola) {
    empilhar(lista, chaveEntidade(bola.y, bola.z), 0, (ctx) => desenharBola(ctx, bola), 9, bola.z);
  }
}
