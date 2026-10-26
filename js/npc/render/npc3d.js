/**
 * Billboards 3D para NPCs overworld / indoor dinâmicos.
 */
import * as THREE from "three";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import {
  moldePe,
  porBillboard,
  quadroGente,
  soltarCartao,
} from "../../render/3d/cartaoPe.js";
import { FOLHA_PLATINUM } from "../catalogo/carregar.js";
import { linhaFacing } from "../cidade/idleFace.js";

/** @type {THREE.Group|null} */
let raiz = null;
/** @type {HTMLImageElement|null} */
let folha = null;
let folhaPronta = false;
/** @type {Map<number, object>} */
const moldes = new Map();
/** @type {Map<string, object>} */
const inst = new Map();

function carregarFolha() {
  if (folha) return;
  folha = new Image();
  folha.decoding = "async";
  folha.onload = () => {
    folhaPronta = true;
  };
  folha.onerror = () => {
    console.warn("NPC: falha ao carregar folha Platinum");
  };
  folha.src = FOLHA_PLATINUM;
}

function moldeDaColuna(coluna) {
  if (!folhaPronta || !folha) return null;
  let m = moldes.get(coluna);
  if (m) return m;
  m = moldePe(quadroGente(folha, coluna));
  moldes.set(coluna, m);
  return m;
}

/** Recorta frame (coluna, linha facing, frame walk). */
function pintarFrame(coluna, linha, frame) {
  if (!folhaPronta || !folha) return null;
  const faixa = 17;
  const lado = 32;
  const quadros = 9;
  const col = coluna % faixa;
  const banda = Math.floor(coluna / faixa);
  const base = linha === 0 ? 0 : linha === 1 ? 3 : 6;
  const fr = base + (frame % 3);
  const tela = document.createElement("canvas");
  tela.width = lado;
  tela.height = lado;
  const ctx = tela.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  if (linha === 3) {
    ctx.translate(lado, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(
    folha,
    col * lado,
    (banda * quadros + fr) * lado,
    lado,
    lado,
    0,
    0,
    lado,
    lado,
  );
  return tela;
}

export function ligarNpc3d(cena) {
  if (raiz) return raiz;
  carregarFolha();
  raiz = new THREE.Group();
  raiz.name = "npcs-overworld";
  cena.add(raiz);
  return raiz;
}

export function limparNpc3d() {
  if (!raiz) return;
  for (const [, v] of inst) {
    soltarCartao(v.cartao);
    raiz.remove(v.grupo);
    v.tex?.dispose?.();
    v.mat?.dispose?.();
  }
  inst.clear();
}

/**
 * @param {object[]} npcs
 * @param {number} yawCam
 * @param {number} inclinacao
 */
export function sincronizarNpc3d(npcs, yawCam = 0, inclinacao = 0) {
  if (!raiz) return;
  const vivos = new Set();
  for (let i = 0; i < npcs.length; i++) {
    const npc = npcs[i];
    if (!npc?.visivel) continue;
    vivos.add(npc.id);
    let entry = inst.get(npc.id);
    if (!entry) {
      const molde = moldeDaColuna(npc.coluna | 0);
      if (!molde) continue;
      const grupo = porBillboard(molde, npc.x, npc.y, { noCartoes: true });
      if (!grupo) continue;
      grupo.name = `npc:${npc.id}`;
      raiz.add(grupo);
      const cartao = grupo.userData.cartao;
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      const mat = cartao.material.clone();
      mat.map = tex;
      mat.needsUpdate = true;
      cartao.material = mat;
      entry = {
        grupo,
        cartao,
        tex,
        mat,
        canvas,
        ctx: canvas.getContext("2d"),
        frameKey: "",
      };
      inst.set(npc.id, entry);
    }
    const z = Number.isFinite(npc.z) ? npc.z : ALTURA_PRACA;
    entry.grupo.position.set(npc.x, z, npc.y);
    entry.cartao.rotation.x = inclinacao;
    entry.cartao.rotation.y = yawCam;
    entry.grupo.visible = true;

    if (entry.ctx && folhaPronta) {
      const linha = linhaFacing(npc.facing);
      const frame = npc.andando ? npc.frame | 0 : 0;
      const key = `${npc.coluna}|${linha}|${frame}`;
      if (key !== entry.frameKey) {
        entry.frameKey = key;
        const tela = pintarFrame(npc.coluna | 0, linha, frame);
        if (tela) {
          entry.ctx.clearRect(0, 0, 32, 32);
          entry.ctx.drawImage(tela, 0, 0);
          entry.tex.needsUpdate = true;
        }
      }
    }
  }
  for (const [id, entry] of inst) {
    if (vivos.has(id)) continue;
    soltarCartao(entry.cartao);
    raiz.remove(entry.grupo);
    entry.tex?.dispose?.();
    entry.mat?.dispose?.();
    inst.delete(id);
  }
}
