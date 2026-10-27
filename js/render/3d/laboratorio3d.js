/**
 * Casca, piso e props do laboratório. PC/vasos/tanks em billboard;
 * máquina de cura e máquinas extras em OBJ.
 */
import * as THREE from "three";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { aplicarLuzCidade } from "./luzes/mapaChao.js";
import {
  ALTURA_PAREDE_LAB,
  COLS_LAB,
  ORIGEM_LAB_X,
  ORIGEM_LAB_Y,
  ROWS_LAB,
  plantaLaboratorio,
  sincronizarBolasLabDaConfig,
} from "../../mundo/cidade/laboratorio.js";
import { cascasDaParede } from "../../mundo/cidade/plantaHub.js";
import { MESA_ESCRIVANINHA, MESA_LAB_BOLAS, propDoSprite } from "../../mundo/cidade/catalogoProps.js";
import {
  atualizarBolasCura,
  girarCartoes,
  imagem,
  moldeChao,
  moldePe,
  porBillboard,
  porChao,
  quadroGente,
  recortar,
  facesParedeInterior,
} from "./cartaoPe.js";
import {
  carregarMoldesProps,
  criarBolasCuraNaMalha,
  criarBolasIniciaisNaMesa,
  instanciarProp,
} from "./propsObj3d.js";
import { carregarSlotsMesaLab } from "../../jogo/slotsMesaLabConfig.js";
import { fatorYCasa } from "./escalaVertical.js";
import { criarFaixaParede } from "./paredeInteriorDual.js";

const FOLHA_MOVEIS = "/ref/sprites/interiors/dcj0huc-7206dd1d-9450-4232-a708-b07b4bd0c392.png";
const FOLHA_VASO = "/ref/sprites/interiors/Safari-Zone-Inner-Room-Hospital-Tileset-629434880.png";
const FOLHA_PISO = "/ref/sprites/buildings/Mountains-Trees-and-Public-Decorations-Fan-Game-757531020.png";
const FOLHA_GENTE =
  "/assets/people/logic 2/DS _ DSi - Pokemon Platinum - Non-Playable Characters - NPCs.png";

const RECORTE = Object.freeze({
  tank: Object.freeze({ url: "/ref/sprites/interiors/lab/lab-incubator-tank-empty-feet.png" }),
  tankBolas: Object.freeze({ url: "/ref/sprites/interiors/lab/lab-incubator-tank-pokeballs-feet.png" }),
  pc: Object.freeze({ url: "/ref/sprites/interiors/lab/lab-computer-blank.png" }),
  pcGrafico: Object.freeze({ url: "/ref/sprites/interiors/lab/lab-computer-graph.png" }),
  estante: Object.freeze({ url: FOLHA_MOVEIS, col: 0, row: 45, cols: 2, rows: 2, tile: 16 }),
  tapete: Object.freeze({ url: FOLHA_MOVEIS, col: 0, row: 54, cols: 2, rows: 1, tile: 16 }),
  livros: Object.freeze({ url: FOLHA_MOVEIS, col: 3, row: 45, cols: 1, rows: 1, tile: 16 }),
  vasoA: Object.freeze({ url: FOLHA_VASO, col: 15, row: 41, cols: 3, rows: 6, tile: 16, escala: 0.5 }),
  vasoB: Object.freeze({ url: FOLHA_VASO, col: 18, row: 41, cols: 3, rows: 6, tile: 16, escala: 0.5 }),
  vasoC: Object.freeze({ url: FOLHA_VASO, col: 21, row: 40, cols: 3, rows: 7, tile: 16, escala: 0.5 }),
});

const IDS_PROPS_LAB = Object.freeze([
  "cura",
  "maquina-2",
  "maquina-3",
  "maquina-4",
  MESA_LAB_BOLAS,
  MESA_ESCRIVANINHA,
]);

const bolasCura = [];

function materialCaixa(cor) {
  const mat = new THREE.MeshLambertMaterial({
    color: cor,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  aplicarLuzCidade(mat);
  return mat;
}

function anexarCasca(grupo, piso) {
  const planta = plantaLaboratorio();
  const parede = facesParedeInterior(materialCaixa("#c4b8a8"));
  const h = ALTURA_PAREDE_LAB * fatorYCasa();
  const y = ALTURA_PRACA + h * 0.5;
  const balcaoVazio = new Uint8Array(planta.cols * planta.rows);
  const cascas = cascasDaParede(planta.muro, planta.anda, balcaoVazio, planta.cols, planta.rows);
  for (let i = 0; i < cascas.length; i++) {
    const r = cascas[i];
    grupo.add(
      criarFaixaParede({
        x: ORIGEM_LAB_X + r.x + r.w * 0.5,
        y,
        z: ORIGEM_LAB_Y + r.y + r.h * 0.5,
        w: r.w,
        d: r.h,
        h,
        materiais: parede,
        face: r.face,
      }),
    );
  }
  // Vedações laterais externas — sempre lado, some na órbita.
  for (let i = 0; i < planta.vedacoes.length; i++) {
    const r = planta.vedacoes[i];
    grupo.add(
      criarFaixaParede({
        x: ORIGEM_LAB_X + r.x + r.w * 0.5,
        y,
        z: ORIGEM_LAB_Y + r.y + r.h * 0.5,
        w: r.w,
        d: r.h,
        h,
        materiais: parede,
        face: r.x < 0 ? "oeste" : "leste",
      }),
    );
  }
  if (!piso) return;
  for (let i = 0; i < planta.pisos.length; i++) {
    const r = planta.pisos[i];
    const tex = piso.clone();
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(r.w, r.h);
    tex.needsUpdate = true;
    const mat = new THREE.MeshLambertMaterial({
      map: tex,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    aplicarLuzCidade(mat);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(
      ORIGEM_LAB_X + r.x + r.w * 0.5,
      ALTURA_PRACA + 0.08,
      ORIGEM_LAB_Y + r.y + r.h * 0.5,
    );
    mesh.receiveShadow = true;
    grupo.add(mesh);
  }
}

function anexarMaquinasExtras(sala, planta) {
  const salas = planta.salas;
  if (!salas) return;
  const pontos = [
    { id: "maquina-2", x: salas.a.x0 + 1.2, y: salas.a.y1 - 1.4 },
    { id: "maquina-3", x: salas.c.x1 - 1.3, y: salas.c.y0 + 2.2 },
    { id: "maquina-4", x: salas.c.x0 + 2.0, y: salas.c.y1 - 1.6 },
    { id: "maquina-2", x: salas.b.x1 - 1.4, y: salas.b.y0 + 1.8 },
  ];
  for (let i = 0; i < pontos.length; i++) {
    const p = pontos[i];
    const inst = instanciarProp(p.id, ORIGEM_LAB_X + p.x, ORIGEM_LAB_Y + p.y);
    if (inst) sala.add(inst);
  }
}

export function atualizarLaboratorio(yaw, inclinacao, px, py) {
  girarCartoes(yaw, inclinacao);
  const dentro =
    px >= ORIGEM_LAB_X &&
    py >= ORIGEM_LAB_Y &&
    px < ORIGEM_LAB_X + COLS_LAB &&
    py < ORIGEM_LAB_Y + ROWS_LAB;
  atualizarBolasCura(bolasCura, dentro);
}

export function montarLaboratorio3d(grupo) {
  const planta = plantaLaboratorio();
  const sala = new THREE.Group();
  sala.name = "laboratorio";
  grupo.add(sala);

  const pedidos = new Map();
  function pedir(url) {
    if (!pedidos.has(url)) pedidos.set(url, imagem(url).catch(() => null));
    return pedidos.get(url);
  }
  const chaves = Object.keys(RECORTE);
  return Promise.all([
    ...chaves.map((id) => pedir(RECORTE[id].url)),
    pedir(FOLHA_PISO),
    pedir(FOLHA_GENTE),
    carregarMoldesProps(IDS_PROPS_LAB),
    carregarSlotsMesaLab(),
  ]).then((imagens) => {
    sincronizarBolasLabDaConfig();
    const porUrl = new Map();
    let cursor = 0;
    for (let i = 0; i < chaves.length; i++) porUrl.set(RECORTE[chaves[i]].url, imagens[cursor++]);
    const pisoImg = imagens[cursor++];
    const gente = imagens[cursor];
    const moldes = new Map();
    const moldesChao = new Map();
    for (let i = 0; i < chaves.length; i++) {
      const id = chaves[i];
      const bruto = porUrl.get(RECORTE[id].url);
      if (!bruto) continue;
      const tela = recortar(bruto, RECORTE[id]);
      if (id === "tapete" || id === "livros") moldesChao.set(id, moldeChao(tela));
      moldes.set(id, moldePe(tela, RECORTE[id].escala || 1));
    }
    let piso = null;
    if (pisoImg) {
      const tile = 32;
      const col = 1033 % 8;
      const row = (1033 / 8) | 0;
      const tela = document.createElement("canvas");
      tela.width = tile;
      tela.height = tile;
      const ctx = tela.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pisoImg, col * tile, row * tile, tile, tile, 0, 0, tile, tile);
      piso = new THREE.CanvasTexture(tela);
      piso.colorSpace = THREE.SRGBColorSpace;
      piso.magFilter = THREE.NearestFilter;
      piso.minFilter = THREE.NearestFilter;
      piso.generateMipmaps = false;
      piso.wrapS = THREE.RepeatWrapping;
      piso.wrapT = THREE.RepeatWrapping;
      piso.needsUpdate = true;
    }
    anexarCasca(sala, piso);
    let mesaI = 0;
    for (let i = 0; i < planta.moveis.length; i++) {
      const item = planta.moveis[i];
      const x = ORIGEM_LAB_X + item.x;
      const peZ = ORIGEM_LAB_Y + item.footY;
      if (propDoSprite(item.id) === "cura") {
        const inst = instanciarProp("cura", x, peZ - 0.5);
        if (!inst) continue;
        sala.add(inst);
        const novas = criarBolasCuraNaMalha(inst);
        for (let b = 0; b < novas.length; b++) bolasCura.push(novas[b]);
        continue;
      }
      if (item.id === "mesa") {
        const inst = instanciarProp(MESA_LAB_BOLAS, x, peZ);
        if (inst) {
          sala.add(inst);
          const especies = [];
          for (let b = 0; b < planta.bolas.length; b++) {
            if (planta.bolas[b].mesaI === mesaI) especies.push(planta.bolas[b].especie);
          }
          criarBolasIniciaisNaMesa(inst, especies);
          mesaI += 1;
          continue;
        }
      }
      if (item.id === "escrivaninha") {
        const idMesa = propDoSprite("escrivaninha") || MESA_ESCRIVANINHA;
        const inst = instanciarProp(idMesa, x, peZ, { yaw: item.yaw || 0 });
        if (inst) {
          sala.add(inst);
          continue;
        }
      }
      const z = ORIGEM_LAB_Y + (item.chao ? item.y : item.footY);
      const inst = item.chao
        ? porChao(moldesChao.get(item.id), x, z)
        : porBillboard(moldes.get(item.id), x, peZ);
      if (!inst) continue;
      sala.add(inst);
    }
    anexarMaquinasExtras(sala, planta);
    if (gente) {
      const moldeNpc = new Map();
      for (let i = 0; i < planta.npcs.length; i++) {
        const npc = planta.npcs[i];
        if (!moldeNpc.has(npc.coluna)) moldeNpc.set(npc.coluna, moldePe(quadroGente(gente, npc.coluna)));
        const inst = porBillboard(moldeNpc.get(npc.coluna), ORIGEM_LAB_X + npc.x, ORIGEM_LAB_Y + npc.y);
        if (inst) {
          inst.name = `npc-${npc.id}`;
          sala.add(inst);
        }
      }
    }
  });
}
