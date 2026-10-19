/** Textos de item e da carta. Ordem: idioma atual, pt-BR, a própria chave. */

import ptBR from "./locales/pt-BR.js";
import en from "./locales/en.js";
import ja from "./locales/ja.js";

const TABELAS = Object.freeze({
  "pt-BR": ptBR,
  en,
  ja,
});

const CHAVE_SALVA = "demo-idioma";
const ouvintes = new Set();
let atual = "pt-BR";

function lerSalvo() {
  try {
    const salvo = localStorage.getItem(CHAVE_SALVA);
    if (TABELAS[salvo]) atual = salvo;
  } catch {
    /* sem armazenamento */
  }
}

lerSalvo();

function ler(tabela, caminho) {
  const partes = String(caminho).split(".");
  let no = tabela;
  for (let i = 0; i < partes.length; i++) {
    if (!no || typeof no !== "object") return null;
    no = no[partes[i]];
  }
  return typeof no === "string" ? no : null;
}

export function idiomaAtual() {
  return atual;
}

export function t(chave) {
  if (!chave) return "";
  return ler(TABELAS[atual], chave) || ler(TABELAS["pt-BR"], chave) || chave;
}

export function definirIdioma(codigo) {
  if (!TABELAS[codigo] || codigo === atual) return;
  atual = codigo;
  try {
    localStorage.setItem(CHAVE_SALVA, codigo);
  } catch {
    /* sem armazenamento */
  }
  for (const fn of ouvintes) fn(atual);
}

export function aoMudarIdioma(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}
