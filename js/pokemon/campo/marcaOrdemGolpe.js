/**
 * Pino da ordem de golpe: anel no chão, gota, retrato e ícone.
 * Espaço de tela, tamanho fixo. Sem mesh e sem alocação por frame.
 */
import { pedirIconeGolpe } from "../../jogo/iconesGolpe.js";
import { pokemonDeployado } from "../party.js";
import { pedirRetrato } from "../retrato.js";
import { relogioPokemon } from "../sistema.js";
import { COR_TIPO } from "../tipos.js";

const CABECA = 17;
const FACE = 12.5;
const SELO = 8;
const BORDA = "rgba(8, 10, 16, 0.88)";
const MIOLIO = "#f8fafc";
const leitura = { mon: null, ordem: null, def: null };

function lerOrdem() {
  const mon = pokemonDeployado();
  const ordem = mon?.ordemGolpe;
  const def = ordem?.ativa ? mon.golpes?.[ordem.slot]?.def : null;
  if (!mon || !def) {
    leitura.mon = null;
    leitura.ordem = null;
    leitura.def = null;
    return false;
  }
  leitura.mon = mon;
  leitura.ordem = ordem;
  leitura.def = def;
  return true;
}

function alvoVivo(alvo) {
  return !!(alvo && !alvo._pontoOrdem && !alvo.morto && !alvo.capturado && alvo.hp > 0);
}

/** Ator que o pino cobre neste frame, ou null se a ordem é num ponto. */
export function atorDaMarca() {
  if (!lerOrdem()) return null;
  return alvoVivo(leitura.ordem.alvo) ? leitura.ordem.alvo : null;
}

function imagemPronta(img) {
  return !!(img && img.complete && img.naturalWidth > 0);
}

function desenharAnel(ctx, x, y, cor, pulso) {
  const rx = 26 + pulso * 2;
  const ry = 10 + pulso;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = cor;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 3;
  ctx.strokeStyle = BORDA;
  ctx.stroke();
  ctx.lineWidth = 1.75;
  ctx.strokeStyle = cor;
  ctx.stroke();
}

function desenharGota(ctx, cx, pontaY, cor) {
  const cy = pontaY - 22;
  ctx.beginPath();
  ctx.arc(cx, cy, CABECA, Math.PI, 0);
  ctx.bezierCurveTo(cx + CABECA * 0.55, cy + CABECA * 0.9, cx + 4, pontaY - 7, cx, pontaY);
  ctx.bezierCurveTo(cx - 4, pontaY - 7, cx - CABECA * 0.55, cy + CABECA * 0.9, cx - CABECA, cy);
  ctx.closePath();
  ctx.fillStyle = cor;
  ctx.fill();
  ctx.lineWidth = 2.25;
  ctx.strokeStyle = BORDA;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, FACE + 1.25, 0, Math.PI * 2);
  ctx.fillStyle = MIOLIO;
  ctx.fill();
  return cy;
}

function desenharFace(ctx, cx, cy, face, cor) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, FACE, 0, Math.PI * 2);
  ctx.clip();
  if (imagemPronta(face)) {
    ctx.drawImage(face, cx - FACE, cy - FACE, FACE * 2, FACE * 2);
  } else {
    ctx.fillStyle = cor;
    ctx.fillRect(cx - FACE, cy - FACE, FACE * 2, FACE * 2);
  }
  ctx.restore();
}

function desenharSelo(ctx, cx, cy, icone, letra, cor) {
  const bx = cx + CABECA * 0.62;
  const by = cy + CABECA * 0.62;
  ctx.beginPath();
  ctx.arc(bx, by, SELO + 1.6, 0, Math.PI * 2);
  ctx.fillStyle = MIOLIO;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx, by, SELO, 0, Math.PI * 2);
  ctx.fillStyle = cor;
  ctx.fill();
  if (imagemPronta(icone)) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(bx, by, SELO - 0.5, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(icone, bx - SELO, by - SELO, SELO * 2, SELO * 2);
    ctx.restore();
    return;
  }
  ctx.fillStyle = MIOLIO;
  ctx.font = "700 9px Segoe UI, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letra, bx, by + 0.5);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {(x: number, y: number, z: number, hop: number) => { x: number, y: number } | null} projetar
 * @param {(x: number, y: number, z: number, hop: number) => { x: number, y: number } | null} [projetarPes]
 */
export function desenharMarcaOrdemGolpe(ctx, projetar, projetarPes) {
  if (!ctx || !projetar || !lerOrdem()) return;

  const { mon, ordem, def } = leitura;
  const segue = alvoVivo(ordem.alvo) ? ordem.alvo : null;
  const x = segue ? segue.x : ordem.x;
  const y = segue ? segue.y : ordem.y;
  const z = segue ? segue.elevacao ?? segue.z ?? 0 : ordem.z;
  const hop = segue ? segue.hopLift || 0 : 0;
  const ancorar = projetarPes || projetar;
  const pes = ancorar(x, y, z, hop);
  if (!pes) return;

  const cor = COR_TIPO[def.tipo] || COR_TIPO.normal;
  const t = relogioPokemon();
  const pulso = Math.sin(t * 4.2) * 0.5;
  const bob = Math.sin(t * 3) * 3;
  const face = pedirRetrato(mon.especie?.dex, mon.shiny);
  const icone = pedirIconeGolpe(def.key, def.tipo);
  const nome = def.nome || def.name || def.key || "?";
  const letra = nome.charAt(0).toUpperCase() || "?";

  ctx.save();
  desenharAnel(ctx, pes.x, pes.y, cor, pulso);
  const cy = desenharGota(ctx, pes.x, pes.y + bob, cor);
  desenharFace(ctx, pes.x, cy, face, cor);
  desenharSelo(ctx, pes.x, cy, icone, letra, cor);
  ctx.restore();
}
