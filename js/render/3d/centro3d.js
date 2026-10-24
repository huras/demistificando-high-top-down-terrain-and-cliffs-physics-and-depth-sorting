/**
 * Sala do Centro: chão, paredes, balcão, enfermeira, máquina, PC e os móveis.
 */
import * as THREE from "three";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { ALTURA_PAREDE_HUB } from "../../mundo/cidade/plantaHub.js";
import { plantaCentro } from "../../mundo/cidade/centro.js";
import { MESA_CENTRO } from "../../mundo/cidade/catalogoProps.js";
import { aplicarLuzCidade } from "./luzes/mapaChao.js";
import {
  atualizarBolasCura,
  imagem as imagemPronta,
  moldePe,
  porBillboard,
  quadroGente,
  recortar,
} from "./cartaoPe.js";
import { carregarMoldesProps, criarBolasCuraNaMalha, instanciarProp } from "./propsObj3d.js";
import { fatorYCasa, fatorYCartao, fatorYProp } from "./escalaVertical.js";
import { criarFaixaParede } from "./paredeInteriorDual.js";

const FOLHA = "/ref/sprites/interiors/pokecenter-emerald-bg.png";
const FOLHA_FRENTE = "/ref/sprites/interiors/pokecenter-emerald-fg.png";
const FOLHA_MOVEIS = "/ref/sprites/interiors/dcj0huc-7206dd1d-9450-4232-a708-b07b4bd0c392.png";
const FOLHA_GENTE =
  "/ref/sprites/people/logic 2/DS _ DSi - Pokemon Platinum - Non-Playable Characters - NPCs.png";
const RECORTE_PC = Object.freeze({ col: 5, row: 42, cols: 1, rows: 2, tile: 16 });
const DECOR = Object.freeze({
  vaso: Object.freeze({ url: FOLHA_MOVEIS, col: 5, row: 40, cols: 1, rows: 2, tile: 16 }),
  estante: Object.freeze({ url: FOLHA_MOVEIS, col: 0, row: 45, cols: 2, rows: 2, tile: 16 }),
  cadeira30: Object.freeze({ url: FOLHA_FRENTE, col: 30, row: 0, cols: 1, rows: 1, tile: 16 }),
  cadeira39: Object.freeze({ url: FOLHA_FRENTE, col: 7, row: 1, cols: 1, rows: 1, tile: 16 }),
});
const bolas = [];
const COLUNAS = 32;
const TILE = 16;
const SPRITE_CHAO = 1;
const SPRITE_PAREDE_CIMA = 9;
const SPRITE_PAREDE_BAIXO = 16;
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

function pintarSprite(ctx, img, id, dy) {
  const sx = (id % COLUNAS) * TILE;
  const sy = Math.floor(id / COLUNAS) * TILE;
  ctx.drawImage(img, sx, sy, TILE, TILE, 0, dy, TILE, TILE);
}

function texturaParede(img) {
  const tela = document.createElement("canvas");
  tela.width = TILE;
  tela.height = TILE * 2;
  const ctx = tela.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  pintarSprite(ctx, img, SPRITE_PAREDE_CIMA, 0);
  pintarSprite(ctx, img, SPRITE_PAREDE_BAIXO, TILE);
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

function anexarBalcao(sala, planta, frente) {
  const pecas = planta.balcoes;
  if (!pecas || !frente) return;
  const matLado = material(texturaSprite(frente, pecas[0].sprite), true);
  const matTopo = material(texturaFaixa(frente, pecas[0].sprite, 0, FAIXA_TOPO), true);
  const hBalcao = ALTURA_BALCAO * fatorYProp();
  const geo = new THREE.BoxGeometry(1, hBalcao, 1);
  const materiais = [matLado, matLado, matTopo, matLado, matLado, matLado];
  const y = ALTURA_PRACA + hBalcao * 0.5;
  for (let p = 0; p < pecas.length; p++) {
    const peca = pecas[p];
    for (let iz = 0; iz < peca.h; iz++) {
      for (let ix = 0; ix < peca.w; ix++) {
        const mesh = new THREE.Mesh(geo, materiais);
        mesh.position.set(
          planta.origemX + peca.x + ix + 0.5,
          y,
          planta.origemY + peca.y + iz + 0.5,
        );
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        sala.add(mesh);
      }
    }
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

function telaMapa(img) {
  const tela = document.createElement("canvas");
  tela.width = 26;
  tela.height = 14;
  const ctx = tela.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const pecas = [
    [11, -3, -9],
    [12, 13, -9],
    [16, -3, 7],
    [17, 13, 7],
  ];
  for (let i = 0; i < pecas.length; i++) {
    const id = pecas[i][0];
    const sx = (id % COLUNAS) * TILE;
    const sy = Math.floor(id / COLUNAS) * TILE;
    ctx.drawImage(img, sx, sy, TILE, TILE, pecas[i][1], pecas[i][2], TILE, TILE);
  }
  return tela;
}

function anexarMapa(sala, planta, frente) {
  const lugar = planta.mapa;
  if (!frente || !lugar) return;
  const tela = telaMapa(frente);
  const inst = porBillboard(moldePe(tela), planta.origemX + lugar.x, planta.origemY + lugar.y);
  if (!inst) return;
  const altura = (tela.height / TILE) * fatorYCartao();
  const hParede = ALTURA_PAREDE_HUB * fatorYCasa();
  inst.position.y += hParede - altura - 0.55 * fatorYCasa();
  sala.add(inst);
}

function anexarPeca(sala, planta, moveis, id, recorte) {
  if (!moveis) return;
  const molde = moldePe(recortar(moveis, recorte));
  for (let i = 0; i < planta.props.length; i++) {
    const prop = planta.props[i];
    if (prop.id !== id) continue;
    const inst = porBillboard(molde, planta.origemX + prop.x, planta.origemY + prop.y);
    if (inst) sala.add(inst);
  }
}

function anexarCura3d(sala, planta) {
  for (let i = 0; i < planta.props.length; i++) {
    const prop = planta.props[i];
    if (prop.id !== "cura") continue;
    const inst = instanciarProp("cura", planta.origemX + prop.x, planta.origemY + prop.y - 0.5);
    if (!inst) continue;
    sala.add(inst);
    const novas = criarBolasCuraNaMalha(inst);
    for (let b = 0; b < novas.length; b++) bolas.push(novas[b]);
  }
}

function anexarMesa3d(sala, planta) {
  for (let i = 0; i < planta.props.length; i++) {
    const prop = planta.props[i];
    if (prop.id !== "mesa") continue;
    const inst = instanciarProp(MESA_CENTRO, planta.origemX + prop.x, planta.origemY + prop.y);
    if (inst) sala.add(inst);
  }
}

function anexarDecor(sala, planta, imagens) {
  const moldes = new Map();
  for (let i = 0; i < planta.props.length; i++) {
    const prop = planta.props[i];
    const recorte = DECOR[prop.id];
    if (!recorte) continue;
    const img = imagens.get(recorte.url);
    if (!img) continue;
    let molde = moldes.get(prop.id);
    if (!molde) {
      molde = moldePe(recortar(img, recorte), recorte.escala || 1);
      moldes.set(prop.id, molde);
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

  const lado = texturaParede(img);
  const topo = texturaFaixa(img, SPRITE_PAREDE_CIMA, 1, 4);
  const hParede = ALTURA_PAREDE_HUB * fatorYCasa();
  const y = ALTURA_PRACA + hParede * 0.5;
  const cxSala = planta.origemX + planta.cols * 0.5;
  const czSala = planta.origemY + planta.rows * 0.5;
  const cascas = planta.cascas;
  for (let i = 0; i < cascas.length; i++) {
    const faixa = cascas[i];
    const aoLongoX = faixa.w >= faixa.h;
    sala.add(
      criarFaixaParede({
        x: planta.origemX + faixa.x + faixa.w * 0.5,
        y,
        z: planta.origemY + faixa.y + faixa.h * 0.5,
        w: faixa.w,
        d: faixa.h,
        h: hParede,
        materiais: materiaisDaCasca(lado, topo, aoLongoX, aoLongoX ? faixa.w : faixa.h),
        cxSala,
        czSala,
      }),
    );
  }
}

function materiaisDaCasca(texLado, texTopo, aoLongoX, repetir) {
  const longo = texLado.clone();
  longo.repeat.set(repetir, 1);
  longo.needsUpdate = true;
  const matLongo = material(longo, true);
  const matCurto = material(texLado.clone(), true);
  const matCima = material(texTopo.clone(), true);
  if (aoLongoX) return [matCurto, matCurto, matCima, matLongo, matLongo, matLongo];
  return [matLongo, matLongo, matCima, matCurto, matCurto, matCurto];
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
    carregarMoldesProps(["cura", MESA_CENTRO]),
  ])
    .then(([img, moveis, frente, gente]) => {
      const imagens = new Map();
      if (moveis) imagens.set(FOLHA_MOVEIS, moveis);
      if (frente) imagens.set(FOLHA_FRENTE, frente);
      anexarSala(sala, planta, img);
      anexarBalcao(sala, planta, frente);
      anexarCura3d(sala, planta);
      anexarMesa3d(sala, planta);
      anexarPeca(sala, planta, moveis, "pc", RECORTE_PC);
      anexarDecor(sala, planta, imagens);
      anexarMapa(sala, planta, frente);
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
