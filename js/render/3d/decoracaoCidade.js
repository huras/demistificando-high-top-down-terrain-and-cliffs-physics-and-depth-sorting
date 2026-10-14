import * as THREE from "three";
import { ALTURA_BLOCO } from "../../config.js";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { decoracaoDaCidade, decoracaoDasRotas } from "../../mundo/regiao/decoracaoKanto.js";
import { pivoDaImagem } from "../pivoPe.js";
import { aplicarLuzBillboard } from "./ceu/luzBillboard.js";
import { aplicarLuzCidade } from "./luzes/mapaChao.js";

const FOLHA_CORREIO = "/ref/sprites/buildings/Mountains-Trees-and-Public-Decorations-Fan-Game-757531020.png";
const FOLHA_AVISO = "/ref/sprites/buildings/the_public_pokemon_tileset_by_thatssowitty_d4ni56y.png";
const PX_CORREIO = 32;
const PX_AVISO = 16;
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
  grupo.scale.y = 1 / ALTURA_BLOCO;
  return grupo;
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
  const geo = new THREE.PlaneGeometry(largura, altura);
  geo.translate(largura * (0.5 - pivo.x), altura * (pivo.y - 0.5), 0);
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
  return Promise.all([carregarImagem(FOLHA_CORREIO), carregarImagem(FOLHA_AVISO)]).then(([correio, aviso]) => {
    const correios = new Map();
    for (let i = 0; i < CORREIOS.length; i++) {
      const item = CORREIOS[i];
      correios.set(item.cor, folhaDe(recortar(correio, item.col, item.row, 1, 2, PX_CORREIO), PX_CORREIO));
    }
    return {
      correios,
      aviso: folhaDe(recortar(aviso, 2, 364, 2, 2, PX_AVISO), PX_AVISO),
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
  const correios = sprites?.correios;
  const aviso = porSprite(sprites?.aviso, ox + decor.quadro.x, ALTURA_PRACA, oy + decor.quadro.y);
  if (aviso) {
    aviso.name = "quadro-cidade";
    grupo.add(aviso);
  }
  const central = porSprite(correios?.get(decor.correio.cor), ox + decor.correio.x, ALTURA_PRACA, oy + decor.correio.y);
  if (central) grupo.add(central);
  for (let i = 0; i < decor.postes.length; i++) {
    const p = decor.postes[i];
    const inst = porPoste(moldePoste, ox + p.x, ALTURA_PRACA, oy + p.y, acender, `${grupo.name}:praca:${i}`);
    if (inst) grupo.add(inst);
  }
  for (let i = 0; i < decor.casas.length; i++) {
    const casa = decor.casas[i];
    const inst = porSprite(correios?.get(casa.cor), ox + casa.x, ALTURA_PRACA, oy + casa.y);
    if (inst) grupo.add(inst);
  }
  return decor;
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
