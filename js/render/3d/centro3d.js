/**
 * Sala do Centro: chão, paredes, balcão, enfermeira, máquina e o PC do Bill.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../../config.js";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { ALTURA_PAREDE_HUB } from "../../mundo/cidade/plantaHub.js";
import { plantaCentro } from "../../mundo/cidade/centro.js";
import { aplicarLuzCidade } from "./luzes/mapaChao.js";
import {
  atualizarBolasCura,
  criarBolasCura,
  imagem as imagemPronta,
  moldePe,
  porBillboard,
  quadroGente,
  recortar,
} from "./cartaoPe.js";

const FOLHA = "/ref/sprites/interiors/pokecenter-emerald-bg.png";
const FOLHA_FRENTE = "/ref/sprites/interiors/pokecenter-emerald-fg.png";
const FOLHA_MOVEIS = "/ref/sprites/interiors/dcj0huc-7206dd1d-9450-4232-a708-b07b4bd0c392.png";
const FOLHA_GENTE =
  "/ref/sprites/people/logic 2/DS _ DSi - Pokemon Platinum - Non-Playable Characters - NPCs.png";
const RECORTE_CURA = Object.freeze({ col: 6, row: 43, cols: 2, rows: 3, tile: 16 });
const RECORTE_PC = Object.freeze({ col: 5, row: 42, cols: 1, rows: 2, tile: 16 });
const bolas = [];
const COLUNAS = 32;
const TILE = 16;
const SPRITE_CHAO = 1;
const SPRITE_PAREDE = 16;
const ALTURA_BALCAO = 2;
const FAIXA_TOPO = 6;

function texturaDeTela(tela) {
  const tex = new THREE.CanvasTexture(tela);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function texturaSprite(img, id) {
  const tela = document.createElement("canvas");
  tela.width = TILE;
  tela.height = TILE;
  const ctx = tela.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const sx = (id % COLUNAS) * TILE;
  const sy = Math.floor(id / COLUNAS) * TILE;
  ctx.drawImage(img, sx, sy, TILE, TILE, 0, 0, TILE, TILE);
  return texturaDeTela(tela);
}

function texturaFaixa(img, id, y0, y1) {
  const tela = document.createElement("canvas");
  tela.width = TILE;
  tela.height = TILE;
  const ctx = tela.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const sx = (id % COLUNAS) * TILE;
  const sy = Math.floor(id / COLUNAS) * TILE + y0;
  ctx.drawImage(img, sx, sy, TILE, y1 - y0, 0, 0, TILE, TILE);
  return texturaDeTela(tela);
}

function material(tex, afasta) {
  const mat = new THREE.MeshLambertMaterial({
    map: tex,
    polygonOffset: true,
    polygonOffsetFactor: afasta ? 1 : -2,
    polygonOffsetUnits: afasta ? 1 : -2,
  });
  aplicarLuzCidade(mat);
  return mat;
}

function anexarPeca(sala, planta, moveis, id, recorte, aoColocar) {
  if (!moveis) return;
  const molde = moldePe(recortar(moveis, recorte));
  for (let i = 0; i < planta.props.length; i++) {
    const prop = planta.props[i];
    if (prop.id !== id) continue;
    const inst = porBillboard(molde, planta.origemX + prop.x, planta.origemY + prop.y);
    if (!inst) continue;
    sala.add(inst);
    if (aoColocar) aoColocar(inst);
  }
}

function anexarBalcao(sala, planta, frente) {
  const peca = planta.balcao;
  if (!peca || !frente) return;
  const matLado = material(texturaSprite(frente, peca.sprite), true);
  const matTopo = material(texturaFaixa(frente, peca.sprite, 0, FAIXA_TOPO), true);
  const geo = new THREE.BoxGeometry(1, ALTURA_BALCAO, peca.h);
  const materiais = [matLado, matLado, matTopo, matLado, matLado, matLado];
  const y = ALTURA_PRACA + ALTURA_BALCAO * 0.5;
  for (let i = 0; i < peca.w; i++) {
    const mesh = new THREE.Mesh(geo, materiais);
    mesh.position.set(
      planta.origemX + peca.x + i + 0.5,
      y,
      planta.origemY + peca.y + peca.h * 0.5,
    );
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    sala.add(mesh);
  }
}

function anexarEnfermeira(sala, planta, gente) {
  if (!gente) return;
  const moldes = new Map();
  for (let i = 0; i < planta.props.length; i++) {
    const prop = planta.props[i];
    if (prop.id !== "npc" || prop.coluna == null) continue;
    let molde = moldes.get(prop.coluna);
    if (!molde) {
      molde = moldePe(quadroGente(gente, prop.coluna));
      moldes.set(prop.coluna, molde);
    }
    const inst = porBillboard(molde, planta.origemX + prop.x, planta.origemY + prop.y);
    if (inst) sala.add(inst);
  }
}

function anexarSala(sala, planta, img) {
  const chao = texturaSprite(img, SPRITE_CHAO);
  for (let i = 0; i < planta.pisos.length; i++) {
    const r = planta.pisos[i];
    const tex = chao.clone();
    tex.repeat.set(r.w, r.h);
    tex.needsUpdate = true;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), material(tex, false));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(
      planta.origemX + r.x + r.w * 0.5,
      ALTURA_PRACA + 0.08,
      planta.origemY + r.y + r.h * 0.5,
    );
    mesh.receiveShadow = true;
    sala.add(mesh);
  }

  const lado = texturaSprite(img, SPRITE_PAREDE);
  lado.repeat.set(1, ALTURA_PAREDE_HUB * ALTURA_BLOCO);
  const topo = lado.clone();
  topo.repeat.set(1, 1);
  topo.needsUpdate = true;
  const matLado = material(lado, true);
  const matTopo = material(topo, true);
  const geo = new THREE.BoxGeometry(1, ALTURA_PAREDE_HUB, 1);
  const materiais = [matLado, matLado, matTopo, matLado, matLado, matLado];
  const y = ALTURA_PRACA + ALTURA_PAREDE_HUB * 0.5;
  for (let row = 0; row < planta.rows; row++) {
    for (let col = 0; col < planta.cols; col++) {
      if (!planta.muro[row * planta.cols + col]) continue;
      const mesh = new THREE.Mesh(geo, materiais);
      mesh.position.set(planta.origemX + col + 0.5, y, planta.origemY + row + 0.5);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      sala.add(mesh);
    }
  }
}

export function montarCentro3d(grupo) {
  const sala = new THREE.Group();
  sala.name = "centro";
  grupo.add(sala);
  const planta = plantaCentro();
  return Promise.all([
    imagemPronta(FOLHA),
    imagemPronta(FOLHA_MOVEIS).catch(() => null),
    imagemPronta(FOLHA_FRENTE).catch(() => null),
    imagemPronta(FOLHA_GENTE).catch(() => null),
  ])
    .then(([img, moveis, frente, gente]) => {
      anexarSala(sala, planta, img);
      anexarBalcao(sala, planta, frente);
      anexarPeca(sala, planta, moveis, "cura", RECORTE_CURA, (inst) => {
        if (!inst.userData.cartao) return;
        const novas = criarBolasCura(inst.userData.cartao);
        for (let b = 0; b < novas.length; b++) bolas.push(novas[b]);
      });
      anexarPeca(sala, planta, moveis, "pc", RECORTE_PC);
      anexarEnfermeira(sala, planta, gente);
    })
    .catch((erro) => {
      console.error("sala do centro", erro);
    });
}

export function atualizarCentro(px, py) {
  const planta = plantaCentro();
  const dentro =
    px >= planta.origemX &&
    py >= planta.origemY &&
    px < planta.origemX + planta.cols &&
    py < planta.origemY + planta.rows;
  atualizarBolasCura(bolas, dentro);
}
