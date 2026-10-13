/** Sala 2D por cima do mundo. Colisão na grade; props e NPCs são sprites no pé. */

import { teclaBaixa } from "../entrada/teclado.js";
import { MOVEIS } from "../wild/catalogo.js";
import { celulaLivre } from "../wild/salas.js";
import { estado } from "./estado.js";

const PX = 48;
let tela = null;
let ctx = null;

export function ligarSala(canvas) {
  tela = canvas;
  ctx = canvas.getContext("2d");
}

export function redimensionarSala(w, h) {
  if (!tela) return;
  tela.width = w;
  tela.height = h;
}

export function moverSala(dt) {
  const interior = estado.interior;
  if (!interior) return;
  let dx = 0;
  let dy = 0;
  if (teclaBaixa("KeyA") || teclaBaixa("ArrowLeft")) dx -= 1;
  if (teclaBaixa("KeyD") || teclaBaixa("ArrowRight")) dx += 1;
  if (teclaBaixa("KeyW") || teclaBaixa("ArrowUp")) dy -= 1;
  if (teclaBaixa("KeyS") || teclaBaixa("ArrowDown")) dy += 1;
  const len = Math.hypot(dx, dy) || 1;
  const passo = 3.2 * dt;
  tentar(interior, interior.px + (dx / len) * passo, interior.py);
  tentar(interior, interior.px, interior.py + (dy / len) * passo);
  const saida = interior.sala.saida;
  if (Math.hypot(interior.px - (saida.x + 0.5), interior.py - (saida.y + 0.5)) < 0.45) {
    interior.saindo = true;
  }
}

function tentar(interior, x, y) {
  const sala = interior.sala;
  if (!ocupado(sala, interior, x, y)) {
    interior.px = x;
    interior.py = y;
  }
}

function ocupado(sala, interior, x, y) {
  const pontos = [
    [x - 0.22, y - 0.22],
    [x + 0.22, y - 0.22],
    [x - 0.22, y + 0.22],
    [x + 0.22, y + 0.22],
  ];
  for (let i = 0; i < pontos.length; i++) {
    const cx = pontos[i][0];
    const cy = pontos[i][1];
    if (!celulaLivre(sala, cx, cy)) return true;
    if (bloqueioProp(sala, interior, Math.floor(cx), Math.floor(cy))) return true;
  }
  return false;
}

function bloqueioProp(sala, interior, ix, iy) {
  const lista = propsDaSala(sala, interior);
  for (let i = 0; i < lista.length; i++) {
    const p = lista[i];
    if (p.x === ix && p.y === iy) return true;
  }
  for (let i = 0; i < sala.npcs.length; i++) {
    const n = sala.npcs[i];
    if (n.x === ix && n.y === iy) return true;
  }
  return false;
}

export function propsDaSala(sala, interior) {
  const lista = sala.props.slice();
  const extra = estado.moveis[interior.casaId] || [];
  for (let i = 0; i < extra.length; i++) {
    const m = extra[i];
    const def = MOVEIS[m.key];
    if (!def) continue;
    lista.push({
      key: m.key,
      nome: def.nome,
      x: m.x,
      y: m.y,
      cor: def.cor,
      cura: !!def.cura,
      craft: !!def.craft,
    });
  }
  return lista;
}

export function pertoDe(interior) {
  if (!interior) return null;
  const sala = interior.sala;
  let melhor = null;
  let dist = 1.35;
  const alvos = [];
  for (let i = 0; i < sala.npcs.length; i++) alvos.push({ tipo: "npc", ref: sala.npcs[i] });
  const props = propsDaSala(sala, interior);
  for (let i = 0; i < props.length; i++) alvos.push({ tipo: "prop", ref: props[i] });
  for (let i = 0; i < alvos.length; i++) {
    const r = alvos[i].ref;
    const d = Math.hypot(interior.px - (r.x + 0.5), interior.py - (r.y + 0.5));
    if (d < dist) {
      dist = d;
      melhor = alvos[i];
    }
  }
  return melhor;
}

export function desenharSala(largura, altura) {
  if (!ctx || !tela) return;
  const interior = estado.interior;
  tela.hidden = !interior;
  if (!interior) return;
  const sala = interior.sala;
  ctx.clearRect(0, 0, largura, altura);
  ctx.fillStyle = "#1a140f";
  ctx.fillRect(0, 0, largura, altura);
  const ox = largura / 2 - interior.px * PX;
  const oy = altura / 2 - interior.py * PX;
  for (let y = 0; y < sala.rows; y++) {
    for (let x = 0; x < sala.cols; x++) {
      ctx.fillStyle = sala.grade[y][x] ? sala.parede : sala.chao;
      ctx.fillRect(ox + x * PX, oy + y * PX, PX - 1, PX - 1);
    }
  }
  const saida = sala.saida;
  ctx.fillStyle = "#c4a574";
  ctx.fillRect(ox + saida.x * PX, oy + saida.y * PX, PX - 1, PX - 1);
  const props = propsDaSala(sala, interior);
  for (let i = 0; i < props.length; i++) desenharPe(ctx, ox, oy, props[i], props[i].cor, props[i].nome);
  for (let i = 0; i < sala.npcs.length; i++) {
    desenharPe(ctx, ox, oy, sala.npcs[i], sala.npcs[i].cor, sala.npcs[i].nome);
  }
  ctx.fillStyle = "#1d4ed8";
  ctx.beginPath();
  ctx.arc(largura / 2, altura / 2, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "14px sans-serif";
  ctx.fillText(sala.titulo, 16, 28);
}

function desenharPe(ctx2, ox, oy, ent, cor, nome) {
  const x = ox + ent.x * PX + PX / 2;
  const y = oy + ent.y * PX + PX - 8;
  ctx2.fillStyle = cor;
  ctx2.fillRect(x - 14, y - 36, 28, 32);
  ctx2.fillStyle = "#1c1917";
  ctx2.font = "11px sans-serif";
  ctx2.textAlign = "center";
  ctx2.fillText(nome, x, y - 40);
  ctx2.textAlign = "left";
}

export function celulaConstrucao(interior) {
  if (!interior) return null;
  return { x: Math.floor(interior.px), y: Math.floor(interior.py + 0.8) };
}
