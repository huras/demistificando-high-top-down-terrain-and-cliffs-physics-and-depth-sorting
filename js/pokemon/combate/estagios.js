/** Estágios de status (−6..+6) com decay por nível. */

import { multiplicadorEstagio } from "../tipos.js";
import { multiplicadorPrecisao } from "./acertoClassico.js";

export const DURACAO_ESTAGIO_S = 10;

/** Circunferência do anel SVG (r=11 → 2πr ≈ 69.115). */
export const ANEL_CIRC = 69.115;

export const CAMPOS_ESTAGIO = Object.freeze([
  "estagioAtk",
  "estagioDef",
  "estagioSpa",
  "estagioSpd",
  "estagioSpe",
  "estagioPrecisao",
  "estagioEvasao",
]);

const META = Object.freeze({
  estagioAtk: { key: "atk", curto: "Atk", precisao: false },
  estagioDef: { key: "def", curto: "Def", precisao: false },
  estagioSpa: { key: "spa", curto: "SpA", precisao: false },
  estagioSpd: { key: "spd", curto: "SpD", precisao: false },
  estagioSpe: { key: "spe", curto: "Spe", precisao: false },
  estagioPrecisao: { key: "accuracy", curto: "Acc", precisao: true },
  estagioEvasao: { key: "evasion", curto: "Eva", precisao: true },
});

export function metaEstagio(campo) {
  return META[campo] || null;
}

export function multiplicadorDoCampo(campo, valor) {
  const meta = META[campo];
  if (!meta) return 1;
  return meta.precisao ? multiplicadorPrecisao(valor) : multiplicadorEstagio(valor);
}

/** % relativo ao neutro: +1 Atk → +50, −1 → −33. */
export function pctEstagio(campo, valor) {
  const e = valor | 0;
  if (!e) return 0;
  return Math.round((multiplicadorDoCampo(campo, e) - 1) * 100);
}

export function formatarPctEstagio(campo, valor) {
  const pct = pctEstagio(campo, valor);
  if (pct > 0) return `+${pct}%`;
  if (pct < 0) return `${pct}%`;
  return "0%";
}

export function marcarEstagioAte(ator, campo, agora) {
  if (!ator || !campo) return;
  if (!ator.estagioAte) ator.estagioAte = Object.create(null);
  ator.estagioAte[campo] = agora + DURACAO_ESTAGIO_S;
}

export function limparEstagiosAte(ator) {
  if (!ator) return;
  if (!ator.estagioAte) ator.estagioAte = Object.create(null);
  else {
    for (const k of Object.keys(ator.estagioAte)) delete ator.estagioAte[k];
  }
}

/** Fração restante 0..1 até o próximo decay (−1 nível). */
export function progressoEstagio(ator, campo, agora) {
  const ate = ator?.estagioAte?.[campo] || 0;
  if (!(ate > 0)) return 0;
  const restante = ate - agora;
  if (restante <= 0) return 0;
  return Math.max(0, Math.min(1, restante / DURACAO_ESTAGIO_S));
}

export function listaEstagiosAtivos(ator) {
  const out = [];
  if (!ator) return out;
  for (let i = 0; i < CAMPOS_ESTAGIO.length; i++) {
    const campo = CAMPOS_ESTAGIO[i];
    const valor = ator[campo] | 0;
    if (!valor) continue;
    const meta = META[campo];
    out.push({
      campo,
      valor,
      key: meta.key,
      curto: meta.curto,
      pct: pctEstagio(campo, valor),
      pctTxt: formatarPctEstagio(campo, valor),
      buff: valor > 0,
    });
  }
  return out;
}

/** Assinatura estável dos valores (sem timer) pra rebuild da HUD. */
export function assinaturaEstagios(ator) {
  if (!ator) return "";
  let s = "";
  for (let i = 0; i < CAMPOS_ESTAGIO.length; i++) {
    const v = ator[CAMPOS_ESTAGIO[i]] | 0;
    if (v) s += `${i}:${v};`;
  }
  return s;
}

export function tickEstagios(ator, agora) {
  if (!ator || ator.morto || ator.capturado) return;
  if (!ator.estagioAte) ator.estagioAte = Object.create(null);
  for (let i = 0; i < CAMPOS_ESTAGIO.length; i++) {
    const campo = CAMPOS_ESTAGIO[i];
    let valor = ator[campo] | 0;
    if (!valor) {
      if (ator.estagioAte[campo]) delete ator.estagioAte[campo];
      continue;
    }
    let ate = ator.estagioAte[campo] || 0;
    if (!(ate > 0)) {
      marcarEstagioAte(ator, campo, agora);
      continue;
    }
    while (valor !== 0 && agora >= ate) {
      valor += valor > 0 ? -1 : 1;
      ator[campo] = valor;
      if (valor === 0) {
        delete ator.estagioAte[campo];
        break;
      }
      ate = agora + DURACAO_ESTAGIO_S;
      ator.estagioAte[campo] = ate;
    }
  }
}
