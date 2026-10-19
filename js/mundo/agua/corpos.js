/**
 * Formas de líquido em blocos de mundo. A consulta é uma grade de 64:
 * cada coluna olha só a célula, nunca a lista inteira.
 */
import { BLOCO } from "../voxel/tiposBloco.js";
import { FLUIDO } from "./fluidos.js";

const CELULA = 64;
const LADO = 64;
const EXTENSAO = CELULA * LADO;

const VAZIO = Object.freeze({ tem: 0 });

const CORPOS = [
  lago(2920, 690, 22, 14, 16, 4, FLUIDO.AGUA),
  rio(FLUIDO.AGUA, 6, 2, [
    [1392, 648, 32],
    [1390, 730, 30],
    [1388, 778, 30],
    [1388, 798, 16],
    [1404, 980, 15],
  ]),
  lago(2660, 3220, 72, 48, 16, 1, FLUIDO.PANTANO),
  vulcao(1390, 3436, 26, 8, 16, 38, 20, 23),
];

let indice = null;
let listas = null;

function lago(cx, cy, rx, ry, superficie, prof, fluido) {
  return {
    tipo: "lago",
    fluido,
    cx,
    cy,
    rx,
    ry,
    superficie,
    prof,
    solido: BLOCO.TERRA,
    prioridade: 1,
  };
}

function rio(fluido, largura, prof, pontos) {
  let x0 = pontos[0][0];
  let y0 = pontos[0][1];
  let x1 = x0;
  let y1 = y0;
  for (let i = 1; i < pontos.length; i++) {
    const p = pontos[i];
    if (p[0] < x0) x0 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[0] > x1) x1 = p[0];
    if (p[1] > y1) y1 = p[1];
  }
  const plano = new Float32Array(pontos.length * 3);
  for (let i = 0; i < pontos.length; i++) {
    plano[i * 3] = pontos[i][0];
    plano[i * 3 + 1] = pontos[i][1];
    plano[i * 3 + 2] = pontos[i][2];
  }
  return {
    tipo: "rio",
    fluido,
    largura,
    prof,
    pontos: plano,
    x0: x0 - largura,
    y0: y0 - largura,
    x1: x1 + largura,
    y1: y1 + largura,
    solido: BLOCO.TERRA,
    prioridade: 2,
  };
}

function vulcao(cx, cy, raio, cratera, base, pico, piso, superficie) {
  return {
    tipo: "vulcao",
    fluido: FLUIDO.LAVA,
    cx,
    cy,
    raio,
    cratera,
    base,
    pico,
    piso,
    superficie,
    solido: BLOCO.PEDRA,
    prioridade: 3,
  };
}

function garantir() {
  if (indice) return;
  indice = new Int16Array(LADO * LADO);
  indice.fill(-1);
  listas = [];
  for (let i = 0; i < CORPOS.length; i++) {
    const corpo = CORPOS[i];
    const caixa = limites(corpo);
    const c0x = Math.max(0, Math.floor(caixa[0] / CELULA));
    const c0y = Math.max(0, Math.floor(caixa[1] / CELULA));
    const c1x = Math.min(LADO - 1, Math.floor(caixa[2] / CELULA));
    const c1y = Math.min(LADO - 1, Math.floor(caixa[3] / CELULA));
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const k = cy * LADO + cx;
        let id = indice[k];
        if (id < 0) {
          id = listas.length;
          listas.push([]);
          indice[k] = id;
        }
        listas[id].push(corpo);
      }
    }
  }
}

function limites(corpo) {
  if (corpo.tipo === "lago") {
    return [corpo.cx - corpo.rx, corpo.cy - corpo.ry, corpo.cx + corpo.rx, corpo.cy + corpo.ry];
  }
  if (corpo.tipo === "rio") return [corpo.x0, corpo.y0, corpo.x1, corpo.y1];
  return [corpo.cx - corpo.raio, corpo.cy - corpo.raio, corpo.cx + corpo.raio, corpo.cy + corpo.raio];
}

function avaliar(corpo, x, y, saida) {
  if (corpo.tipo === "lago") return avaliarLago(corpo, x, y, saida);
  if (corpo.tipo === "rio") return avaliarRio(corpo, x, y, saida);
  return avaliarVulcao(corpo, x, y, saida);
}

function avaliarLago(corpo, x, y, saida) {
  const dx = (x - corpo.cx) / corpo.rx;
  const dy = (y - corpo.cy) / corpo.ry;
  if (dx * dx + dy * dy > 1) return false;
  const piso = corpo.superficie - corpo.prof;
  saida.fluido = corpo.fluido;
  saida.piso = piso;
  saida.a0 = piso;
  saida.a1 = corpo.superficie;
  saida.queda = 0;
  saida.altura = corpo.superficie;
  saida.solido = corpo.solido;
  return true;
}

function avaliarRio(corpo, x, y, saida) {
  const pts = corpo.pontos;
  const n = (pts.length / 3) | 0;
  const meia = corpo.largura * 0.5;
  let melhor = meia;
  let achou = false;
  let piso = 0;
  let a0 = 0;
  let a1 = 0;
  let queda = 0;
  for (let i = 0; i < n - 1; i++) {
    const o = i * 3;
    const ax = pts[o];
    const ay = pts[o + 1];
    const az = pts[o + 2];
    const bx = pts[o + 3];
    const by = pts[o + 4];
    const bz = pts[o + 5];
    const abx = bx - ax;
    const aby = by - ay;
    const len2 = abx * abx + aby * aby;
    if (len2 < 1e-4) continue;
    let t = ((x - ax) * abx + (y - ay) * aby) / len2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const px = ax + abx * t;
    const py = ay + aby * t;
    const d = Math.hypot(x - px, y - py);
    if (d > melhor) continue;
    melhor = d;
    achou = true;
    const dz = bz - az;
    const len = Math.sqrt(len2);
    if (Math.abs(dz) > 1 && len <= Math.abs(dz) * 2.5) {
      const alto = Math.max(az, bz);
      const baixo = Math.min(az, bz);
      piso = baixo | 0;
      a0 = (alto - 1) | 0;
      a1 = alto | 0;
      queda = 1;
    } else {
      piso = (az + dz * t) | 0;
      a0 = piso;
      a1 = piso + corpo.prof;
      queda = 0;
    }
  }
  if (!achou) return false;
  saida.fluido = corpo.fluido;
  saida.piso = piso;
  saida.a0 = a0;
  saida.a1 = a1;
  saida.queda = queda;
  saida.altura = a1;
  saida.solido = corpo.solido;
  return true;
}

function avaliarVulcao(corpo, x, y, saida) {
  const d = Math.hypot(x - corpo.cx, y - corpo.cy);
  if (d > corpo.raio) return false;
  if (d <= corpo.cratera) {
    saida.fluido = corpo.fluido;
    saida.piso = corpo.piso;
    saida.a0 = corpo.piso;
    saida.a1 = corpo.superficie;
    saida.queda = 0;
    saida.altura = corpo.superficie;
    saida.solido = corpo.solido;
    return true;
  }
  const t = (d - corpo.cratera) / (corpo.raio - corpo.cratera);
  const h = Math.round(corpo.pico + (corpo.base - corpo.pico) * t);
  saida.fluido = FLUIDO.NENHUM;
  saida.piso = h;
  saida.a0 = h;
  saida.a1 = h;
  saida.queda = 0;
  saida.altura = h;
  saida.solido = BLOCO.PEDRA;
  return true;
}

/**
 * Preenche `saida` se a coluna cai num corpo. Sem alocação no caminho quente.
 * `saida.tem` é 0 quando a célula está vazia.
 */
export function amostraCorpo(x, y, saida) {
  garantir();
  saida.tem = 0;
  if (x < 0 || y < 0 || x >= EXTENSAO || y >= EXTENSAO) return saida;
  const cx = (x / CELULA) | 0;
  const cy = (y / CELULA) | 0;
  const id = indice[cy * LADO + cx];
  if (id < 0) return saida;
  const lista = listas[id];
  let melhor = null;
  let prio = -1;
  for (let i = 0; i < lista.length; i++) {
    const corpo = lista[i];
    if (corpo.prioridade <= prio) continue;
    if (!avaliar(corpo, x, y, saida)) continue;
    melhor = corpo;
    prio = corpo.prioridade;
    saida.tem = 1;
  }
  if (!melhor) {
    saida.tem = 0;
    saida.fluido = 0;
  }
  return saida;
}

export function celulaCorpos() {
  return CELULA;
}
