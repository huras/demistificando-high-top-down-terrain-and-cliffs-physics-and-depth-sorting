/**
 * Chão Emerald, muros e balcão de um hub. Os sprites sobem no cartão do pé.
 */
import * as THREE from "three";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { aplicarLuzCidade } from "./luzes/mapaChao.js";
import { ALTURA_PAREDE_HUB } from "../../mundo/cidade/plantaHub.js";
import {
  imagem,
  recortar,
  moldePe,
  porBillboard,
  quadroGente,
  criarBolasCura,
  facesParedeInterior,
} from "./cartaoPe.js";
import { fatorYCasa, fatorYProp } from "./escalaVertical.js";
import { criarFaixaParede } from "./paredeInteriorDual.js";
import { carregarSlotsCura } from "../../jogo/slotsCuraConfig.js";

const FOLHA_MOVEIS = "/ref/sprites/interiors/dcj0huc-7206dd1d-9450-4232-a708-b07b4bd0c392.png";
const FOLHA_GENTE =
  "/ref/sprites/people/logic 2/DS _ DSi - Pokemon Platinum - Non-Playable Characters - NPCs.png";
const COLUNAS_TILE = 32;
const TILE = 16;

const RECORTE = Object.freeze({
  cura: Object.freeze({ url: FOLHA_MOVEIS, col: 6, row: 43, cols: 2, rows: 3, tile: 16 }),
  pc: Object.freeze({ url: "/ref/sprites/interiors/lab/lab-computer-blank.png" }),
});

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

function bloco(largura, altura, fundo, x, y, z, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(largura, altura, fundo), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

function anexarCaixas(grupo, planta) {
  const parede = facesParedeInterior(materialCaixa(planta.corParede));
  const balcao = materialCaixa(planta.corBalcao);
  const h = ALTURA_PAREDE_HUB * fatorYCasa();
  const y = ALTURA_PRACA + h * 0.5;
  const cxSala = planta.origemX + planta.cols * 0.5;
  const czSala = planta.origemY + planta.rows * 0.5;
  for (let i = 0; i < planta.cascas.length; i++) {
    const r = planta.cascas[i];
    grupo.add(
      criarFaixaParede({
        x: planta.origemX + r.x + r.w * 0.5,
        y,
        z: planta.origemY + r.y + r.h * 0.5,
        w: r.w,
        d: r.h,
        h,
        materiais: parede,
        cxSala,
        czSala,
      }),
    );
  }
  const hb = 1.15 * fatorYProp();
  for (let i = 0; i < planta.balcoes.length; i++) {
    const r = planta.balcoes[i];
    grupo.add(
      bloco(
        r.w,
        hb,
        r.h,
        planta.origemX + r.x + r.w * 0.5,
        ALTURA_PRACA + hb * 0.5,
        planta.origemY + r.y + r.h * 0.5,
        balcao,
      ),
    );
  }
}

function texturaChao(img, camada) {
  const linhas = camada.length;
  const cols = camada[0].length;
  const tela = document.createElement("canvas");
  tela.width = cols * TILE;
  tela.height = linhas * TILE;
  const ctx = tela.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  for (let row = 0; row < linhas; row++) {
    const linha = camada[row];
    for (let col = 0; col < cols; col++) {
      const id = linha[col] | 0;
      const sx = (id % COLUNAS_TILE) * TILE;
      const sy = Math.floor(id / COLUNAS_TILE) * TILE;
      ctx.drawImage(img, sx, sy, TILE, TILE, col * TILE, row * TILE, TILE, TILE);
    }
  }
  const tex = new THREE.CanvasTexture(tela);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function anexarChao(grupo, planta, tex) {
  const cols = planta.cols;
  const rows = planta.rows;
  const pecas = planta.pisos?.length
    ? planta.pisos
    : [{ x: 0, y: 0, w: cols, h: rows }];
  for (let i = 0; i < pecas.length; i++) {
    const r = pecas[i];
    const map = tex.clone();
    map.offset.set(r.x / cols, 1 - (r.y + r.h) / rows);
    map.repeat.set(r.w / cols, r.h / rows);
    map.needsUpdate = true;
    const mat = new THREE.MeshLambertMaterial({
      map,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    aplicarLuzCidade(mat);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(
      planta.origemX + r.x + r.w * 0.5,
      ALTURA_PRACA + 0.08,
      planta.origemY + r.y + r.h * 0.5,
    );
    mesh.receiveShadow = true;
    grupo.add(mesh);
  }
}

function recorteArea(img, camada, area) {
  const tela = document.createElement("canvas");
  tela.width = area.tw * TILE;
  tela.height = area.th * TILE;
  const ctx = tela.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  for (let row = 0; row < area.th; row++) {
    for (let col = 0; col < area.tw; col++) {
      const id = camada[area.ty + row][area.tx + col] | 0;
      const sx = (id % COLUNAS_TILE) * TILE;
      const sy = Math.floor(id / COLUNAS_TILE) * TILE;
      ctx.drawImage(img, sx, sy, TILE, TILE, col * TILE, row * TILE, TILE, TILE);
    }
  }
  return tela;
}

export function montarHub3d(grupo, planta, bolas) {
  const sala = new THREE.Group();
  sala.name = planta.papel;
  grupo.add(sala);
  anexarCaixas(sala, planta);

  const urlBg =
    planta.papel === "loja"
      ? "/ref/sprites/interiors/pokemart-emerald-bg.png"
      : "/ref/sprites/interiors/pokecenter-emerald-bg.png";
  const urlFg =
    planta.papel === "loja"
      ? "/ref/sprites/interiors/pokemart-emerald-fg.png"
      : "/ref/sprites/interiors/pokecenter-emerald-fg.png";

  return Promise.all([
    imagem(urlBg).catch(() => null),
    imagem(urlFg).catch(() => null),
    imagem(FOLHA_GENTE).catch(() => null),
    imagem(RECORTE.cura.url).catch(() => null),
    imagem(RECORTE.pc.url).catch(() => null),
    carregarSlotsCura(),
  ]).then((imagens) => {
    const [bg, fg, gente, curaImg, pcImg] = imagens;
    if (bg) anexarChao(sala, planta, texturaChao(bg, planta.camada));
    const moldeNpc = new Map();
    let moldeCura = null;
    let moldePc = null;
    if (curaImg) moldeCura = moldePe(recortar(curaImg, RECORTE.cura));
    if (pcImg) moldePc = moldePe(pcImg);
    for (let i = 0; i < planta.props.length; i++) {
      const prop = planta.props[i];
      const x = planta.origemX + prop.x;
      const z = planta.origemY + prop.y;
      if (prop.id === "npc" && gente) {
        if (!moldeNpc.has(prop.coluna)) moldeNpc.set(prop.coluna, moldePe(quadroGente(gente, prop.coluna)));
        const inst = porBillboard(moldeNpc.get(prop.coluna), x, z);
        if (inst) inst.name = `npc-${prop.nome || i}`;
        if (inst) sala.add(inst);
      } else if (prop.id === "cura" && moldeCura) {
        const inst = porBillboard(moldeCura, x, z);
        if (!inst) continue;
        sala.add(inst);
        if (inst.userData.cartao && bolas) {
          const novas = criarBolasCura(inst.userData.cartao);
          for (let b = 0; b < novas.length; b++) bolas.push(novas[b]);
        }
      } else if (prop.id === "pc" && moldePc) {
        const inst = porBillboard(moldePc, x, z);
        if (inst) sala.add(inst);
      } else if (prop.id === "prateleira" && fg && prop.area) {
        const inst = porBillboard(moldePe(recorteArea(fg, planta.camada, prop.area)), x, z);
        if (inst) sala.add(inst);
      }
    }
  });
}
