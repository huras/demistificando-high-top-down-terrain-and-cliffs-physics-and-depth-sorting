import { progressoExp } from "./experiencia.js";
import { colunaEmocao, folhaEmocoes } from "./emocoes.js";
import { flutuantes } from "./flutuantes.js";
import { cargaAtual } from "./captura.js";
import { obterBolas, pokemonNoCampo } from "./party.js";
import { pedirRetrato } from "./retrato.js";
import { atoresVisiveis, obterTreinador, pokemonLigado, relogioPokemon } from "./sistema.js";
import { ALTURA_BLOCO } from "../config.js";
import { mundoParaTelaX, mundoParaTelaY } from "../render/camera.js";
import * as THREE from "three";

const _ponto = new THREE.Vector3();

export function projetar2d(camera) {
  const zoom = camera?.zoom || 1;
  return (x, y, z, hop) => ({
    x: (mundoParaTelaX(x) - camera.x) * zoom,
    y: (mundoParaTelaY(y, z, hop || 0) - 48 - camera.y) * zoom,
  });
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

function painel(ctx) {
  if (!pokemonLigado()) return;
  const mon = pokemonNoCampo();
  const treino = obterTreinador();
  ctx.save();
  ctx.font = "600 13px Segoe UI, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(8, 12, 10, 0.72)";
  ctx.fillRect(12, 12, 220, mon ? 112 : 70);
  ctx.fillStyle = "#e7e5e4";
  const hpT = treino.hp / treino.hpMax;
  ctx.fillText(`você  ${Math.ceil(treino.hp)}/${treino.hpMax}`, 20, 16);
  barra(ctx, 20, 34, 120, 6, hpT, hpT < 0.35 ? "#f87171" : "#86efac", "#1c1917");
  ctx.fillText(`bolas ${obterBolas()}`, 150, 28);
  if (mon) {
    const nome = `${mon.shiny ? "★ " : ""}${mon.especie.nome}  Nv${mon.nivel}`;
    ctx.fillStyle = mon.morto ? "#a8a29e" : "#f8fafc";
    ctx.fillText(nome, 20, 46);
    const hp = mon.morto ? 0 : mon.hp / mon.hpMax;
    barra(ctx, 20, 64, 140, 6, hp, "#4ade80", "#1c1917");
    barra(ctx, 20, 74, 140, 3, progressoExp(mon.nivel, mon.exp, mon.crescimento), "#60a5fa", "#1c1917");
  }
  ctx.font = "12px Segoe UI, sans-serif";
  ctx.fillStyle = "rgba(231, 229, 228, 0.8)";
  ctx.fillText("segurar B · pokébola", 20, mon ? 86 : 52);
  ctx.restore();
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
  ctx.font = "700 14px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  for (let i = 0; i < lista.length; i++) {
    const f = lista[i];
    const p = projetar(f.x, f.y, f.z, 0);
    if (!p) continue;
    ctx.globalAlpha = Math.max(0, 1 - f.idade / 0.85);
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

/**
 * Marcadores em espaço de tela. `projetar(x, y, z, hop)` devolve {x, y} ou null.
 */
export function desenharHudPokemon(ctx, projetar, corpo) {
  painel(ctx);
  if (!pokemonLigado() || !projetar) return;
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
