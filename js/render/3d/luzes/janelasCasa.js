/** Janelas residenciais: material emissivo + roleta noturna por lote. */

import * as THREE from "three";
import { obterHora } from "../ceu/controleCeu.js";
import { aplicarLuzCidade } from "./mapaChao.js";

const COR_JANELA = 0xb9d7ff;
const NOME_JANELA = "h_mado";
const TAXA_ACESAS = 0.55;
/** Tempo aproximado (s) para ir de apagada a acesa. */
const TEMPO_FADE = 1.5;

let _ultimoMs = 0;

export function ehMaterialJanela(nome) {
  const n = (nome || "").toLowerCase();
  return n.includes("mado") || n === "light1";
}

export function materialDaJanela(mapa) {
  if (mapa) {
    mapa.colorSpace = THREE.SRGBColorSpace;
    mapa.magFilter = THREE.NearestFilter;
    mapa.minFilter = THREE.NearestFilter;
    mapa.generateMipmaps = false;
    mapa.needsUpdate = true;
  }
  const mat = new THREE.MeshLambertMaterial({
    name: NOME_JANELA,
    map: mapa || null,
    color: 0xffffff,
    emissive: COR_JANELA,
    emissiveMap: mapa || null,
    emissiveIntensity: 0,
  });
  aplicarLuzCidade(mat);
  return mat;
}

function hash32(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Intensidade alvo (0 ou 0.75–1) para o dono nesta faixa de ~30 min. */
export function intensidadeJanela(dono, hora = obterHora()) {
  const faixa = Math.floor(hora * 2);
  const h = hash32(`${dono}|${faixa}`);
  const u = h / 0xffffffff;
  if (u >= TAXA_ACESAS) return { faixa, intensidade: 0 };
  const variacao = ((h >>> 16) & 0xffff) / 0xffff;
  return { faixa, intensidade: 0.75 + 0.25 * variacao };
}

export function prepararRoletaJanela(inst, dono) {
  inst.userData.roletaJanela = true;
  inst.userData.donoJanela = dono;
  inst.userData.brilhoJanela = 0;
  inst.userData.alvoJanela = 0;
  inst.userData.faixaJanela = -1;
  inst.userData.materiaisJanela = null;
  const cartoes = inst.userData.cartoesLuz;
  if (cartoes) {
    for (let i = 0; i < cartoes.length; i++) cartoes[i].userData.fatorLuz = 0;
  }
}

function garantirMateriaisPrivados(inst) {
  if (inst.userData.materiaisJanela) return;
  const mats = [];
  const vistos = new Map();
  inst.traverse((filho) => {
    if (!filho.isMesh) return;
    const mat = filho.material;
    if (!mat || (mat.name || "").toLowerCase() !== NOME_JANELA) return;
    let clone = vistos.get(mat);
    if (!clone) {
      clone = mat.clone();
      aplicarLuzCidade(clone);
      vistos.set(mat, clone);
      mats.push(clone);
    }
    filho.material = clone;
  });
  inst.userData.materiaisJanela = mats;
}

function dtQuadro() {
  const agora = performance.now();
  if (!_ultimoMs) {
    _ultimoMs = agora;
    return 1 / 60;
  }
  const dt = Math.min(0.1, (agora - _ultimoMs) / 1000);
  _ultimoMs = agora;
  return dt;
}

function aplicarBrilho(inst, brilho, pesoNoite) {
  if (brilho > 0.01) garantirMateriaisPrivados(inst);
  const mats = inst.userData.materiaisJanela;
  if (mats) {
    const inten = pesoNoite * brilho;
    for (let i = 0; i < mats.length; i++) mats[i].emissiveIntensity = inten;
  }
  const cartoes = inst.userData.cartoesLuz;
  if (cartoes) {
    for (let i = 0; i < cartoes.length; i++) cartoes[i].userData.fatorLuz = brilho;
  }
}

/** Suaviza e aplica o brilho da roleta numa instância de casa. */
export function atualizarRoletaJanela(inst, pesoNoite, dt) {
  if (!inst.userData.roletaJanela) return;
  const hora = obterHora();
  const faixa = Math.floor(hora * 2);
  if (faixa !== inst.userData.faixaJanela) {
    inst.userData.faixaJanela = faixa;
    inst.userData.alvoJanela = intensidadeJanela(inst.userData.donoJanela, hora).intensidade;
  }
  const alvo = inst.userData.alvoJanela;
  let brilho = inst.userData.brilhoJanela;
  const passo = (dt > 0 ? dt : 1 / 60) / TEMPO_FADE;
  if (brilho < alvo) brilho = Math.min(alvo, brilho + passo);
  else if (brilho > alvo) brilho = Math.max(alvo, brilho - passo);
  inst.userData.brilhoJanela = brilho;
  aplicarBrilho(inst, brilho, pesoNoite);
}

export function brilhoDaInstancia(inst) {
  if (inst.userData.roletaJanela) return inst.userData.brilhoJanela || 0;
  return 1;
}

export function comecarQuadroJanelas() {
  return dtQuadro();
}
