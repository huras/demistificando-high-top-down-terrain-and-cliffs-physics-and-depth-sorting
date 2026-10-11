import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CHUNK_XZ, CHUNK_Y, definirTroncoInset, TRONCO_INSET } from "../config.js";
import { criarChunk, definirLocal, obterLocal, preencherColunaSolida } from "../mundo/voxel/chunk.js";
import { instalarChunk } from "../mundo/voxel/storeMundo.js";
import { BLOCO, ehSolido } from "../mundo/voxel/tiposBloco.js";
import { malharChunk } from "../render/3d/terrenoMalha.js";

const N = 7;
const ORIGEM = 4;
const TOL_SOLDA = 0.006;
const Y_CHAO = 0.02;

const PRESETS = [
  {
    id: "exemplo-a",
    nome: "Voxel a",
    nota: "O seu exemplo. Linha 1 é a primeira linha do diagrama. a é o bloco da camada 1 em C2 (amarelo). Camada 2 só existe em A–B, linhas 2 a 4.",
    linhas: ["2222000", "3322000", "3311000", "3311000", "1111000", "0000000", "0000000"],
    foco: { c: 2, r: 1, z: 1, nome: "a" },
  },
  {
    id: "plano",
    nome: "Plano",
    nota: "Tudo na mesma altura. Serve de controle: não deve pintar fresta.",
    linhas: ["2222222", "2222222", "2222222", "2222222", "2222222", "2222222", "2222222"],
  },
  {
    id: "cliff",
    nome: "Cliff reto",
    nota: "Uma face sul. Chanfro só nesse lado.",
    linhas: ["4444444", "4444444", "4444444", "4444444", "1111111", "1111111", "1111111"],
  },
  {
    id: "convexo",
    nome: "Canto convexo",
    nota: "Quina sudeste do platô. Dois lados abertos no mesmo bloco.",
    linhas: ["4444111", "4444111", "4444111", "4444111", "1111111", "1111111", "1111111"],
  },
  {
    id: "poco",
    nome: "Poço 1×1",
    nota: "Buraco interno. Os quatro cantos em diagonal pedem mitra; a borda do poço pede chanfro.",
    linhas: ["4444444", "4444444", "4444444", "4440444", "4444444", "4444444", "4444444"],
  },
  {
    id: "quina",
    nome: "L na quina",
    nota: "O bloco do canto interno também é borda de cliff. O mesher escolhe chanfro e pula a mitra.",
    linhas: ["0000000", "0000000", "0444000", "0440000", "0000000", "0000000", "0000000"],
  },
  {
    id: "degrau",
    nome: "Degraus",
    nota: "Cada linha é um degrau. A quina de cada degrau muda o chanfro.",
    linhas: ["1111111", "1222222", "1333333", "1444444", "1555555", "1666666", "1111111"],
  },
  {
    id: "pilar",
    nome: "Pilar",
    nota: "Um bloco alto no meio de um chão baixo. Quatro lados abertos.",
    linhas: ["1111111", "1111111", "1111111", "1115111", "1111111", "1111111", "1111111"],
  },
  {
    id: "cruz",
    nome: "Cruz",
    nota: "Encontro em T/cruz. Vários vizinhos na mesma altura e outros no chão.",
    linhas: ["1111111", "1141111", "1141111", "4444444", "1141111", "1141111", "1111111"],
  },
  {
    id: "patio",
    nome: "Pátio",
    nota: "Anel com pátio vazio. Cantos internos e externos ao mesmo tempo.",
    linhas: ["1111111", "1444441", "1400041", "1400041", "1400041", "1444441", "1111111"],
  },
  {
    id: "niveis",
    nome: "Dois níveis",
    nota: "Platô alto encostado num médio e num baixo. A quina mistura alturas.",
    linhas: ["6666333", "6666333", "6666333", "3333333", "3333111", "1111111", "1111111"],
  },
  {
    id: "deck",
    nome: "Deck com ar",
    nota: "Laje com ar por baixo. O caminho por voxel (não a coluna simples) é o que gera a face de baixo.",
    linhas: ["1111111", "1111111", "1144111", "1144111", "1111111", "1111111", "1111111"],
    furos(alturas) {
      const lista = [];
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (alturas[r][c] < 4) continue;
          lista.push({ c, r, z: 1 }, { c, r, z: 2 });
        }
      }
      return lista;
    },
  },
];

const $ = (id) => document.getElementById(id);

const statusEl = $("status");
const notaEl = $("nota-preset");
const presetsEl = $("presets");
const gradeEl = $("grade");
const alturasEl = $("alturas");
const frestasEl = $("frestas");
const painelEl = $("painel-ponto");
const rotulosEl = $("rotulos");
const guias = $("guias");
const guiasCtx = guias.getContext("2d");
const avisoEl = $("aviso");
const palco = $("palco");
const canvas = $("vista");

const estado = {
  presetId: "exemplo-a",
  alturas: [],
  furos: [],
  foco: null,
  tinta: 4,
  pintando: false,
  apagando: false,
  sujo: false,
  modoNomes: "frestas",
  gaiola: true,
  wire: false,
  celulas: true,
  beiral: false,
};

let pontos = [];
let celulas = [];
let marcas = [];
let grupos = [];
let selecionado = null;
let frestaAtiva = null;
let hover = null;
let sobreposicoes = 0;
let tris = 0;
let avisoTimer = 0;

const pool = [];
const ocupacao = new Set();
const tmp = new THREE.Vector3();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0x121814, 1);

const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);
const controles = new OrbitControls(camera, canvas);
controles.enableDamping = true;
controles.dampingFactor = 0.08;
controles.mouseButtons.RIGHT = THREE.MOUSE.PAN;
controles.target.set(ORIGEM + N * 0.5, 2.2, ORIGEM + N * 0.5);
camera.position.set(ORIGEM + N * 0.5 + 7.5, 8.5, ORIGEM + N * 0.5 + 9.5);
controles.update();

cena.add(new THREE.HemisphereLight(0xd7efe0, 0x2a211c, 1.15));
const sol = new THREE.DirectionalLight(0xfff4e0, 1.35);
sol.position.set(6, 14, 4);
cena.add(sol);

const chao = new THREE.GridHelper(N + 2, N + 2, 0x3d5248, 0x243028);
chao.position.set(ORIGEM + N * 0.5, -0.012, ORIGEM + N * 0.5);
cena.add(chao);
cena.add(spriteTexto("N", ORIGEM + N * 0.5, 0.15, ORIGEM - 0.85));
cena.add(spriteTexto("S", ORIGEM + N * 0.5, 0.15, ORIGEM + N + 0.35));
cena.add(spriteTexto("L", ORIGEM + N + 0.45, 0.15, ORIGEM + N * 0.5));
cena.add(spriteTexto("O", ORIGEM - 0.95, 0.15, ORIGEM + N * 0.5));

const raiz = new THREE.Group();
cena.add(raiz);

const matTopo = new THREE.MeshStandardMaterial({
  color: 0x7dce6a,
  roughness: 0.72,
  metalness: 0.02,
  side: THREE.DoubleSide,
  flatShading: true,
});
const matParede = new THREE.MeshStandardMaterial({
  color: 0x8d6b52,
  roughness: 0.86,
  metalness: 0.02,
  side: THREE.DoubleSide,
  flatShading: true,
});
const matBeiral = new THREE.MeshStandardMaterial({
  color: 0xc4a060,
  roughness: 0.8,
  metalness: 0.04,
  side: THREE.DoubleSide,
  flatShading: true,
});
const matWire = new THREE.MeshBasicMaterial({
  color: 0x102018,
  wireframe: true,
  transparent: true,
  opacity: 0.45,
});
const matGaiola = new THREE.LineBasicMaterial({ color: 0x9bb0a4, transparent: true, opacity: 0.28 });
const matFresta = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  depthTest: false,
  toneMapped: false,
});
const matPonto = new THREE.PointsMaterial({
  color: 0xd5e6da,
  size: 0.055,
  sizeAttenuation: true,
});
const matPontoFresta = new THREE.PointsMaterial({
  color: 0xffb15a,
  size: 0.11,
  sizeAttenuation: true,
  depthTest: false,
});
const matMarcaLinha = new THREE.LineBasicMaterial({ color: 0xffe08a, depthTest: false });
const matMarcaMiolo = new THREE.MeshBasicMaterial({
  color: 0xffe08a,
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
  side: THREE.DoubleSide,
});

const nuvemNormais = new THREE.Points(new THREE.BufferGeometry(), matPonto);
const nuvemFrestas = new THREE.Points(new THREE.BufferGeometry(), matPontoFresta);
nuvemFrestas.renderOrder = 5;
cena.add(nuvemNormais, nuvemFrestas);

const raycaster = new THREE.Raycaster();
const ponteiro = new THREE.Vector2();
let ponteiroX = 0;
let ponteiroY = 0;
let ponteiroDentro = false;
let arrasto = 0;

function spriteTexto(texto, x, y, z) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d");
  g.clearRect(0, 0, 128, 64);
  g.fillStyle = "#9bb8a6";
  g.font = "700 40px Segoe UI";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(texto, 64, 34);
  const mat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c),
    transparent: true,
    depthTest: false,
  });
  const s = new THREE.Sprite(mat);
  s.position.set(x, y, z);
  s.scale.set(0.7, 0.35, 1);
  s.renderOrder = 4;
  return s;
}

function matrizDe(linhas) {
  return linhas.map((s) => [...s].map((ch) => (ch === "." ? 0 : Number(ch))));
}

function aplicarPreset(preset, manterCamera) {
  estado.presetId = preset.id;
  estado.foco = preset.foco || null;
  estado.alturas = matrizDe(preset.linhas);
  estado.furos = preset.furos ? preset.furos(estado.alturas) : [];
  notaEl.textContent = preset.nota;
  for (const botao of presetsEl.querySelectorAll("button")) {
    botao.setAttribute("aria-pressed", botao.dataset.id === preset.id ? "true" : "false");
  }
  desenharGrade();
  reconstruir(manterCamera);
}

function marcarPersonalizado() {
  estado.presetId = "personalizado";
  estado.foco = null;
  notaEl.textContent = "Grade editada à mão. Shift+clique fura os blocos do meio da coluna.";
  for (const botao of presetsEl.querySelectorAll("button")) {
    botao.setAttribute("aria-pressed", "false");
  }
}

function desenharPresets() {
  presetsEl.replaceChildren();
  for (const preset of PRESETS) {
    const item = document.createElement("li");
    const botao = document.createElement("button");
    botao.type = "button";
    botao.dataset.id = preset.id;
    botao.textContent = preset.nome;
    botao.addEventListener("click", () => aplicarPreset(preset, !preset.foco));
    item.appendChild(botao);
    presetsEl.appendChild(item);
  }
}

function desenharAlturas() {
  alturasEl.replaceChildren();
  for (let h = 0; h <= 8; h++) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = String(h);
    botao.setAttribute("aria-pressed", h === estado.tinta ? "true" : "false");
    botao.addEventListener("click", () => {
      estado.tinta = h;
      desenharAlturas();
    });
    alturasEl.appendChild(botao);
  }
}

function temFuro(c, r) {
  return estado.furos.some((f) => f.c === c && f.r === r);
}

function desenharGrade() {
  gradeEl.replaceChildren();
  const canto = document.createElement("span");
  canto.className = "eixo";
  gradeEl.appendChild(canto);
  for (let c = 0; c < N; c++) {
    const eixo = document.createElement("span");
    eixo.className = "eixo";
    eixo.textContent = String.fromCharCode(65 + c);
    gradeEl.appendChild(eixo);
  }
  for (let r = 0; r < N; r++) {
    const eixo = document.createElement("span");
    eixo.className = "eixo";
    eixo.textContent = String(r + 1);
    gradeEl.appendChild(eixo);
    for (let c = 0; c < N; c++) {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.dataset.c = String(c);
      botao.dataset.r = String(r);
      const h = estado.alturas[r][c];
      const marca = marcaDa(c, r);
      botao.textContent = marca || String(h);
      botao.style.background = `rgb(${18 + h * 8}, ${36 + h * 14}, ${28 + h * 6})`;
      botao.style.color = h >= 4 ? "#102015" : "#e7f2ea";
      if (marca) botao.dataset.marca = "1";
      if (temFuro(c, r)) botao.dataset.furo = "1";
      botao.addEventListener("pointerdown", (ev) => {
        estado.pintando = true;
        estado.apagando = ev.button === 2;
        botao.setPointerCapture(ev.pointerId);
        pintarCelula(c, r, ev.shiftKey);
      });
      botao.addEventListener("pointerenter", (ev) => {
        if (!estado.pintando || !(ev.buttons & 3)) return;
        pintarCelula(c, r, ev.shiftKey);
      });
      botao.addEventListener("contextmenu", (ev) => ev.preventDefault());
      gradeEl.appendChild(botao);
    }
  }
}

function atualizarBotao(c, r) {
  const botao = gradeEl.querySelector(`button[data-c="${c}"][data-r="${r}"]`);
  if (!botao) return;
  const h = estado.alturas[r][c];
  const marca = marcaDa(c, r);
  botao.textContent = marca || String(h);
  botao.style.background = `rgb(${18 + h * 8}, ${36 + h * 14}, ${28 + h * 6})`;
  botao.style.color = h >= 4 ? "#102015" : "#e7f2ea";
  if (marca) botao.dataset.marca = "1";
  else delete botao.dataset.marca;
  if (temFuro(c, r)) botao.dataset.furo = "1";
  else delete botao.dataset.furo;
}

function marcaDa(c, r) {
  const foco = estado.foco;
  if (!foco || foco.c !== c || foco.r !== r) return null;
  return foco.nome;
}

function pintarCelula(c, r, furar) {
  if (furar) {
    const h = estado.alturas[r][c];
    if (h < 3) return;
    const jaFurado = estado.furos.some((f) => f.c === c && f.r === r);
    estado.furos = estado.furos.filter((f) => f.c !== c || f.r !== r);
    if (!jaFurado) {
      for (let z = 1; z < h - 1; z++) estado.furos.push({ c, r, z });
    }
  } else if (estado.apagando) {
    estado.alturas[r][c] = 0;
    estado.furos = estado.furos.filter((f) => f.c !== c || f.r !== r);
  } else {
    estado.alturas[r][c] = estado.tinta;
    estado.furos = estado.furos.filter((f) => f.c !== c || f.r !== r || (f.z > 0 && f.z < estado.tinta - 1));
  }
  estado.sujo = true;
  marcarPersonalizado();
  atualizarBotao(c, r);
}

function soltarPintura() {
  if (!estado.pintando) return;
  estado.pintando = false;
  if (!estado.sujo) return;
  estado.sujo = false;
  reconstruir(true);
}

function marcaEixo(t) {
  const e = 0.02;
  const inset = TRONCO_INSET;
  if (t <= e) return "0";
  if (Math.abs(t - 1) <= e) return "1";
  if (inset > 0.001 && Math.abs(t - inset) <= e) return "i0";
  if (inset > 0.001 && Math.abs(t - (1 - inset)) <= e) return "i1";
  const n = Math.round(t * 100) / 100;
  return String(n);
}

function snapY(y) {
  const r = Math.round(y);
  if (Math.abs(y - r) <= 0.008) return r;
  return Math.round(y * 100) / 100;
}

function formatarNome(col, row, fx, fz, y) {
  const letra = col >= 0 && col < 26 ? String.fromCharCode(65 + col) : `c${col}`;
  const linha = row + 1;
  const ys = Number.isInteger(y) ? String(y) : String(y);
  return `${letra}${linha}.x${marcaEixo(fx)}.z${marcaEixo(fz)}.y${ys}`;
}

function nomeDoPonto(x, z, y) {
  const ys = snapY(y);
  const eps = 0.001;
  const cx0 = Math.floor(x + eps);
  const cz0 = Math.floor(z + eps);
  const donos = [];
  for (let cx = cx0 - 1; cx <= cx0; cx++) {
    for (let cz = cz0 - 1; cz <= cz0; cz++) {
      const fx = x - cx;
      const fz = z - cz;
      if (fx < -eps || fz < -eps || fx > 1 + eps || fz > 1 + eps) continue;
      donos.push({
        col: cx - ORIGEM,
        row: cz - ORIGEM,
        fx: Math.min(1, Math.max(0, fx)),
        fz: Math.min(1, Math.max(0, fz)),
      });
    }
  }
  if (!donos.length) {
    donos.push({ col: cx0 - ORIGEM, row: cz0 - ORIGEM, fx: x - cx0, fz: z - cz0 });
  }
  const dentro = (d) => d.col >= 0 && d.col < N && d.row >= 0 && d.row < N;
  donos.sort((a, b) => {
    const pa = dentro(a) ? 0 : 1;
    const pb = dentro(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return a.col - b.col || a.row - b.row;
  });
  const nomes = donos.map((d) => formatarNome(d.col, d.row, d.fx, d.fz, ys));
  const unicos = [];
  for (const nome of nomes) if (!unicos.includes(nome)) unicos.push(nome);
  return { nome: unicos[0], aliases: unicos.slice(1), y: ys };
}

function soldar(grade, verts, x, y, z) {
  const qx = Math.round(x / TOL_SOLDA);
  const qy = Math.round(y / TOL_SOLDA);
  const qz = Math.round(z / TOL_SOLDA);
  const tol2 = TOL_SOLDA * TOL_SOLDA;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const lista = grade.get(`${qx + dx},${qy + dy},${qz + dz}`);
        if (!lista) continue;
        for (let i = 0; i < lista.length; i++) {
          const id = lista[i];
          const p = verts[id];
          const ddx = p.x - x;
          const ddy = p.y - y;
          const ddz = p.z - z;
          if (ddx * ddx + ddy * ddy + ddz * ddz <= tol2) return id;
        }
      }
    }
  }
  const id = verts.length;
  verts.push({ x, y, z, uso: 0, frestas: [] });
  const k = `${qx},${qy},${qz}`;
  let lista = grade.get(k);
  if (!lista) {
    lista = [];
    grade.set(k, lista);
  }
  lista.push(id);
  return id;
}

function area2(a, b, c) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const acz = c.z - a.z;
  const cx = aby * acz - abz * acy;
  const cy = abz * acx - abx * acz;
  const cz = abx * acy - aby * acx;
  return cx * cx + cy * cy + cz * cz;
}

function analisar(geos) {
  const verts = [];
  const grade = new Map();
  const triIds = [];
  let nTris = 0;
  for (let g = 0; g < geos.length; g++) {
    const bruto = geos[g].geo;
    const geo = bruto.index ? bruto.toNonIndexed() : bruto;
    const pos = geo.attributes.position;
    if (!pos) {
      if (geo !== bruto) geo.dispose();
      continue;
    }
    const n = pos.count - (pos.count % 3);
    for (let i = 0; i < n; i += 3) {
      const a = soldar(grade, verts, pos.getX(i), pos.getY(i), pos.getZ(i));
      const b = soldar(grade, verts, pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
      const c = soldar(grade, verts, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
      if (a === b || b === c || a === c) continue;
      if (area2(verts[a], verts[b], verts[c]) < 1e-12) continue;
      triIds.push(a, b, c);
      verts[a].uso++;
      verts[b].uso++;
      verts[c].uso++;
      nTris++;
    }
    if (geo !== bruto) geo.dispose();
  }

  const arestas = new Map();
  for (let i = 0; i < triIds.length; i += 3) {
    const ids = [triIds[i], triIds[i + 1], triIds[i + 2]];
    for (let e = 0; e < 3; e++) {
      const a = ids[e];
      const b = ids[(e + 1) % 3];
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      const item = arestas.get(k);
      if (item) item.n++;
      else arestas.set(k, { a, b, n: 1 });
    }
  }

  const abertas = [];
  let extras = 0;
  for (const item of arestas.values()) {
    if (item.n > 2) extras++;
    if (item.n !== 1) continue;
    const pa = verts[item.a];
    const pb = verts[item.b];
    if (pa.y <= Y_CHAO && pb.y <= Y_CHAO) continue;
    abertas.push(item);
  }

  const adj = new Map();
  for (const item of abertas) {
    if (!adj.has(item.a)) adj.set(item.a, []);
    if (!adj.has(item.b)) adj.set(item.b, []);
    adj.get(item.a).push(item);
    adj.get(item.b).push(item);
  }
  const usadas = new Set();
  const crus = [];
  for (const inicial of abertas) {
    if (usadas.has(inicial)) continue;
    const grupo = [];
    const fila = [inicial];
    usadas.add(inicial);
    while (fila.length) {
      const item = fila.pop();
      grupo.push(item);
      const vizinhos = adj.get(item.a).concat(adj.get(item.b));
      for (let i = 0; i < vizinhos.length; i++) {
        if (usadas.has(vizinhos[i])) continue;
        usadas.add(vizinhos[i]);
        fila.push(vizinhos[i]);
      }
    }
    crus.push(grupo);
  }
  crus.sort((a, b) => b.length - a.length);

  const saida = crus.map((grupo, indice) => {
    const id = `F${indice + 1}`;
    const ids = [];
    for (let i = 0; i < grupo.length; i++) {
      const a = grupo[i].a;
      const b = grupo[i].b;
      if (!ids.includes(a)) ids.push(a);
      if (!ids.includes(b)) ids.push(b);
      verts[a].frestas.push(id);
      verts[b].frestas.push(id);
    }
    return { id, ids, arestas: grupo };
  });

  for (let i = 0; i < verts.length; i++) {
    const nome = nomeDoPonto(verts[i].x, verts[i].z, verts[i].y);
    verts[i].nome = nome.nome;
    verts[i].aliases = nome.aliases;
    verts[i].fresta = verts[i].frestas.length > 0;
  }

  return { verts, grupos: saida, tris: nTris, sobreposicoes: extras };
}

function montarChunk() {
  const chunk = criarChunk(0, 0);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const h = estado.alturas[r][c] | 0;
      if (h <= 0) continue;
      preencherColunaSolida(chunk, ORIGEM + c, ORIGEM + r, h, BLOCO.GRAMA);
    }
  }
  for (let i = 0; i < estado.furos.length; i++) {
    const f = estado.furos[i];
    definirLocal(chunk, ORIGEM + f.c, ORIGEM + f.r, f.z, BLOCO.AR);
  }
  instalarChunk(chunk);
  return chunk;
}

function vizinhoSolido(chunk, lx, ly, lz) {
  if (lz < 0) return true;
  if (lx < 0 || ly < 0 || lz >= CHUNK_Y || lx >= CHUNK_XZ || ly >= CHUNK_XZ) return false;
  return ehSolido(obterLocal(chunk, lx, ly, lz));
}

function arestasDaFace(lx, ly, lz, dx, dy, dz, pos) {
  const x0 = lx;
  const x1 = lx + 1;
  const z0 = ly;
  const z1 = ly + 1;
  const y0 = lz;
  const y1 = lz + 1;
  let quad;
  if (dz === 1) quad = [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
  else if (dz === -1) quad = [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]];
  else if (dy === 1) quad = [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  else if (dy === -1) quad = [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]];
  else if (dx === 1) quad = [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]];
  else quad = [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]];
  for (let i = 0; i < 4; i++) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  }
}

function gaiolaDe(chunk) {
  const pos = [];
  const dirs = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      for (let lz = 0; lz < 12; lz++) {
        if (!ehSolido(obterLocal(chunk, lx, ly, lz))) continue;
        for (let d = 0; d < dirs.length; d++) {
          const dir = dirs[d];
          if (vizinhoSolido(chunk, lx + dir[0], ly + dir[1], lz + dir[2])) continue;
          arestasDaFace(lx, ly, lz, dir[0], dir[1], dir[2], pos);
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return geo;
}

function marcasDoFoco() {
  const foco = estado.foco;
  if (!foco) return [];
  return [{
    tipo: "marca",
    nome: foco.nome,
    x: ORIGEM + foco.c + 0.5,
    y: foco.z + 0.72,
    z: ORIGEM + foco.r + 0.5,
  }];
}

function adicionarMarca(foco) {
  const caixa = new THREE.BoxGeometry(1.05, 1.05, 1.05);
  const arestas = new THREE.EdgesGeometry(caixa);
  caixa.dispose();
  const linhas = new THREE.LineSegments(arestas, matMarcaLinha);
  linhas.position.set(ORIGEM + foco.c + 0.5, foco.z + 0.5, ORIGEM + foco.r + 0.5);
  linhas.renderOrder = 8;
  raiz.add(linhas);
  const miolo = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.98, 0.98), matMarcaMiolo);
  miolo.position.copy(linhas.position);
  miolo.renderOrder = 3;
  raiz.add(miolo);
}

function enquadrarPerto(foco) {
  const cx = ORIGEM + foco.c + 0.5;
  const cy = foco.z + 0.5;
  const cz = ORIGEM + foco.r + 0.5;
  const perto = [];
  for (let i = 0; i < pontos.length; i++) {
    const p = pontos[i];
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dz = p.z - cz;
    if (dx * dx + dy * dy + dz * dz < 2.4 * 2.4) perto.push(p);
  }
  enquadrar(perto.length ? perto : [{ x: cx, y: cy, z: cz }]);
}

function listasDeCelulas(chunk) {
  const lista = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const lx = ORIGEM + c;
      const ly = ORIGEM + r;
      let topo = 0;
      for (let lz = 11; lz >= 0; lz--) {
        if (ehSolido(obterLocal(chunk, lx, ly, lz))) {
          topo = lz + 1;
          break;
        }
      }
      if (topo <= 0) continue;
      lista.push({
        tipo: "celula",
        nome: `${String.fromCharCode(65 + c)}${r + 1}`,
        x: lx + 0.5,
        y: topo + 0.08,
        z: ly + 0.5,
      });
    }
  }
  return lista;
}

function materialDoPapel(papel) {
  if (papel === "parede") return matParede;
  if (papel === "beiral") return matBeiral;
  return matTopo;
}

function liberarRaiz() {
  const geos = new Set();
  while (raiz.children.length) {
    const obj = raiz.children[0];
    raiz.remove(obj);
    obj.traverse((filho) => {
      if (filho.geometry) geos.add(filho.geometry);
    });
  }
  for (const geo of geos) geo.dispose();
}

function adotarSaida(saida) {
  const usar = [];
  const lixo = [];
  for (const item of saida.topos || []) {
    if (item?.geo) usar.push({ geo: item.geo, papel: "topo" });
  }
  for (const item of saida.paredes || []) {
    if (item?.geo) usar.push({ geo: item.geo, papel: "parede" });
  }
  if (saida.geoLedges) {
    (estado.beiral ? usar : lixo).push({ geo: saida.geoLedges, papel: "beiral" });
  }
  for (const geo of [saida.geoAo, saida.geoCubos, saida.geoAgua, saida.geoQueda]) {
    if (geo) lixo.push({ geo });
  }
  for (let i = 0; i < lixo.length; i++) lixo[i].geo.dispose();
  return usar;
}

function tubos(gruposVerts, verts) {
  let n = 0;
  for (let i = 0; i < gruposVerts.length; i++) n += gruposVerts[i].arestas.length;
  if (!n) return null;
  const geo = new THREE.CylinderGeometry(0.018, 0.018, 1, 6, 1, true);
  const malha = new THREE.InstancedMesh(geo, matFresta, n);
  malha.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  malha.frustumCulled = false;
  malha.renderOrder = 6;
  const cima = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const meio = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const escala = new THREE.Vector3();
  const matriz = new THREE.Matrix4();
  const dono = [];
  let cursor = 0;
  for (let g = 0; g < gruposVerts.length; g++) {
    const grupo = gruposVerts[g];
    for (let i = 0; i < grupo.arestas.length; i++) {
      const a = verts[grupo.arestas[i].a];
      const b = verts[grupo.arestas[i].b];
      dir.set(b.x - a.x, b.y - a.y, b.z - a.z);
      const len = dir.length() || 0.0001;
      dir.multiplyScalar(1 / len);
      if (dir.y < -0.999) quat.set(1, 0, 0, 0);
      else quat.setFromUnitVectors(cima, dir);
      meio.set((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, (a.z + b.z) * 0.5);
      escala.set(1, len, 1);
      matriz.compose(meio, quat, escala);
      malha.setMatrixAt(cursor, matriz);
      dono.push(grupo.id);
      cursor++;
    }
  }
  malha.userData.dono = dono;
  malha.count = cursor;
  return malha;
}

function pintarTubos(malha) {
  if (!malha?.instanceColor) return;
  const dono = malha.userData.dono || [];
  const cor = new THREE.Color();
  for (let i = 0; i < dono.length; i++) {
    cor.set(dono[i] === frestaAtiva ? 0xffe08a : 0xff4d3a);
    malha.setColorAt(i, cor);
  }
  malha.instanceColor.needsUpdate = true;
}

function nuvemDe(lista, geo) {
  const pos = new Float32Array(lista.length * 3);
  for (let i = 0; i < lista.length; i++) {
    pos[i * 3] = lista[i].x;
    pos[i * 3 + 1] = lista[i].y;
    pos[i * 3 + 2] = lista[i].z;
  }
  geo.dispose();
  const nova = new THREE.BufferGeometry();
  nova.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return nova;
}

function limitesDe(lista) {
  const caixa = new THREE.Box3();
  if (!lista.length) {
    caixa.setFromCenterAndSize(
      new THREE.Vector3(ORIGEM + N * 0.5, 2, ORIGEM + N * 0.5),
      new THREE.Vector3(N, 4, N),
    );
    return caixa;
  }
  for (let i = 0; i < lista.length; i++) {
    caixa.expandByPoint(tmp.set(lista[i].x, lista[i].y, lista[i].z));
  }
  return caixa;
}

function enquadrar(lista) {
  const caixa = limitesDe(lista);
  const centro = caixa.getCenter(new THREE.Vector3());
  const esfera = caixa.getBoundingSphere(new THREE.Sphere());
  const dir = camera.position.clone().sub(controles.target);
  if (dir.lengthSq() < 1e-6) dir.set(1, 0.7, 1);
  dir.normalize();
  const dist = Math.max(1.4, esfera.radius * 2.8);
  controles.target.copy(centro);
  camera.position.copy(centro).addScaledVector(dir, dist);
  controles.update();
}

function reconstruir(manterCamera) {
  const nomeAntes = selecionado?.nome || null;
  const frestaAntes = frestaAtiva;
  liberarRaiz();
  let chunk;
  let pecas = [];
  try {
    chunk = montarChunk();
    pecas = adotarSaida(malharChunk(chunk));
  } catch (erro) {
    statusEl.textContent = erro?.message || "Falha ao gerar a malha.";
    return;
  }

  for (let i = 0; i < pecas.length; i++) {
    const peca = pecas[i];
    const malha = new THREE.Mesh(peca.geo, materialDoPapel(peca.papel));
    raiz.add(malha);
    if (estado.wire && peca.papel !== "beiral") {
      const fio = new THREE.Mesh(peca.geo, matWire);
      fio.renderOrder = 1;
      raiz.add(fio);
    }
  }

  const estruturais = pecas.filter((p) => p.papel !== "beiral");
  const analise = analisar(estruturais);
  pontos = analise.verts;
  grupos = analise.grupos;
  tris = analise.tris;
  sobreposicoes = analise.sobreposicoes;
  celulas = listasDeCelulas(chunk);
  marcas = marcasDoFoco();

  if (estado.gaiola) {
    const linhas = new THREE.LineSegments(gaiolaDe(chunk), matGaiola);
    raiz.add(linhas);
  }
  if (estado.foco) adicionarMarca(estado.foco);

  const malhaTubos = tubos(grupos, pontos);
  if (malhaTubos) raiz.add(malhaTubos);

  const normais = [];
  const deFresta = [];
  for (let i = 0; i < pontos.length; i++) {
    (pontos[i].fresta ? deFresta : normais).push(pontos[i]);
  }
  nuvemNormais.geometry = nuvemDe(normais, nuvemNormais.geometry);
  nuvemFrestas.geometry = nuvemDe(deFresta, nuvemFrestas.geometry);
  nuvemNormais.userData.lista = normais;
  nuvemFrestas.userData.lista = deFresta;

  selecionado = nomeAntes ? pontos.find((p) => p.nome === nomeAntes) || null : null;
  frestaAtiva = grupos.some((g) => g.id === frestaAntes) ? frestaAntes : null;
  if (selecionado?.frestas?.length && !frestaAtiva) frestaAtiva = selecionado.frestas[0];
  hover = null;
  pintarTubos(malhaTubos);
  desenharFrestas();
  desenharPainel();

  const extra = sobreposicoes ? ` · ${sobreposicoes} arestas com 3+ triângulos` : "";
  const preset = PRESETS.find((p) => p.id === estado.presetId);
  const titulo = preset ? preset.nome : "Personalizado";
  const palavra = grupos.length === 1 ? "fresta" : "frestas";
  statusEl.textContent = `${titulo} · inset ${TRONCO_INSET.toFixed(2)} · ${grupos.length} ${palavra} · ${tris} triângulos · ${pontos.length} pontos${extra}`;

  if (!manterCamera) {
    if (estado.foco) enquadrarPerto(estado.foco);
    else enquadrar(pontos.length ? pontos : celulas);
  }
}

function desenharFrestas() {
  frestasEl.replaceChildren();
  if (!grupos.length) {
    const vazio = document.createElement("li");
    vazio.className = "nota";
    vazio.textContent = "Nenhuma fresta nessa configuração.";
    frestasEl.appendChild(vazio);
    return;
  }
  for (let g = 0; g < grupos.length; g++) {
    const grupo = grupos[g];
    const item = document.createElement("li");
    item.className = "fresta";
    if (grupo.id === frestaAtiva) item.dataset.ativa = "1";
    const titulo = document.createElement("button");
    titulo.type = "button";
    titulo.className = "fresta__titulo";
    titulo.textContent = `${grupo.id} · ${grupo.ids.length} pontos`;
    titulo.addEventListener("click", () => {
      frestaAtiva = grupo.id;
      const lista = grupo.ids.map((id) => pontos[id]);
      selecionado = lista[0] || null;
      pintarTubos(raiz.children.find((filho) => filho.isInstancedMesh));
      desenharFrestas();
      desenharPainel();
      enquadrar(lista);
    });
    item.appendChild(titulo);
    const lista = document.createElement("ul");
    lista.className = "fresta__pontos";
    const nomes = [];
    for (let i = 0; i < grupo.ids.length; i++) {
      const ponto = pontos[grupo.ids[i]];
      if (nomes.some((n) => n.nome === ponto.nome)) continue;
      nomes.push(ponto);
    }
    nomes.sort((a, b) => a.nome.localeCompare(b.nome));
    for (let i = 0; i < nomes.length; i++) {
      const ponto = nomes[i];
      const botao = document.createElement("button");
      botao.type = "button";
      botao.textContent = ponto.nome;
      if (selecionado?.nome === ponto.nome) botao.setAttribute("aria-pressed", "true");
      botao.addEventListener("click", () => escolherPonto(ponto, true));
      const li = document.createElement("li");
      li.appendChild(botao);
      lista.appendChild(li);
    }
    item.appendChild(lista);
    frestasEl.appendChild(item);
  }
}

function desenharPainel() {
  painelEl.replaceChildren();
  if (!selecionado || selecionado.tipo === "celula") {
    const nota = document.createElement("p");
    nota.className = "nota";
    nota.textContent = "Clique um ponto na malha ou na lista.";
    painelEl.appendChild(nota);
    return;
  }
  const nome = document.createElement("p");
  nome.className = "nome";
  nome.textContent = selecionado.nome;
  const coords = document.createElement("p");
  coords.className = "coords";
  coords.textContent = `x ${selecionado.x.toFixed(3)} · y ${selecionado.y.toFixed(3)} · z ${selecionado.z.toFixed(3)} · ${selecionado.uso} triângulos`;
  painelEl.append(nome, coords);
  if (selecionado.aliases?.length) {
    const lista = document.createElement("ul");
    lista.className = "aliases";
    for (let i = 0; i < selecionado.aliases.length; i++) {
      const li = document.createElement("li");
      li.textContent = selecionado.aliases[i];
      lista.appendChild(li);
    }
    painelEl.appendChild(lista);
  }
  if (selecionado.frestas?.length) {
    const fr = document.createElement("p");
    fr.className = "nota";
    fr.textContent = `Nas frestas ${selecionado.frestas.join(", ")}`;
    painelEl.appendChild(fr);
  }
  const acoes = document.createElement("div");
  acoes.className = "acoes";
  const copiar = document.createElement("button");
  copiar.type = "button";
  copiar.textContent = "Copiar nome";
  copiar.addEventListener("click", () => copiarTexto(selecionado.nome, "Nome copiado"));
  const olhar = document.createElement("button");
  olhar.type = "button";
  olhar.textContent = "Enquadrar";
  olhar.addEventListener("click", () => enquadrar([selecionado]));
  acoes.append(copiar, olhar);
  painelEl.appendChild(acoes);
}

function escolherPonto(ponto, copiar) {
  if (!ponto || ponto.tipo === "celula") return;
  selecionado = ponto;
  frestaAtiva = ponto.frestas?.[0] || frestaAtiva;
  pintarTubos(raiz.children.find((filho) => filho.isInstancedMesh));
  desenharFrestas();
  desenharPainel();
  if (copiar) copiarTexto(ponto.nome, "Nome copiado");
}

function relatorio() {
  const preset = PRESETS.find((p) => p.id === estado.presetId);
  const linhas = [
    `Preset: ${preset ? preset.nome : "Personalizado"}`,
    `Inset: ${TRONCO_INSET.toFixed(2)}`,
    `Frestas: ${grupos.length}`,
    `Triângulos: ${tris}`,
    `Pontos: ${pontos.length}`,
  ];
  if (sobreposicoes) linhas.push(`Arestas com 3+ triângulos: ${sobreposicoes}`);
  for (let g = 0; g < grupos.length; g++) {
    const grupo = grupos[g];
    const nomes = [];
    for (let i = 0; i < grupo.ids.length; i++) {
      const nome = pontos[grupo.ids[i]].nome;
      if (!nomes.includes(nome)) nomes.push(nome);
    }
    nomes.sort();
    linhas.push(`${grupo.id}: ${nomes.join(" — ")}`);
  }
  if (!grupos.length) linhas.push("Nenhuma fresta.");
  linhas.push("Grade (norte em cima, A à esquerda):");
  for (let r = 0; r < N; r++) linhas.push(estado.alturas[r].join(""));
  if (estado.furos.length) {
    linhas.push(
      `Furos: ${estado.furos.map((f) => `${String.fromCharCode(65 + f.c)}${f.r + 1}.z${f.z}`).join(", ")}`,
    );
  }
  return linhas.join("\n");
}

function copiarTexto(texto, mensagem) {
  const pronto = () => mostrarAviso(mensagem);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(texto).then(pronto).catch(() => copiarPorCampo(texto, pronto));
    return;
  }
  copiarPorCampo(texto, pronto);
}

function copiarPorCampo(texto, pronto) {
  const campo = document.createElement("textarea");
  campo.value = texto;
  campo.setAttribute("readonly", "");
  campo.style.position = "fixed";
  campo.style.left = "-999px";
  document.body.appendChild(campo);
  campo.select();
  document.execCommand("copy");
  campo.remove();
  pronto();
}

function mostrarAviso(mensagem) {
  avisoEl.hidden = false;
  avisoEl.textContent = mensagem;
  window.clearTimeout(avisoTimer);
  avisoTimer = window.setTimeout(() => {
    avisoEl.hidden = true;
  }, 1400);
}

function projetar(x, y, z) {
  tmp.set(x, y, z).project(camera);
  if (tmp.z < -1 || tmp.z > 1) return null;
  const largura = palco.clientWidth;
  const altura = palco.clientHeight;
  const sx = (tmp.x * 0.5 + 0.5) * largura;
  const sy = (-tmp.y * 0.5 + 0.5) * altura;
  if (sx < -40 || sy < -20 || sx > largura + 40 || sy > altura + 20) return null;
  return { sx, sy };
}

function classeDo(item) {
  if (item.p.tipo === "marca") return "rotulo rotulo--marca";
  if (item.p === selecionado) return "rotulo rotulo--ativo";
  if (item.p === hover) return "rotulo rotulo--hover";
  if (item.p.tipo === "celula") return "rotulo rotulo--celula";
  if (item.p.fresta) return "rotulo rotulo--fresta";
  return "rotulo";
}

function medirRotulo(texto) {
  return { w: Math.max(28, texto.length * 6.5 + 12), h: 18 };
}

function rotuloLivre(x, y, w, h, caixas) {
  const m = 4;
  for (let i = 0; i < caixas.length; i++) {
    const c = caixas[i];
    if (x < c.x + c.w + m && x + w + m > c.x && y < c.y + c.h + m && y + h + m > c.y) return false;
  }
  return true;
}

function encaixarRotulo(sx, sy, w, h, caixas) {
  const passos = [
    [0, -10],
    [0, -32],
    [w * 0.55, -22],
    [-w * 0.55, -22],
    [w * 0.9, 4],
    [-w * 0.9, 4],
    [0, 18],
    [0, -54],
    [w, -46],
    [-w, -46],
  ];
  for (let i = 0; i < passos.length; i++) {
    const x = sx + passos[i][0] - w / 2;
    const y = sy + passos[i][1] - h;
    if (rotuloLivre(x, y, w, h, caixas)) return { x, y };
  }
  return { x: sx - w / 2, y: sy - 24 - caixas.length * 3 };
}

function atualizarRotulos() {
  const fila = [];
  const vistos = new Set();
  const por = (p, prioridade) => {
    if (!p || vistos.has(p)) return;
    vistos.add(p);
    fila.push({ p, prioridade });
  };
  por(selecionado, 0);
  por(hover, 0);
  for (let i = 0; i < marcas.length; i++) por(marcas[i], 0);
  if (estado.foco) {
    const foco = estado.foco;
    const cx = ORIGEM + foco.c + 0.5;
    const cy = foco.z + 0.5;
    const cz = ORIGEM + foco.r + 0.5;
    for (let i = 0; i < pontos.length; i++) {
      const p = pontos[i];
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dz = p.z - cz;
      if (dx * dx + dy * dy + dz * dz < 1.35 * 1.35) por(p, 1);
    }
  }
  if (estado.modoNomes === "frestas" || estado.modoNomes === "todos") {
    for (let i = 0; i < pontos.length; i++) if (pontos[i].fresta) por(pontos[i], 1);
  }
  if (estado.celulas) {
    for (let i = 0; i < celulas.length; i++) por(celulas[i], 2);
  }
  if (estado.modoNomes === "cursor" && ponteiroDentro) {
    const perto = [];
    for (let i = 0; i < pontos.length; i++) {
      const p = projetar(pontos[i].x, pontos[i].y, pontos[i].z);
      if (!p) continue;
      const dx = p.sx - ponteiroX;
      const dy = p.sy - ponteiroY;
      const d2 = dx * dx + dy * dy;
      if (d2 < 80 * 80) perto.push({ ponto: pontos[i], d2 });
    }
    perto.sort((a, b) => a.d2 - b.d2);
    for (let i = 0; i < perto.length && i < 8; i++) por(perto[i].ponto, 3);
  }
  if (estado.modoNomes === "todos") {
    for (let i = 0; i < pontos.length; i++) por(pontos[i], 4);
  }

  const largura = palco.clientWidth;
  const altura = palco.clientHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const bw = Math.max(1, Math.floor(largura * dpr));
  const bh = Math.max(1, Math.floor(altura * dpr));
  if (guias.width !== bw || guias.height !== bh) {
    guias.width = bw;
    guias.height = bh;
  }
  guiasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  guiasCtx.clearRect(0, 0, largura, altura);

  ocupacao.clear();
  const caixas = [];
  const visiveis = [];
  for (let i = 0; i < fila.length; i++) {
    const item = fila[i];
    const p = projetar(item.p.x, item.p.y, item.p.z);
    if (!p) continue;
    if (item.prioridade >= 4) {
      const chave = `${(p.sx / 28) | 0},${(p.sy / 18) | 0}`;
      if (ocupacao.has(chave)) continue;
      ocupacao.add(chave);
    }
    const medida = medirRotulo(item.p.nome);
    const lugar = encaixarRotulo(p.sx, p.sy, medida.w, medida.h, caixas);
    caixas.push({ x: lugar.x, y: lugar.y, w: medida.w, h: medida.h });
    visiveis.push({ ...item, ...p, ...lugar, ...medida });
  }

  guiasCtx.lineWidth = 1;
  for (let i = 0; i < visiveis.length; i++) {
    const item = visiveis[i];
    const ax = Math.max(item.x, Math.min(item.sx, item.x + item.w));
    const ay = Math.max(item.y, Math.min(item.sy, item.y + item.h));
    const dx = ax - item.sx;
    const dy = ay - item.sy;
    if (dx * dx + dy * dy < 36) continue;
    guiasCtx.strokeStyle = item.p.fresta ? "rgba(255, 90, 69, 0.9)" : "rgba(155, 184, 166, 0.55)";
    guiasCtx.beginPath();
    guiasCtx.moveTo(item.sx, item.sy);
    guiasCtx.lineTo(ax, ay);
    guiasCtx.stroke();
  }

  while (pool.length < visiveis.length) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "rotulo";
    el.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const alvo = el._alvo;
      if (!alvo) return;
      if (alvo.tipo === "celula" || alvo.tipo === "marca") {
        enquadrar([{ x: alvo.x, y: alvo.y, z: alvo.z }]);
        return;
      }
      escolherPonto(alvo, true);
    });
    rotulosEl.appendChild(el);
    pool.push(el);
  }
  for (let i = 0; i < pool.length; i++) {
    const el = pool[i];
    const item = visiveis[i];
    if (!item) {
      el.hidden = true;
      el._alvo = null;
      continue;
    }
    el.hidden = false;
    el._alvo = item.p;
    el.className = classeDo(item);
    el.textContent = item.p.nome;
    el.style.transform = `translate3d(${item.x}px, ${item.y}px, 0)`;
  }
}

function acertarPonto(ev) {
  const rect = canvas.getBoundingClientRect();
  ponteiro.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  ponteiro.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  const dist = camera.position.distanceTo(controles.target);
  raycaster.params.Points.threshold = Math.max(0.05, dist * 0.012);
  raycaster.setFromCamera(ponteiro, camera);
  const hits = raycaster.intersectObjects([nuvemFrestas, nuvemNormais], false);
  if (!hits.length) return null;
  const hit = hits[0];
  const lista = hit.object.userData.lista || [];
  return lista[hit.index] || null;
}

function tamanho() {
  const w = Math.max(1, palco.clientWidth);
  const h = Math.max(1, palco.clientHeight);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function quadro() {
  controles.update();
  atualizarRotulos();
  renderer.render(cena, camera);
  requestAnimationFrame(quadro);
}

desenharPresets();
desenharAlturas();
let insetPendente = false;
$("inset").addEventListener("input", (ev) => {
  const valor = definirTroncoInset(ev.target.value);
  $("inset-valor").textContent = valor.toFixed(2);
  if (insetPendente) return;
  insetPendente = true;
  requestAnimationFrame(() => {
    insetPendente = false;
    reconstruir(true);
  });
});
$("ver-gaiola").addEventListener("change", (ev) => {
  estado.gaiola = ev.target.checked;
  reconstruir(true);
});
$("ver-wire").addEventListener("change", (ev) => {
  estado.wire = ev.target.checked;
  reconstruir(true);
});
$("ver-celulas").addEventListener("change", (ev) => {
  estado.celulas = ev.target.checked;
});
$("ver-beiral").addEventListener("change", (ev) => {
  estado.beiral = ev.target.checked;
  reconstruir(true);
});
$("modo-nomes").addEventListener("change", (ev) => {
  estado.modoNomes = ev.target.value;
});
$("copiar-relatorio").addEventListener("click", () => copiarTexto(relatorio(), "Relatório copiado"));
$("enquadrar-frestas").addEventListener("click", () => {
  const lista = [];
  for (let i = 0; i < pontos.length; i++) if (pontos[i].fresta) lista.push(pontos[i]);
  enquadrar(lista.length ? lista : pontos);
});

window.addEventListener("pointerup", soltarPintura);
canvas.addEventListener("pointerdown", () => {
  arrasto = 0;
});
canvas.addEventListener("pointermove", (ev) => {
  const rect = canvas.getBoundingClientRect();
  ponteiroX = ev.clientX - rect.left;
  ponteiroY = ev.clientY - rect.top;
  ponteiroDentro = true;
  if (ev.buttons) arrasto += Math.abs(ev.movementX) + Math.abs(ev.movementY);
  hover = acertarPonto(ev);
  canvas.style.cursor = hover ? "pointer" : "";
});
canvas.addEventListener("pointerleave", () => {
  ponteiroDentro = false;
  hover = null;
  canvas.style.cursor = "";
});
canvas.addEventListener("pointerup", (ev) => {
  if (arrasto > 5) return;
  const ponto = acertarPonto(ev);
  if (ponto) escolherPonto(ponto, true);
});

window.addEventListener("keydown", (ev) => {
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  if (ev.key === "[" || ev.key === "]") {
    const i = PRESETS.findIndex((p) => p.id === estado.presetId);
    const passo = ev.key === "]" ? 1 : -1;
    const prox = PRESETS[(i + passo + PRESETS.length) % PRESETS.length];
    aplicarPreset(prox, !prox.foco);
  }
});

new ResizeObserver(tamanho).observe(palco);
tamanho();
aplicarPreset(PRESETS[0], false);
requestAnimationFrame(quadro);
