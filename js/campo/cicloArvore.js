/**
 * Árvore em pé, queda, toco e toco queimado. Madeira no toco, carvão no toco queimado.
 */

import { propPorId } from "../mundo/bioma/propsBioma.js";
import { ajustarItem } from "../pokemon/party.js";
import { sfx } from "../jogo/audio.js";
import { acenderGramaEm } from "./grama.js";
import { emitirFagulha } from "./fx.js";
import {
  FASE,
  cadaEstado,
  confirmar,
  encerrarMudancas,
  mudarEstado,
  preparar,
} from "./estadoProps.js";

export const QUEDA_MS = 720;
export const QUEIMA_MS = 10000;
export const ACERTOS_FOGO = 5;
const HP_TOCO = 2;
const HP_TOCO_QUEIMADO = 4;

let acumBrasa = 0;

function ladoDe(id) {
  let h = 0;
  const s = id || "";
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0;
  return h & 1 ? 1 : -1;
}

function derrubar(prop) {
  prop.fase = FASE.CAINDO;
  prop.hp = 0;
  prop.inicioMs = Date.now();
  prop.lado = ladoDe(prop.id);
  prop.angulo = prop.lado;
  confirmar(prop);
}

export function acenderArvore(prop) {
  preparar(prop);
  if (prop.fase === FASE.QUEIMANDO || prop.fase === FASE.TOCO_QUEIMADO) return false;
  if (prop.fase !== FASE.EM_PE && prop.fase !== FASE.TOCO) return false;
  prop.fase = FASE.QUEIMANDO;
  prop.inicioMs = Date.now();
  prop.queimadas = ACERTOS_FOGO;
  confirmar(prop);
  emitirFagulha(prop.x, prop.y, true, 16, true);
  acenderGramaEm(prop.x, prop.y, prop.inicioMs, null);
  sfx("cavar");
  return true;
}

/**
 * @returns {"nao"|"espera"|"acertou"|"queda"|"madeira"|"carvao"}
 */
export function cortarArvore(prop) {
  if (!prop || prop.tipo !== "arvore") return "nao";
  preparar(prop);
  if (prop.fase === FASE.CAINDO || prop.fase === FASE.QUEIMANDO) return "espera";
  if (prop.fase === FASE.REMOVIDO || prop.oculto) return "nao";
  if (prop.fase === FASE.TOCO || prop.fase === FASE.TOCO_QUEIMADO) {
    const carvao = prop.fase === FASE.TOCO_QUEIMADO;
    prop.hp -= 1;
    ajustarItem(carvao ? "coal" : "wood", 1);
    sfx("cavar");
    if (prop.hp <= 0) {
      prop.fase = FASE.REMOVIDO;
      prop.hp = 0;
      confirmar(prop);
      return carvao ? "carvao" : "madeira";
    }
    confirmar(prop);
    return carvao ? "carvao" : "madeira";
  }
  if (prop.fase !== FASE.EM_PE) return "nao";
  prop.hp -= 1;
  sfx("cavar");
  if (prop.hp <= 0) {
    derrubar(prop);
    return "queda";
  }
  confirmar(prop);
  return "acertou";
}

/**
 * @returns {"nao"|"espera"|"fogo"|"acertou"}
 */
export function queimarArvore(prop) {
  if (!prop || prop.tipo !== "arvore") return "nao";
  preparar(prop);
  if (prop.fase === FASE.QUEIMANDO || prop.fase === FASE.CAINDO) return "espera";
  if (prop.fase === FASE.TOCO_QUEIMADO || prop.fase === FASE.REMOVIDO) return "nao";
  if (prop.fase === FASE.TOCO) {
    acenderArvore(prop);
    return "fogo";
  }
  if (prop.fase !== FASE.EM_PE) return "nao";
  prop.queimadas = (prop.queimadas || 0) + 1;
  emitirFagulha(prop.x, prop.y, true, 4, false);
  if (prop.queimadas >= ACERTOS_FOGO) {
    acenderArvore(prop);
    return "fogo";
  }
  sfx("cavar");
  confirmar(prop);
  return "acertou";
}

export function tickArvores(dt, agora) {
  const tocados = [];
  let mudou = false;
  cadaEstado((id, e) => {
    if (e.tipo && e.tipo !== "arvore") return;
    if (e.fase === FASE.CAINDO && agora - (e.inicioMs || 0) >= QUEDA_MS) {
      const p = mudarEstado(id, { fase: FASE.TOCO, hp: HP_TOCO, hpMax: HP_TOCO, queimadas: 0 });
      if (p) tocados.push(p);
      mudou = true;
      return;
    }
    if (e.fase === FASE.QUEIMANDO && agora - (e.inicioMs || 0) >= QUEIMA_MS) {
      const p = mudarEstado(id, {
        fase: FASE.TOCO_QUEIMADO,
        hp: HP_TOCO_QUEIMADO,
        hpMax: HP_TOCO_QUEIMADO,
        queimadas: 0,
      });
      if (p) tocados.push(p);
      mudou = true;
    }
  });
  if (mudou) encerrarMudancas(tocados);

  acumBrasa += dt > 0 ? dt : 0;
  if (acumBrasa < 1 / 22) return;
  acumBrasa = 0;
  cadaEstado((id, e) => {
    if (e.fase !== FASE.QUEIMANDO) return;
    if (e.tipo && e.tipo !== "arvore") return;
    const p = propPorId(id);
    if (p) emitirFagulha(p.x, p.y, true, 1, false);
  });
}
