/**
 * Campo de água no relevo. Cada corpo devolve cava e superfície;
 * o heightmap desce e a lâmina só enche o leito. Ruído (fbm) molda
 * borda de lago e meandro de rio. Cidade, rua, prédio e mar ficam fora.
 */
import { BLOCO } from "../voxel/tiposBloco.js";
import { fbm2 } from "../voxel/ruido.js";
import { FLUIDO } from "./fluidos.js";

const CELULA = 64;
const LADO = 64;
const EXTENSAO = CELULA * LADO;
const SEMENTE = 1337;

/** Quem informa se a coluna é infraestrutura (cidade/rua/mar). */
let consultaReserva = null;
/** Altura base sem água — só para ref do lago no boot da grade. */
let consultaAltura = null;

/**
 * Cerulean em mato a leste; Pewter desce a serra; Fuchsia no marsh;
 * Cinnabar com cone e cratera.
 */
const CORPOS = [
  lago(2950, 610, 18, 14, 3, FLUIDO.AGUA),
  // Desce a serra e contorna Pewter pelo leste (fora da célula da cidade).
  rio(FLUIDO.AGUA, 5, 2, [
    [1390, 555],
    [1390, 595],
    [1390, 615],
    [1390, 635],
    [1412, 650],
    [1416, 720],
    [1420, 860],
    [1424, 980],
  ]),
  lago(2500, 3055, 36, 24, 1, FLUIDO.PANTANO),
  // Sul de Cinnabar, fora da célula da cidade.
  vulcao(1390, 3480, 26, 8, 16, 34, 12, 15),
];

let indice = null;
let listas = null;

function lago(cx, cy, rx, ry, prof, fluido) {
  return {
    tipo: "lago",
    fluido,
    cx,
    cy,
    rx,
    ry,
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
  const folga = largura + 8;
  const plano = new Float32Array(pontos.length * 2);
  for (let i = 0; i < pontos.length; i++) {
    plano[i * 2] = pontos[i][0];
    plano[i * 2 + 1] = pontos[i][1];
  }
  return {
    tipo: "rio",
    fluido,
    largura,
    prof,
    pontos: plano,
    x0: x0 - folga,
    y0: y0 - folga,
    x1: x1 + folga,
    y1: y1 + folga,
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

/**
 * Liga consultas de infraestrutura e altura base.
 * Chamado uma vez por amostraKanto para evitar ciclo de import.
 */
export function ligarConsultasCorpo(reservaFn, alturaFn) {
  consultaReserva = reservaFn;
  consultaAltura = alturaFn;
}

function reservado(x, y) {
  return consultaReserva ? !!consultaReserva(x, y) : false;
}

function garantir() {
  if (indice) return;
  indice = new Int16Array(LADO * LADO);
  indice.fill(-1);
  listas = [];
  for (let i = 0; i < CORPOS.length; i++) {
    const corpo = CORPOS[i];
    if (corpo.tipo === "lago" && consultaAltura) {
      corpo.refH = consultaAltura(corpo.cx, corpo.cy) | 0;
    }
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

function avaliar(corpo, x, y, baseH, saida) {
  if (corpo.tipo === "lago") return avaliarLago(corpo, x, y, baseH, saida);
  if (corpo.tipo === "rio") return avaliarRio(corpo, x, y, baseH, saida);
  return avaliarVulcao(corpo, x, y, baseH, saida);
}

/** Cava 1 ou 2 blocos no chão local; a lâmina fica rente à borda. */
function cavaRasa(prof, forca) {
  const alvo = Math.round((prof || 1) * forca);
  return Math.max(1, Math.min(2, alvo || 1));
}

function avaliarLago(corpo, x, y, baseH, saida) {
  const dx = (x - corpo.cx) / corpo.rx;
  const dy = (y - corpo.cy) / corpo.ry;
  const r2 = dx * dx + dy * dy;
  if (r2 > 1) return false;
  const ruido = 0.55 + 0.45 * fbm2(x * 0.07, y * 0.07, SEMENTE + 19, 3);
  const borda = 1 - Math.sqrt(r2);
  const forca = borda * ruido;
  if (forca < 0.14) return false;
  const cava = cavaRasa(corpo.prof, forca);
  // Superfície = chão local: a água enche o buraco, sem subir acima do terreno.
  saida.fluido = corpo.fluido;
  saida.cava = cava;
  saida.superficie = baseH;
  saida.sobe = 0;
  saida.altura = baseH;
  saida.solido = corpo.solido;
  return true;
}

function avaliarRio(corpo, x, y, baseH, saida) {
  const pts = corpo.pontos;
  const n = (pts.length / 2) | 0;
  const meia = corpo.largura * 0.5;
  let melhor = meia + 4;
  let achou = false;
  let distEixo = 0;
  for (let i = 0; i < n - 1; i++) {
    const o = i * 2;
    const ax = pts[o];
    const ay = pts[o + 1];
    const bx = pts[o + 2];
    const by = pts[o + 3];
    const abx = bx - ax;
    const aby = by - ay;
    const len2 = abx * abx + aby * aby;
    if (len2 < 1e-4) continue;
    const len = Math.sqrt(len2);
    const nx = -aby / len;
    const ny = abx / len;
    const meandro = (fbm2(x * 0.05, y * 0.05, SEMENTE + 41, 3) - 0.5) * corpo.largura * 1.6;
    const ox = ax + nx * meandro;
    const oy = ay + ny * meandro;
    const obx = bx + nx * meandro;
    const oby = by + ny * meandro;
    const ex = obx - ox;
    const ey = oby - oy;
    const elen2 = ex * ex + ey * ey;
    let t = ((x - ox) * ex + (y - oy) * ey) / elen2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const px = ox + ex * t;
    const py = oy + ey * t;
    const d = Math.hypot(x - px, y - py);
    if (d > melhor) continue;
    melhor = d;
    distEixo = d;
    achou = true;
  }
  if (!achou || distEixo > meia + 2) return false;
  const ruido = 0.7 + 0.3 * fbm2(x * 0.11, y * 0.11, SEMENTE + 73, 2);
  const u = Math.max(0, 1 - distEixo / (meia + 0.01));
  const perfil = u * u * ruido;
  if (perfil < 0.18) return false;
  const cava = cavaRasa(corpo.prof, Math.max(0.5, perfil));
  saida.fluido = corpo.fluido;
  saida.cava = cava;
  saida.superficie = baseH;
  saida.sobe = 0;
  saida.altura = baseH;
  saida.solido = corpo.solido;
  return true;
}

function avaliarVulcao(corpo, x, y, baseH, saida) {
  const d = Math.hypot(x - corpo.cx, y - corpo.cy);
  if (d > corpo.raio) return false;
  if (d <= corpo.cratera) {
    const cava = cavaRasa(2, 1);
    saida.fluido = corpo.fluido;
    saida.cava = cava;
    saida.superficie = baseH;
    saida.sobe = 0;
    saida.altura = baseH;
    saida.solido = corpo.solido;
    return true;
  }
  const t = (d - corpo.cratera) / (corpo.raio - corpo.cratera);
  const h = Math.round(corpo.pico + (corpo.base - corpo.pico) * t);
  saida.fluido = FLUIDO.NENHUM;
  saida.cava = 0;
  saida.superficie = h;
  saida.sobe = 1;
  saida.altura = h;
  saida.solido = BLOCO.PEDRA;
  return true;
}

/**
 * Preenche `saida` com cava/superficie/fluido. `baseH` é a altura sem água.
 */
export function amostraCorpo(x, y, baseH, saida) {
  // Compat: chamada antiga amostraCorpo(x, y, saida)
  if (saida == null && baseH && typeof baseH === "object") {
    saida = baseH;
    baseH = consultaAltura ? consultaAltura(x, y) : 16;
  }
  garantir();
  saida.tem = 0;
  saida.fluido = 0;
  saida.cava = 0;
  saida.sobe = 0;
  saida.superficie = 0;
  saida.altura = 0;
  saida.queda = 0;
  if (x < 0 || y < 0 || x >= EXTENSAO || y >= EXTENSAO) return saida;
  if (reservado(x, y)) return saida;
  const cx = (x / CELULA) | 0;
  const cy = (y / CELULA) | 0;
  const id = indice[cy * LADO + cx];
  if (id < 0) return saida;
  const lista = listas[id];
  const h0 = Number.isFinite(baseH) ? baseH : 16;
  let melhor = null;
  let prio = -1;
  for (let i = 0; i < lista.length; i++) {
    const corpo = lista[i];
    if (corpo.prioridade <= prio) continue;
    if (!avaliar(corpo, x, y, h0, saida)) continue;
    melhor = corpo;
    prio = corpo.prioridade;
    saida.tem = 1;
  }
  if (!melhor) {
    saida.tem = 0;
    saida.fluido = 0;
    saida.cava = 0;
    saida.sobe = 0;
  }
  return saida;
}

export function celulaCorpos() {
  return CELULA;
}
