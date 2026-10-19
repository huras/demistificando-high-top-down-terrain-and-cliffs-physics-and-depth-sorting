/**
 * Estado esparso das props de campo. O chunk nasce inteiro de novo;
 * só o que foi cortado, queimado ou minerado fica neste mapa.
 */

import { CHUNK_XZ } from "../config.js";
import { MS_FLOR, spriteBerry } from "../mundo/bioma/berriesBioma.js";
import { propPorId, reindexarEm } from "../mundo/bioma/propsBioma.js";
import { avisarDirty } from "../mundo/voxel/storeMundo.js";

export const FASE = Object.freeze({
  EM_PE: "emPe",
  CAINDO: "caindo",
  TOCO: "toco",
  QUEIMANDO: "queimando",
  TOCO_QUEIMADO: "tocoQueimado",
  REMOVIDO: "removido",
});

const FORA_HORIZONTE = new Set([
  FASE.CAINDO,
  FASE.TOCO,
  FASE.TOCO_QUEIMADO,
  FASE.REMOVIDO,
]);

/** @type {Map<string, object>} */
const porId = new Map();
let revisao = 0;

export function revisaoCampo() {
  return revisao;
}

export function lerEstado(id) {
  return porId.get(id) || null;
}

export function foraDoHorizonte(id) {
  const e = porId.get(id);
  return !!(e && FORA_HORIZONTE.has(e.fase));
}

export function cadaEstado(fn) {
  for (const [id, e] of porId) fn(id, e);
}

function hpCheio(prop) {
  if (prop.tipo === "arvore") return 4;
  if (prop.tipo === "pedra" || prop.tipo === "cristal") return hpDeMineral(prop);
  return 1;
}

export function hpDeMineral(prop) {
  const id = prop.sprite || "";
  if (id.includes("large")) return 5;
  if (id.includes("tall")) return 4;
  if (id.includes("small")) return 2;
  return 3;
}

export function raioColisao(prop) {
  if (!prop || prop.fase === FASE.REMOVIDO) return -1;
  if (prop.tipo === "arvore" && (prop.fase === FASE.TOCO || prop.fase === FASE.TOCO_QUEIMADO || prop.fase === FASE.CAINDO)) return 0.18;
  return 0;
}

function foto(prop) {
  return {
    fase: prop.fase,
    hp: prop.hp,
    hpMax: prop.hpMax,
    angulo: prop.angulo || 0,
    lado: prop.lado || 1,
    inicioMs: prop.inicioMs || 0,
    apagaMs: prop.apagaMs || 0,
    voltaMs: prop.voltaMs || 0,
    queimadas: prop.queimadas || 0,
    tipo: prop.tipo || "",
    berryKey: prop.berryKey || "",
    estagio: prop.estagio || "",
    maduraEm: prop.maduraEm || 0,
  };
}

export function aplicarNoProp(prop) {
  const e = porId.get(prop.id);
  if (e?.tipo && prop.tipo && e.tipo !== prop.tipo) {
    porId.delete(prop.id);
  }
  const salvo = porId.get(prop.id);
  if (!salvo) {
    prop.fase = FASE.EM_PE;
    prop.hp = hpCheio(prop);
    prop.hpMax = prop.hp;
    prop.queimadas = 0;
    prop.inicioMs = 0;
    prop.apagaMs = 0;
    prop.voltaMs = 0;
    prop.angulo = 0;
    prop.lado = 1;
    prop.oculto = false;
    prop.r = 0;
    if (prop.tipo === "berry") aplicarBerry(prop, null);
    return;
  }
  prop.fase = salvo.fase;
  prop.hp = salvo.hp;
  prop.hpMax = salvo.hpMax ?? salvo.hp;
  prop.angulo = salvo.angulo || 0;
  prop.lado = salvo.lado || 1;
  prop.inicioMs = salvo.inicioMs || 0;
  prop.apagaMs = salvo.apagaMs || 0;
  prop.voltaMs = salvo.voltaMs || 0;
  prop.queimadas = salvo.queimadas || 0;
  prop.oculto = salvo.fase === FASE.REMOVIDO;
  prop.r = raioColisao(prop);
  if (prop.tipo === "berry") aplicarBerry(prop, salvo);
}

export function aplicarNaLista(lista) {
  if (!lista) return;
  for (let i = 0; i < lista.length; i++) aplicarNoProp(lista[i]);
}

export function preparar(prop) {
  if (!prop.fase) aplicarNoProp(prop);
}

function berryAindaEspera(e, agora) {
  if ((e.estagio || "maduro") === "maduro") return false;
  if (!e.maduraEm || agora < e.maduraEm) return true;
  if (e.estagio === "arbusto") {
    e.estagio = "flor";
    e.maduraEm += MS_FLOR;
    if (agora < e.maduraEm) return true;
  }
  return false;
}

function aplicarBerry(prop, salvo) {
  prop.berryKey = salvo?.berryKey || prop.berryKey || "";
  prop.estagio = salvo?.estagio || "maduro";
  prop.maduraEm = salvo?.maduraEm || 0;
  prop.sprite = spriteBerry(prop.berryKey, prop.estagio);
}

function intacto(prop) {
  if (prop.tipo === "berry" && (prop.estagio || "maduro") !== "maduro") return false;
  return prop.fase === FASE.EM_PE && prop.hp + 1e-4 >= prop.hpMax && !(prop.queimadas > 0);
}

export function confirmar(prop) {
  prop.oculto = prop.fase === FASE.REMOVIDO;
  prop.r = raioColisao(prop);
  if (intacto(prop)) porId.delete(prop.id);
  else porId.set(prop.id, foto(prop));
  encerrarMudancas([prop]);
}

export function mudarEstado(id, patch) {
  const e = porId.get(id);
  if (!e) return null;
  Object.assign(e, patch);
  const p = propPorId(id);
  if (p) aplicarNoProp(p);
  return p;
}

export function apagarEstado(id) {
  if (!porId.delete(id)) return null;
  const p = propPorId(id);
  if (p) aplicarNoProp(p);
  return p;
}

export function encerrarMudancas(props) {
  revisao++;
  const vistos = new Set();
  const lista = props || [];
  for (let i = 0; i < lista.length; i++) {
    const p = lista[i];
    if (!p) continue;
    const k = `${Math.floor(p.x / CHUNK_XZ)},${Math.floor(p.y / CHUNK_XZ)}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    reindexarEm(p.x, p.y);
  }
  avisarDirty();
}

export function listarFase(fase, saida) {
  saida.length = 0;
  for (const [id, e] of porId) {
    if (e.fase !== fase) continue;
    const p = propPorId(id);
    if (p) saida.push(p);
  }
  return saida;
}

export function serializarCampo() {
  const lista = [];
  for (const [id, e] of porId) lista.push({ id, ...e });
  return lista;
}

export function idsRemovidos() {
  const lista = [];
  for (const [id, e] of porId) {
    if (e.fase === FASE.REMOVIDO && e.tipo !== "grama") lista.push(id);
  }
  return lista;
}

export function hidratarCampo(campo, cortados) {
  porId.clear();
  const agora = Date.now();
  const lista = Array.isArray(campo) ? campo : [];
  for (let i = 0; i < lista.length; i++) {
    const e = lista[i];
    if (!e?.id || !e.fase) continue;
    porId.set(e.id, {
      fase: e.fase,
      hp: Number(e.hp) || 0,
      hpMax: Number(e.hpMax) || 0,
      angulo: Number(e.angulo) || 0,
      lado: e.lado === -1 ? -1 : 1,
      inicioMs: Number(e.inicioMs) || 0,
      apagaMs: Number(e.apagaMs) || 0,
      voltaMs: Number(e.voltaMs) || 0,
      queimadas: Number(e.queimadas) || 0,
      tipo: e.tipo || "",
      berryKey: e.berryKey || "",
      estagio: e.estagio || "",
      maduraEm: Number(e.maduraEm) || 0,
    });
  }
  const velhos = Array.isArray(cortados) ? cortados : [];
  for (let i = 0; i < velhos.length; i++) {
    const id = velhos[i];
    if (!id || porId.has(id)) continue;
    porId.set(id, {
      fase: FASE.REMOVIDO,
      hp: 0,
      hpMax: 0,
      angulo: 0,
      lado: 1,
      inicioMs: 0,
      apagaMs: 0,
      voltaMs: 0,
      queimadas: 0,
      tipo: "arvore",
    });
  }
  for (const [id, e] of porId) {
    if (e.tipo === "grama" && e.voltaMs && agora >= e.voltaMs) porId.delete(id);
    if (e.tipo === "berry" && !berryAindaEspera(e, agora)) porId.delete(id);
  }
  revisao++;
}

export function reaplicarCarregados() {
  const tocados = [];
  cadaEstado((id) => {
    const p = propPorId(id);
    if (!p) return;
    aplicarNoProp(p);
    tocados.push(p);
  });
  if (!tocados.length) return;
  encerrarMudancas(tocados);
}
