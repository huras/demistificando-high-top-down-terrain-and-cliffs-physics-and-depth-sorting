import * as THREE from "three";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { aplicarEscalaCartao, fatorYCasa } from "./escalaVertical.js";
import { decoracaoDaCidade, decoracaoDasRotas } from "../../mundo/regiao/decoracaoKanto.js";
import {
  FOLHA_INTERIOR,
  PECAS_INTERIOR,
  PX_MOVEL,
  moveisDaSala,
} from "../../mundo/cidade/interiorCasa.js";
import { medidasSala } from "../../mundo/cidade/sala3d.js";
import { geometriaNoPe } from "./billboard/indice.js";
import { pivoDaImagem } from "../pivoPe.js";
import { aplicarLuzBillboard } from "./ceu/luzBillboard.js";
import { facesParedeInterior } from "./cartaoPe.js";
import { criarFaixaParede } from "./paredeInteriorDual.js";
import { aplicarLuzCidade } from "./luzes/mapaChao.js";
import { propDoSprite } from "../../mundo/cidade/catalogoProps.js";
import {
  anexarCorreiosInstanced,
  carregarMoldesProps,
  instanciarCama,
  instanciarProp,
} from "./propsObj3d.js";

const FOLHA_CORREIO = "/ref/sprites/buildings/Mountains-Trees-and-Public-Decorations-Fan-Game-757531020.png";
const FOLHA_AVISO = "/ref/sprites/buildings/the_public_pokemon_tileset_by_thatssowitty_d4ni56y.png";
const PX_CORREIO = 32;
const PX_AVISO = 16;
const PISO_COL = 4;
const PISO_ROW = 144;
const CORREIOS = Object.freeze([
  Object.freeze({ cor: "#c23b3b", col: 5, row: 296 }),
  Object.freeze({ cor: "#2f6fbf", col: 7, row: 299 }),
  Object.freeze({ cor: "#3d8c4a", col: 5, row: 299 }),
  Object.freeze({ cor: "#e2b33a", col: 6, row: 299 }),
  Object.freeze({ cor: "#2e2e2e", col: 4, row: 296 }),
  Object.freeze({ cor: "#e07a2f", col: 4, row: 299 }),
  Object.freeze({ cor: "#d46aa6", col: 4, row: 301 }),
  Object.freeze({ cor: "#7a4ea3", col: 4, row: 303 }),
]);

const COR_MADEIRA = "#8a5a32";
const COR_MADEIRA_ESCURA = "#5c3a22";
const moldesPlaca = new Map();
const materiais = new Map();

function material(cor, mapa) {
  if (!mapa) {
    const pronto = materiais.get(cor);
    if (pronto) return pronto;
  }
  const mat = new THREE.MeshLambertMaterial({
    color: mapa ? 0xffffff : cor,
    map: mapa || null,
  });
  if (mapa) {
    mapa.colorSpace = THREE.SRGBColorSpace;
    mapa.magFilter = THREE.LinearFilter;
    mapa.minFilter = THREE.LinearMipmapLinearFilter;
    mapa.generateMipmaps = true;
    mapa.needsUpdate = true;
  }
  aplicarLuzCidade(mat);
  if (!mapa) materiais.set(cor, mat);
  return mat;
}

function caixa(largura, altura, fundo, x, y, z, cor) {
  const geo = new THREE.BoxGeometry(largura, altura, fundo);
  geo.translate(x, y + altura * 0.5, z);
  const mesh = new THREE.Mesh(geo, material(cor));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function texto(linhas, largura, altura, fundo, tinta) {
  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const ctx = tela.getContext("2d");
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, largura, altura);
  ctx.strokeStyle = "#6b3e22";
  ctx.lineWidth = 18;
  ctx.strokeRect(10, 10, largura - 20, altura - 20);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const total = linhas.reduce((soma, linha) => soma + linha.px, 0) + (linhas.length - 1) * 16;
  let y = (altura - total) * 0.5;
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    y += linha.px * 0.5;
    ctx.font = `${linha.peso || 700} ${linha.px}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = linha.cor || tinta;
    ctx.fillText(linha.texto, largura * 0.5, y);
    y += linha.px * 0.5 + 16;
  }
  const tex = new THREE.CanvasTexture(tela);
  return material("#ffffff", tex);
}

function emPe(grupo) {
  return aplicarEscalaCartao(grupo);
}

function carregarImagem(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

function recortar(img, col, row, cols, rows, tile) {
  const tela = document.createElement("canvas");
  tela.width = cols * tile;
  tela.height = rows * tile;
  const ctx = tela.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, col * tile, row * tile, tela.width, tela.height, 0, 0, tela.width, tela.height);
  return tela;
}

function texturaRepetida(tela) {
  const tex = new THREE.CanvasTexture(tela);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function folhaDe(tela, pxPorUnidade) {
  const tex = new THREE.CanvasTexture(tela);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  const mat = new THREE.MeshLambertMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.12,
    side: THREE.FrontSide,
    depthWrite: true,
  });
  aplicarLuzCidade(mat);
  aplicarLuzBillboard(mat);
  const pivo = pivoDaImagem(tela);
  const largura = tela.width / pxPorUnidade;
  const altura = tela.height / pxPorUnidade;
  const geo = geometriaNoPe(pivo.x, pivo.y, largura, altura);
  return { geo, material: mat };
}

function cartao(folha) {
  const mesh = new THREE.Mesh(folha.geo, folha.material);
  mesh.rotation.order = "YXZ";
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  const raiz = new THREE.Group();
  raiz.add(mesh);
  raiz.userData.cartao = mesh;
  return raiz;
}

export function carregarSpritesPraca() {
  return Promise.all([
    carregarImagem(FOLHA_CORREIO),
    carregarImagem(FOLHA_AVISO),
    carregarImagem(FOLHA_INTERIOR).catch(() => null),
  ]).then(([correio, aviso, interior]) => {
    const correios = new Map();
    for (let i = 0; i < CORREIOS.length; i++) {
      const item = CORREIOS[i];
      correios.set(item.cor, folhaDe(recortar(correio, item.col, item.row, 1, 2, PX_CORREIO), PX_CORREIO));
    }
    const moveis = new Map();
    if (interior) {
      for (let i = 0; i < PECAS_INTERIOR.length; i++) {
        const peca = PECAS_INTERIOR[i];
        moveis.set(
          peca.id,
          folhaDe(recortar(interior, peca.col, peca.row, peca.cols, peca.rows, 16), PX_MOVEL),
        );
      }
    }
    return {
      correios,
      aviso: folhaDe(recortar(aviso, 2, 364, 2, 2, PX_AVISO), PX_AVISO),
      moveis,
      piso: texturaRepetida(recortar(correio, PISO_COL, PISO_ROW, 1, 1, PX_CORREIO)),
    };
  });
}

function moldePlaca(nome) {
  const pronto = moldesPlaca.get(nome);
  if (pronto) return pronto;
  const grupo = emPe(new THREE.Group());
  grupo.name = "placa-cidade";
  grupo.add(caixa(0.08, 1.45, 0.08, 0, 0, 0, COR_MADEIRA_ESCURA));
  const painel = new THREE.Mesh(
    new THREE.BoxGeometry(1.28, 0.58, 0.06),
    texto(
      [{ texto: nome, px: 72 }],
      512,
      220,
      "#f6e7c1",
      "#2a1c10",
    ),
  );
  painel.position.set(0, 1.15, 0.02);
  painel.castShadow = true;
  painel.receiveShadow = true;
  grupo.add(painel);
  grupo.userData.tipo = "placa";
  moldesPlaca.set(nome, grupo);
  return grupo;
}

function porNoChao(grupo, x, h, z, yaw) {
  grupo.position.set(x, h, z);
  if (yaw) grupo.rotation.y = yaw;
  return grupo;
}

function porSprite(folha, x, h, z) {
  if (!folha) return null;
  const inst = cartao(folha);
  inst.position.set(x, h, z);
  return inst;
}

function porPoste(molde, x, h, z, acender, dono) {
  if (!molde) return null;
  const inst = molde.grupo.clone(true);
  inst.position.set(x, h, z);
  if (acender) acender(inst, dono);
  return inst;
}

export function anexarDecoracaoCidade(grupo, moldePoste, layout, ox, oy, acender, sprites) {
  const decor = decoracaoDaCidade(layout);
  const aviso = porSprite(sprites?.aviso, ox + decor.quadro.x, ALTURA_PRACA, oy + decor.quadro.y);
  if (aviso) {
    aviso.name = "quadro-cidade";
    grupo.add(aviso);
  }
  for (let i = 0; i < decor.postes.length; i++) {
    const p = decor.postes[i];
    const inst = porPoste(moldePoste, ox + p.x, ALTURA_PRACA, oy + p.y, acender, `${grupo.name}:praca:${i}`);
    if (inst) grupo.add(inst);
  }
  const pontosCorreio = [
    { x: ox + decor.correio.x, y: oy + decor.correio.y, cor: decor.correio.cor },
  ];
  for (let i = 0; i < decor.casas.length; i++) {
    const casa = decor.casas[i];
    pontosCorreio.push({ x: ox + casa.x, y: oy + casa.y, cor: casa.cor });
  }
  carregarMoldesProps(["correio"])
    .then(() => {
      anexarCorreiosInstanced(grupo, pontosCorreio);
    })
    .catch((erro) => {
      console.error("correios 3d", erro);
      const folha = sprites?.correios;
      if (!folha?.size) return;
      for (let i = 0; i < pontosCorreio.length; i++) {
        const p = pontosCorreio[i];
        const inst = porSprite(folha.get(p.cor), p.x, ALTURA_PRACA, p.y);
        if (inst) grupo.add(inst);
      }
    });
  return decor;
}

function materialSala(cor, mapa) {
  const mat = new THREE.MeshLambertMaterial({
    color: mapa ? 0xffffff : cor,
    map: mapa || null,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  aplicarLuzCidade(mat);
  return mat;
}

/** Piso de azulejo e paredes por cima do voxel, pra não aparecer o mato. */
export function anexarCascaSala(grupo, piso) {
  const m = medidasSala();
  const chaoW = m.chaoX1 - m.chaoX0;
  const chaoD = m.chaoY1 - m.chaoY0;
  if (piso) {
    piso.repeat.set(chaoW, chaoD);
    piso.needsUpdate = true;
    const geo = new THREE.PlaneGeometry(chaoW, chaoD);
    const mesh = new THREE.Mesh(geo, materialSala("#ffffff", piso));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((m.chaoX0 + m.chaoX1) * 0.5, ALTURA_PRACA + 0.08, (m.chaoY0 + m.chaoY1) * 0.5);
    mesh.name = "piso-sala";
    grupo.add(mesh);
  }
  const parede = facesParedeInterior(materialSala("#f3e7cf"));
  const h = (m.alturaParede + 0.2) * fatorYCasa();
  const y = ALTURA_PRACA + h * 0.5;
  const meioX = (m.x0 + m.x1) * 0.5;
  const meioY = (m.y0 + m.y1) * 0.5;
  const largura = m.x1 - m.x0;
  const fundo = m.y1 - m.y0;
  const faixa = (w, d, x, z) =>
    criarFaixaParede({ x, y, z, w, d, h, materiais: parede });
  grupo.add(faixa(largura, 1.05, meioX, m.y0 + 0.5));
  grupo.add(faixa(1.05, fundo, m.x0 + 0.5, meioY));
  grupo.add(faixa(1.05, fundo, m.x1 - 0.5, meioY));
  const esq = m.portaX0 - m.x0;
  const dir = m.x1 - m.portaX1;
  if (esq > 0.2) {
    grupo.add(faixa(esq, 1.05, m.x0 + esq * 0.5, m.portaY + 0.5));
  }
  if (dir > 0.2) {
    grupo.add(faixa(dir, 1.05, m.portaX1 + dir * 0.5, m.portaY + 0.5));
  }
}

const VASOS_CASA = Object.freeze(["flores-1", "vaso-1", "flores-3", "vaso-2"]);

function ehCama(id) {
  return id === "cama-azul" || id === "cama-vermelha" || id === "cama-verde";
}

export function anexarInteriores(grupo, moveis) {
  const lista = moveisDaSala();
  let vasoI = 0;
  const idsProps = ["cama", "mesa-1"];
  const idsVaso = [];
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].id === "vaso") {
      const id = VASOS_CASA[vasoI++ % VASOS_CASA.length];
      idsVaso.push(id);
      idsProps.push(id);
    }
  }
  const colocar = () => {
    vasoI = 0;
    for (let i = 0; i < lista.length; i++) {
      const item = lista[i];
      if (item.id === "vaso") {
        const id = idsVaso[vasoI++] || "vaso-1";
        const prop = instanciarProp(id, item.x, item.y);
        if (prop) {
          prop.name = `movel-${item.id}`;
          grupo.add(prop);
          continue;
        }
      }
      if (ehCama(item.id)) {
        const prop = instanciarCama(item.id, item.x, item.y);
        if (prop) {
          prop.name = `movel-${item.id}`;
          grupo.add(prop);
          continue;
        }
      }
      if (item.id === "mesa") {
        const prop = instanciarProp(propDoSprite("mesa") || "mesa-1", item.x, item.y);
        if (prop) {
          prop.name = `movel-${item.id}`;
          grupo.add(prop);
          continue;
        }
      }
      if (!moveis?.size) continue;
      const inst = porSprite(moveis.get(item.id), item.x, ALTURA_PRACA, item.y);
      if (!inst) continue;
      inst.name = `movel-${item.id}`;
      grupo.add(inst);
    }
  };
  carregarMoldesProps(idsProps).then(colocar).catch((erro) => {
    console.error("moveis 3d da casa", erro);
    colocar();
  });
}

export function criarDecoracaoRotas(moldePoste, acender) {
  const dados = decoracaoDasRotas();
  const grupos = [];
  for (let i = 0; i < dados.length; i++) {
    const dadosGrupo = dados[i];
    const grupo = new THREE.Group();
    grupo.name = `rota-${dadosGrupo.ax}-${dadosGrupo.ay}`;
    for (let p = 0; p < dadosGrupo.placas.length; p++) {
      const placa = dadosGrupo.placas[p];
      const inst = moldePlaca(placa.nome).clone(true);
      porNoChao(inst, placa.x, placa.h, placa.y, placa.yaw);
      grupo.add(inst);
    }
    if (moldePoste) {
      for (let p = 0; p < dadosGrupo.postes.length; p++) {
        const poste = dadosGrupo.postes[p];
        const inst = porPoste(moldePoste, poste.x, poste.h, poste.y, acender, `${grupo.name}:poste:${p}`);
        if (inst) grupo.add(inst);
      }
    }
    grupos.push({
      grupo,
      cx: dadosGrupo.cx,
      cy: dadosGrupo.cy,
    });
  }
  return grupos;
}
