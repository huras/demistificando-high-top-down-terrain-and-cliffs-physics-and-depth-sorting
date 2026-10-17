import { emAvanco, emEsquiva, emRecuo } from "../ator.js";
import {
  CORREDOR_TIRO,
  FOLGA_PROJETIL,
  JANELA_REDE,
  PASSO_DECISAO,
  VIDA_FUGA,
} from "./constantes.js";
import { alcanceSoco, golpeProntoForma, regua, vaiMelee } from "./espaco.js";
import { aplicarHabilidade, calcularHabilidade } from "./habilidades.js";
import { entrada, observar, tiroNaJanela } from "./observacao.js";

let redeLigada = true;

export function definirIaRede(ligada) {
  redeLigada = ligada !== false;
}

export function iaRedeLigada() {
  return redeLigada;
}

function ocupado(ator) {
  return emRecuo(ator) || emAvanco(ator) || emEsquiva(ator);
}

function corredorRede() {
  return FOLGA_PROJETIL + CORREDOR_TIRO;
}

export function ameacaIminente(ator, alvo, tiros) {
  if (!ator || !alvo || (ator.esquiva || 0) < 1 || ocupado(ator)) return false;
  if (vaiMelee(alvo, ator)) return true;
  return tiroNaJanela(ator, alvo, tiros, JANELA_REDE, corredorRede());
}

/** Esquiva interrompe. O resto é tiro, fuga ou perseguição. */
export function escolherHabilidade(ator, alvo) {
  const d = Math.hypot(alvo.x - ator.x, alvo.y - ator.y);
  const tiroPronto = ator.usaDistancia !== false && golpeProntoForma(ator, "projectile", "arc");
  if (tiroPronto && d > alcanceSoco(alvo)) return "atirar";
  const hp = ator.hpMax > 0 ? ator.hp / ator.hpMax : 1;
  if (ator.usaCorpo === false || hp < VIDA_FUGA) return "fugir";
  return "perseguir";
}

function pensarEsquiva(ator, alvo, tiros) {
  if (!ameacaIminente(ator, alvo, tiros)) return false;
  const faixa = regua(ator, "esquivar");
  observar(ator, alvo, tiros, faixa.parada, entrada);
  calcularHabilidade("esquivar");
  aplicarHabilidade("esquivar", ator, alvo);
  return true;
}

/** Decide no máximo a 10 Hz. A esquiva corre no quadro em que a ameaça aparece. */
export function pensar(ator, alvo, dt, tiros, forcar) {
  if (!ator || !alvo || ator.morto || alvo.morto) {
    if (ator) {
      ator.miraX = NaN;
      ator.miraY = NaN;
    }
    return;
  }
  if (pensarEsquiva(ator, alvo, tiros)) return;
  ator._iaT = (ator._iaT || 0) + (dt || 0);
  if (!forcar && ator.hab && ator._iaT < PASSO_DECISAO) return;
  ator._iaT = 0;
  const hab = forcar || escolherHabilidade(ator, alvo);
  const faixa = regua(ator, hab);
  observar(ator, alvo, tiros, faixa.parada, entrada);
  calcularHabilidade(hab);
  aplicarHabilidade(hab, ator, alvo);
}

export function reagirEsquiva(ator, alvo, tiros) {
  pensarEsquiva(ator, alvo, tiros);
}
