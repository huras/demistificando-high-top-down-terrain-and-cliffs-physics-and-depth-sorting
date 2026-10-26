/**
 * Laboratório de Pallet. Planta de quatro salas do Pokémon AI (54×36):
 * cápsulas, mesas de inicial, computadores e a saída com estantes.
 * O mundo fica longe da sala da casa. O voxel e o 3D leem a mesma lista.
 */
import { CHUNK_XZ, CHUNK_Y } from "../../config.js";
import { ALTURA_PRACA } from "../regiao/amostraKanto.js";
import { definirLocal, preencherColunaSolida } from "../voxel/chunk.js";
import { BLOCO } from "../voxel/tiposBloco.js";

export const COLS_LAB = 54;
export const ROWS_LAB = 36;
export const ORIGEM_LAB_X = 100512;
export const ORIGEM_LAB_Y = 100000;
export const ALTURA_PAREDE_LAB = 4;

const MARGEM = 12;
const CORREDOR = 3;
const PX = 16;

const SPRITE = Object.freeze({
  tank: Object.freeze({ id: "tank", w: 42 / PX, h: 73 / PX, pe: true }),
  tankBolas: Object.freeze({ id: "tankBolas", w: 42 / PX, h: 73 / PX, pe: true }),
  pc: Object.freeze({ id: "pc", w: 34 / PX, h: 47 / PX, pe: true }),
  pcGrafico: Object.freeze({ id: "pcGrafico", w: 34 / PX, h: 47 / PX, pe: true }),
  mesa: Object.freeze({ id: "mesa", w: 49 / PX, h: 23 / PX, pe: true }),
  estante: Object.freeze({ id: "estante", w: 2, h: 2, pe: true }),
  escrivaninha: Object.freeze({ id: "escrivaninha", w: 2, h: 2, pe: true }),
  tapete: Object.freeze({ id: "tapete", w: 2, h: 1, chao: true }),
  livros: Object.freeze({ id: "livros", w: 1, h: 1, chao: true }),
  cura: Object.freeze({ id: "cura", w: 2, h: 3, pe: true }),
  vasoA: Object.freeze({ id: "vasoA", w: 1.5, h: 3, pe: true }),
  vasoB: Object.freeze({ id: "vasoB", w: 1.5, h: 3, pe: true }),
  vasoC: Object.freeze({ id: "vasoC", w: 1.5, h: 3.5, pe: true }),
});

export const INICIAIS_LAB = Object.freeze([
  "bulbasaur",
  "charmander",
  "squirtle",
  "chikorita",
  "cyndaquil",
  "totodile",
  "treecko",
  "torchic",
  "mudkip",
  "turtwig",
  "chimchar",
  "piplup",
]);

const NPCS = Object.freeze([
  Object.freeze({
    id: "oak",
    peopleId: "pt-prof-oak",
    nome: "Professor Carvalho",
    papel: "professor",
    sexo: "male",
    origem: "platinum",
    coluna: 93,
    retrato: "/assets/people/retratos/dp-prof-oak/frontal-shot.png",
    alcance: 1.55,
    fala: Object.freeze([
      "Bem-vindo ao laboratório.",
      "As cápsulas com Pokébola entregam qualquer Pokémon para o seu time.",
      "A máquina rosa é a do Centro Pokémon. Ela cura todo mundo.",
    ]),
  }),
  Object.freeze({
    id: "elena",
    peopleId: "pt-scientist",
    nome: "Elena",
    sexo: "female",
    origem: "platinum",
    coluna: 43,
    retrato: "/assets/people/retratos/prof-aide-elena/frontal-shot.png",
    alcance: 1.2,
    fala: Object.freeze([
      "Estou passando a limpo as anotações de campo.",
      "O professor vive entre as cápsulas e os computadores da sala ao lado.",
    ]),
  }),
  Object.freeze({
    id: "maya",
    peopleId: "pt-scientist",
    nome: "Maya",
    sexo: "female",
    origem: "platinum",
    coluna: 43,
    retrato: "/assets/people/retratos/prof-aide-maya/frontal-shot.png",
    alcance: 1.2,
    presente: "lab-bolas-maya",
    fala: Object.freeze([
      "Voltei da rota com umas Pokébolas sobrando.",
      "Pode ficar com estas dez.",
    ]),
    falaFeita: Object.freeze([
      "As rotas ao norte ainda têm muita coisa pra registrar.",
      "Se o time lotar, a cápsula avisa. Aí é só guardar alguém.",
    ]),
  }),
  Object.freeze({
    id: "rina",
    peopleId: "pt-scientist",
    nome: "Rina",
    sexo: "female",
    origem: "platinum",
    coluna: 43,
    retrato: "/assets/people/retratos/prof-aide-rina/frontal-shot.png",
    alcance: 1.2,
    fala: Object.freeze([
      "Esses computadores cruzam os dados de captura.",
      "A cápsula com Pokébola deixa você escolher a espécie e o nível.",
    ]),
  }),
]);

function noRetangulo(cx, cy, r) {
  return cx >= r.x0 && cx < r.x1 && cy >= r.y0 && cy < r.y1;
}

function centro(sala) {
  return { x: (sala.x0 + sala.x1) / 2, y: (sala.y0 + sala.y1) / 2 };
}

function carimbar(lista, sprite, esquerda, topo, extra) {
  const item = {
    id: sprite.id,
    x: esquerda + sprite.w * 0.5,
    y: topo + sprite.h * 0.5,
    halfW: sprite.w * 0.5,
    halfH: sprite.h * 0.5,
    footY: topo + sprite.h,
    pe: !!sprite.pe,
    chao: !!sprite.chao,
  };
  if (extra) Object.assign(item, extra);
  lista.push(item);
  return item;
}

function emPe(lista, sprite, x, footY, extra) {
  return carimbar(lista, sprite, x - sprite.w * 0.5, footY - sprite.h, extra);
}

/** yaw: 0 = frente sul; π/2 = frente leste (encostada na parede oeste). */
function escrivaninhaComLivros(lista, esquerda, topo, yaw = 0) {
  const mesa = carimbar(lista, SPRITE.escrivaninha, esquerda, topo, { yaw });
  carimbar(lista, SPRITE.livros, mesa.x - 0.35, mesa.y - mesa.halfH + 0.12, {
    chao: true,
    pe: false,
    passa: true,
  });
  return mesa;
}

function salas(cols, rows) {
  const w = 1;
  const roomW = Math.floor((cols - 2 * CORREDOR) / 3);
  const topH = Math.min(Math.max(16, Math.round(roomW * 1.1)), Math.max(16, rows - CORREDOR - 10));
  const aX0 = 0;
  const aX1 = roomW;
  const abX0 = aX1;
  const abX1 = aX1 + CORREDOR;
  const bX0 = abX1;
  const bX1 = bX0 + roomW;
  const bcX0 = bX1;
  const bcX1 = bX1 + CORREDOR;
  const cX0 = bcX1;
  const cX1 = cols;
  const topY1 = topH;
  const bdY0 = topY1;
  const bdY1 = bdY0 + CORREDOR;
  const dY0 = bdY1;
  const dY1 = rows;
  const dX0 = Math.floor((cols * 2) / 7);
  const dX1 = Math.ceil((cols * 5) / 7);
  const dCx = (dX0 + dX1) / 2;
  const hCorrY0 = w + Math.max(0, Math.floor((topY1 - w - CORREDOR) * 0.5));
  const hCorrY1 = hCorrY0 + CORREDOR;
  const bCx = Math.floor((bX0 + bX1) / 2);
  let bdX0 = bCx - Math.floor(CORREDOR / 2);
  let bdX1 = bdX0 + CORREDOR;
  const bdMin = Math.max(bX0, dX0);
  const bdMax = Math.min(bX1, dX1);
  if (bdX0 < bdMin) {
    bdX0 = bdMin;
    bdX1 = bdX0 + CORREDOR;
  }
  if (bdX1 > bdMax) {
    bdX1 = bdMax;
    bdX0 = bdX1 - CORREDOR;
  }
  const pisos = [
    { x0: aX0, y0: w, x1: aX1, y1: topY1 },
    { x0: bX0, y0: w, x1: bX1, y1: topY1 },
    { x0: cX0, y0: w, x1: cX1, y1: topY1 },
    { x0: abX0, y0: hCorrY0, x1: abX1, y1: hCorrY1 },
    { x0: bcX0, y0: hCorrY0, x1: bcX1, y1: hCorrY1 },
    { x0: bdX0, y0: bdY0, x1: bdX1, y1: bdY1 },
    { x0: bdX0, y0: dY0, x1: bdX1, y1: dY0 + w },
    { x0: dX0, y0: dY0 + w, x1: dX1, y1: dY1 },
  ];
  const chaoEm = (row, col) => {
    const cy = row + 0.5;
    const cx = col + 0.5;
    for (let i = 0; i < pisos.length; i++) {
      if (noRetangulo(cx, cy, pisos[i])) return true;
    }
    return false;
  };
  const doorW = CORREDOR;
  const doorX0 = Math.max(dX0, Math.floor(dCx - doorW / 2));
  const doorX1 = Math.min(dX1, doorX0 + doorW);
  return {
    pisos,
    chaoEm,
    doorX0,
    doorX1,
    dCx,
    salas: {
      a: { x0: aX0, y0: w, x1: aX1, y1: topY1 },
      b: { x0: bX0, y0: w, x1: bX1, y1: topY1 },
      c: { x0: cX0, y0: w, x1: cX1, y1: topY1 },
      d: { x0: dX0, y0: dY0 + w, x1: dX1, y1: dY1 },
    },
  };
}

function fundir(marca, cols, rows) {
  const visto = new Uint8Array(marca.length);
  const saida = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (!marca[i] || visto[i]) continue;
      let w = 1;
      while (x + w < cols && marca[i + w] && !visto[i + w]) w += 1;
      let h = 1;
      while (y + h < rows) {
        let ok = true;
        for (let dx = 0; dx < w; dx++) {
          const j = (y + h) * cols + x + dx;
          if (!marca[j] || visto[j]) ok = false;
        }
        if (!ok) break;
        h += 1;
      }
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) visto[(y + dy) * cols + x + dx] = 1;
      }
      saida.push({ x, y, w, h });
    }
  }
  return saida;
}

function montar() {
  const cols = COLS_LAB;
  const rows = ROWS_LAB;
  const layout = salas(cols, rows);
  const { a, b, c, d } = layout.salas;
  const aMeio = centro(a);
  const bMeio = centro(b);
  const cMeio = centro(c);
  const dMeio = centro(d);
  const moveis = [];
  const capsulas = [];

  const chavesTank = ["tank", "tankBolas", "tank", "tankBolas", "tank", "tankBolas"];
  const tank = SPRITE.tank;
  const gapX = 0.4;
  const gapY = 0.7;
  const gradeW = 3 * tank.w + 2 * gapX;
  const origemX = a.x0 + Math.max(0.5, (a.x1 - a.x0 - gradeW) * 0.5);
  const pesTank = [a.y0 + tank.h + 0.3, a.y0 + 2 * tank.h + gapY + 0.45];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const chave = chavesTank[row * 3 + col];
      const x = origemX + tank.w / 2 + col * (tank.w + gapX);
      const item = emPe(moveis, SPRITE[chave], x, pesTank[row]);
      if (chave === "tankBolas") {
        capsulas.push({ x: item.x, y: item.y, halfW: item.halfW, halfH: item.halfH });
      }
    }
  }
  carimbar(moveis, SPRITE.estante, a.x0 + 0.45, a.y0 + 0.35);
  escrivaninhaComLivros(moveis, a.x0 + 0.55, a.y1 - 2.45, Math.PI / 2);
  const cura = carimbar(moveis, SPRITE.cura, a.x1 - 2.65, a.y1 - 4.35, { acao: "cura" });

  escrivaninhaComLivros(moveis, bMeio.x - 1, b.y0 + 0.4, 0);
  const mesa = SPRITE.mesa;
  const corredor = 2.4;
  const xsMesa = [bMeio.x - corredor / 2 - mesa.w / 2, bMeio.x + corredor / 2 + mesa.w / 2];
  const pesMesa = [b.y0 + 7.2, b.y0 + 7.2 + mesa.h + 1.35];
  const mesas = [];
  for (let r = 0; r < pesMesa.length; r++) {
    for (let c = 0; c < xsMesa.length; c++) {
      mesas.push(emPe(moveis, mesa, xsMesa[c], pesMesa[r]));
    }
  }

  const pc = SPRITE.pc;
  const pcGapX = 0.5;
  const pcGapY = 0.75;
  const chavesPc = ["pc", "pcGrafico", "pc", "pcGrafico", "pc", "pcGrafico"];
  const pcGrade = 3 * pc.w + 2 * pcGapX;
  const pcOrigem = c.x0 + Math.max(0.5, (c.x1 - c.x0 - pcGrade) * 0.55);
  const pesPc = [c.y0 + pc.h + 0.35, c.y0 + 2 * pc.h + pcGapY + 0.45];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const x = pcOrigem + pc.w / 2 + col * (pc.w + pcGapX);
      emPe(moveis, SPRITE[chavesPc[row * 3 + col]], x, pesPc[row]);
    }
  }
  carimbar(moveis, SPRITE.estante, c.x1 - 0.45 - SPRITE.estante.w, c.y0 + 0.35);
  escrivaninhaComLivros(moveis, c.x0 + 0.55, cMeio.y + 0.25, Math.PI / 2);

  const est = SPRITE.estante;
  const topos = [d.y0 + 0.45, d.y0 + est.h + 1.1];
  for (let i = 0; i < topos.length; i++) {
    const topo = topos[i];
    carimbar(moveis, est, d.x0 + 0.35, topo);
    carimbar(moveis, est, d.x0 + 0.35 + est.w, topo);
    carimbar(moveis, est, d.x1 - 0.35 - 2 * est.w, topo);
    carimbar(moveis, est, d.x1 - 0.35 - est.w, topo);
  }
  const livrosChao = [
    [d.x0 + 1.1, dMeio.y - 0.2],
    [d.x0 + 2.2, dMeio.y + 1.1],
    [d.x1 - 2.4, dMeio.y - 0.15],
    [d.x1 - 1.35, dMeio.y + 1.05],
    [dMeio.x - 0.4, d.y0 + 2.4],
  ];
  for (let i = 0; i < livrosChao.length; i++) {
    carimbar(moveis, SPRITE.livros, livrosChao[i][0], livrosChao[i][1], { passa: true });
  }
  carimbar(moveis, SPRITE.tapete, dMeio.x - 1, rows - 1.2, { passa: true });

  const planta = SPRITE.vasoA;
  const vasos = [
    ["vasoA", a.x1 - planta.w - 0.25, a.y0 + 0.3],
    ["vasoB", (a.x0 + a.x1) / 2 - planta.w / 2, a.y1 - planta.h - 0.15],
    ["vasoC", b.x0 + 0.3, b.y1 - planta.h - 0.55],
    ["vasoA", b.x1 - planta.w - 0.3, b.y1 - planta.h - 0.55],
    ["vasoB", c.x1 - planta.w - 0.25, c.y1 - planta.h - 0.2],
    ["vasoC", c.x0 + 0.35, c.y1 - planta.h - 0.2],
    ["vasoA", d.x0 + 0.4, d.y1 - planta.h - 0.35],
    ["vasoB", d.x1 - planta.w - 0.4, d.y1 - planta.h - 0.35],
  ];
  for (let i = 0; i < vasos.length; i++) {
    carimbar(moveis, SPRITE[vasos[i][0]], vasos[i][1], vasos[i][2]);
  }

  const porMesa = Math.ceil(INICIAIS_LAB.length / Math.max(1, mesas.length));
  const bolas = [];
  for (let i = 0; i < INICIAIS_LAB.length; i++) {
    const mesaI = Math.min(mesas.length - 1, Math.floor(i / porMesa));
    const slot = i - mesaI * porMesa;
    const naMesa = Math.min(porMesa, INICIAIS_LAB.length - mesaI * porMesa);
    const base = mesas[mesaI];
    const span = base.halfW * 1.15;
    const t = naMesa <= 1 ? 0 : slot / (naMesa - 1);
    bolas.push({
      especie: INICIAIS_LAB[i],
      x: base.x - span / 2 + t * span,
      y: base.y - base.halfH + 0.36,
    });
  }

  const npcs = [
    { ...NPCS[0], x: bMeio.x, y: b.y0 + 2.55 },
    { ...NPCS[1], x: a.x0 + 3.15, y: a.y1 - 1.55 },
    { ...NPCS[2], x: dMeio.x - 1.1, y: dMeio.y - 0.35 },
    { ...NPCS[3], x: c.x0 + 3.1, y: cMeio.y + 1.35 },
  ];

  const anda = new Uint8Array(cols * rows);
  const muro = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let livre = layout.chaoEm(row, col);
      if (livre && row >= rows - 1 && (col < layout.doorX0 || col >= layout.doorX1)) livre = false;
      if (livre) anda[row * cols + col] = 1;
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (anda[row * cols + col]) continue;
      let vizinho = false;
      for (let dy = -1; dy <= 1 && !vizinho; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = col + dx;
          const ny = row + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          if (anda[ny * cols + nx]) vizinho = true;
        }
      }
      if (vizinho) muro[row * cols + col] = 1;
    }
  }

  const discos = [];
  for (let i = 0; i < moveis.length; i++) {
    const item = moveis[i];
    if (item.passa || item.chao) continue;
    if (item.id === "cura") {
      empurrarDiscosCura(discos, item);
      continue;
    }
    const r =
      item.id === "mesa" || item.id === "escrivaninha"
        ? Math.min(0.82, item.halfW * 0.7)
        : Math.min(0.52, Math.max(0.36, item.halfW * 0.42));
    discos.push({ x: ORIGEM_LAB_X + item.x, y: ORIGEM_LAB_Y + item.footY - 0.3, z: ALTURA_PRACA, r });
  }
  for (let i = 0; i < npcs.length; i++) {
    const npc = npcs[i];
    discos.push({ x: ORIGEM_LAB_X + npc.x, y: ORIGEM_LAB_Y + npc.y, z: ALTURA_PRACA, r: 0.36 });
  }

  return {
    cols,
    rows,
    anda,
    muro,
    pisos: fundir(anda, cols, rows),
    muros: fundir(muro, cols, rows),
    vedacoes: [
      { x: -1, y: 0, w: 1, h: rows },
      { x: cols, y: 0, w: 1, h: rows },
    ],
    doorX0: layout.doorX0,
    doorX1: layout.doorX1,
    salas: layout.salas,
    moveis,
    capsulas,
    cura,
    bolas,
    npcs,
    discos,
    spawn: { x: ORIGEM_LAB_X + dMeio.x, y: ORIGEM_LAB_Y + rows - 1.45, z: ALTURA_PRACA },
  };
}

const PLANTA = montar();

export function plantaLaboratorio() {
  return PLANTA;
}

export function dentroDoTerrenoLaboratorio(wx, wy) {
  return (
    wx >= ORIGEM_LAB_X - MARGEM &&
    wx < ORIGEM_LAB_X + COLS_LAB + MARGEM &&
    wy >= ORIGEM_LAB_Y - MARGEM &&
    wy < ORIGEM_LAB_Y + ROWS_LAB + MARGEM
  );
}

function colunaVedada(col, row) {
  const lista = PLANTA.vedacoes;
  for (let i = 0; i < lista.length; i++) {
    const faixa = lista[i];
    if (col >= faixa.x && col < faixa.x + faixa.w && row >= faixa.y && row < faixa.y + faixa.h) return true;
  }
  return false;
}

export function aplicarLaboratorioNoChunk(chunk) {
  const baseX = chunk.cx * CHUNK_XZ;
  const baseY = chunk.cy * CHUNK_XZ;
  const zParede = Math.min(CHUNK_Y, ALTURA_PRACA + ALTURA_PAREDE_LAB);
  let mudou = false;
  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const wx = baseX + lx;
      const wy = baseY + ly;
      if (!dentroDoTerrenoLaboratorio(wx, wy)) continue;
      preencherColunaSolida(chunk, lx, ly, ALTURA_PRACA, BLOCO.TERRA);
      const col = wx - ORIGEM_LAB_X;
      const row = wy - ORIGEM_LAB_Y;
      const naPlanta =
        col >= 0 &&
        row >= 0 &&
        col < COLS_LAB &&
        row < ROWS_LAB &&
        PLANTA.muro[row * COLS_LAB + col] === 1;
      const solido = naPlanta || colunaVedada(col, row);
      if (solido) {
        for (let z = ALTURA_PRACA; z < zParede; z++) definirLocal(chunk, lx, ly, z, BLOCO.PEDRA);
      }
      mudou = true;
    }
  }
  return mudou;
}

export function spawnLaboratorio() {
  return PLANTA.spawn;
}

export function naSaidaLaboratorio(x, y) {
  const localX = x - ORIGEM_LAB_X;
  const localY = y - ORIGEM_LAB_Y;
  if (localY < ROWS_LAB - 1.15) return false;
  return localX >= PLANTA.doorX0 - 0.2 && localX < PLANTA.doorX1 + 0.2;
}

/** Fileira de cima da máquina passa; as duas de baixo fecham o corpo, como no Pokémon AI. */
function empurrarDiscosCura(discos, item) {
  const cols = 2;
  const rows = 3;
  const solidas = [
    [0, 1],
    [1, 1],
    [0, 2],
    [1, 2],
  ];
  const esquerda = item.x - item.halfW;
  const topo = item.y - item.halfH;
  const cw = (item.halfW * 2) / cols;
  const ch = (item.halfH * 2) / rows;
  const raio = Math.min(cw, ch) * 0.48;
  for (let i = 0; i < solidas.length; i++) {
    const c = solidas[i][0];
    const r = solidas[i][1];
    discos.push({
      x: ORIGEM_LAB_X + esquerda + (c + 0.5) * cw,
      y: ORIGEM_LAB_Y + topo + (r + 0.5) * ch,
      z: ALTURA_PRACA,
      r: raio,
    });
  }
}

function pertoCaixa(px, py, item, alcance) {
  const dx = Math.max(Math.abs(px - item.x) - item.halfW, 0);
  const dy = Math.max(Math.abs(py - item.y) - item.halfH, 0);
  return Math.hypot(dx, dy) <= alcance;
}

/** O que o R faz em frente do jogador. Saída fica no movimento. */
export function alvoDoLaboratorio(x, y) {
  const px = x - ORIGEM_LAB_X;
  const py = y - ORIGEM_LAB_Y;
  const cura = PLANTA.cura;
  const naFrente = Math.hypot(px - cura.x, py - cura.footY) <= 1.85;
  if (pertoCaixa(px, py, cura, 1.6) || naFrente) return { tipo: "cura", ref: cura };
  const oak = PLANTA.npcs[0];
  if (Math.hypot(px - oak.x, py - oak.y) <= oak.alcance) return { tipo: "npc", ref: oak };
  let capsula = null;
  let distCapsula = Infinity;
  for (let i = 0; i < PLANTA.capsulas.length; i++) {
    const tank = PLANTA.capsulas[i];
    if (!pertoCaixa(px, py, tank, 1.35)) continue;
    const dx = Math.max(Math.abs(px - tank.x) - tank.halfW, 0);
    const dy = Math.max(Math.abs(py - tank.y) - tank.halfH, 0);
    const dist = Math.hypot(dx, dy);
    if (dist < distCapsula) {
      distCapsula = dist;
      capsula = tank;
    }
  }
  if (capsula) return { tipo: "capsula", ref: capsula };
  for (let i = 1; i < PLANTA.npcs.length; i++) {
    const npc = PLANTA.npcs[i];
    if (Math.hypot(px - npc.x, py - npc.y) <= npc.alcance) return { tipo: "npc", ref: npc };
  }
  let bola = null;
  let distBola = 1.45;
  for (let i = 0; i < PLANTA.bolas.length; i++) {
    const item = PLANTA.bolas[i];
    const dist = Math.hypot(px - item.x, py - item.y);
    if (dist <= distBola) {
      distBola = dist;
      bola = item;
    }
  }
  if (bola) return { tipo: "inicial", ref: bola };
  return null;
}

export function promptDoLaboratorio(alvo) {
  if (!alvo) return "";
  if (alvo.tipo === "cura") return "Recuperar";
  if (alvo.tipo === "capsula") return "";
  if (alvo.tipo === "inicial") return `Pokébola de ${alvo.ref.especie} — R`;
  if (alvo.tipo === "npc") return `${alvo.ref.nome} — R`;
  return "";
}
