/** Picareta quebra o bloco sob o clique. O bloco selecionado coloca no clique esquerdo. */

import { alturaSobPes } from "../fisica/colisao.js";
import { colocarBloco, definirBlocoNaMao, quebrarBloco } from "../mundo/voxel/editar.js";
import { obterBloco } from "../mundo/voxel/storeMundo.js";
import { BLOCO, ehLiquido, ehSolido } from "../mundo/voxel/tiposBloco.js";
import { BLOCOS, SLOTS_HOTBAR, TIPO_ITEM } from "../wild/catalogo.js";
import { atribuirSlot, contar, darItem, estado, gastar, hotbarAtivo } from "./estado.js";

const CHAVE = Object.freeze({
  [BLOCO.GRAMA]: "blocoGrama",
  [BLOCO.TERRA]: "blocoTerra",
  [BLOCO.PEDRA]: "blocoPedra",
});

const drops = [];
let seq = 1;

export function picaretaNaMao() {
  const item = hotbarAtivo();
  return !!(item && item.tipo === TIPO_ITEM.FERRAMENTA && item.key === "pickaxe" && contar(item.tipo, item.key) > 0);
}

export function idBlocoNaMao() {
  const item = hotbarAtivo();
  if (!item || item.tipo !== TIPO_ITEM.BLOCO) return 0;
  if (contar(item.tipo, item.key) <= 0) return 0;
  return BLOCOS[item.key]?.bloco | 0;
}

export function dropsBloco() {
  return drops;
}

function soltar(x, y, z, id) {
  const chave = CHAVE[id];
  if (!chave) return;
  const jx = (Math.random() - 0.5) * 0.35;
  const jy = (Math.random() - 0.5) * 0.35;
  const px = x + 0.5 + jx;
  const py = y + 0.5 + jy;
  drops.push({
    id: seq++,
    chave,
    cor: BLOCOS[chave].cor,
    x: px,
    y: py,
    z: alturaSobPes(px, py, z + 1.2) || z,
    vz: 2.4,
    idade: 0,
  });
}

function jaTemNaHotbar(chave) {
  for (let i = 0; i < SLOTS_HOTBAR; i++) {
    const slot = estado.hotbar[i];
    if (slot && slot.tipo === TIPO_ITEM.BLOCO && slot.key === chave) return true;
  }
  return false;
}

function equiparBlocoColetado(chave) {
  if (jaTemNaHotbar(chave)) return;
  for (let i = 0; i < SLOTS_HOTBAR; i++) {
    if (estado.hotbar[i]) continue;
    atribuirSlot(i, TIPO_ITEM.BLOCO, chave);
    const nome = BLOCOS[chave]?.nome || "bloco";
    estado.itemGet = `${nome} equipado na hotbar.`;
    return;
  }
}

export function tentarQuebrar(corpo, alvo) {
  if (!picaretaNaMao() || !alvo) return false;
  const id = obterBloco(alvo.x, alvo.y, alvo.z);
  if (!ehSolido(id) || ehLiquido(id) || !CHAVE[id]) return false;
  if (!quebrarBloco(corpo, alvo)) return false;
  soltar(alvo.x, alvo.y, alvo.z, id);
  return true;
}

export function tentarColocar(corpo, alvo) {
  const id = idBlocoNaMao();
  const item = hotbarAtivo();
  if (!id || !item) return false;
  definirBlocoNaMao(id);
  if (!colocarBloco(corpo, alvo)) return false;
  gastar(item.tipo, item.key, 1);
  return true;
}

export function tickBlocos(corpo, dt) {
  if (!corpo || dt <= 0) return;
  const raio = 1.15 * 1.15;
  for (let i = drops.length - 1; i >= 0; i--) {
    const item = drops[i];
    item.idade += dt;
    item.z += item.vz * dt;
    item.vz -= 12 * dt;
    const chao = alturaSobPes(item.x, item.y, item.z + 1);
    if (item.z <= chao) {
      item.z = chao;
      item.vz = 0;
    }
    if (item.idade > 90) {
      drops.splice(i, 1);
      continue;
    }
    const dx = corpo.x - item.x;
    const dy = corpo.y - item.y;
    if (dx * dx + dy * dy <= raio) {
      darItem(TIPO_ITEM.BLOCO, item.chave, 1);
      equiparBlocoColetado(item.chave);
      drops.splice(i, 1);
    }
  }
}
