import { emAvanco, emEsquiva, emRecuo } from "../ator.js";
import { cancelarConjuracao } from "../combate/executor.js";
import {
  CORREDOR_TIRO,
  FOLGA_PROJETIL,
  JANELA_REDE,
  PASSO_DECISAO,
  VIDA_FUGA,
} from "./constantes.js";
import { alcanceSoco, golpeDeCorpo, golpeProntoForma, regua, vaiMelee } from "./espaco.js";
import { aplicarHabilidade, calcularHabilidade, definirPerfilIa, passoDecisaoIa } from "./habilidades.js";
import { usarNivel } from "./pesos.js";
import { entrada, observar, tiroNaJanela } from "./observacao.js";

const PERFIL_NIVEL = {
  facil: { portao: 0.34, mira: 0.62, passo: 0.24 },
  medio: { portao: 0.16, mira: 0.84, passo: 0.15 },
  dificil: { portao: 0.05, mira: 1, passo: PASSO_DECISAO },
};

let redeLigada = true;
let nivelIa = "dificil";

export function definirNivelIa(nivel) {
  const id = PERFIL_NIVEL[nivel] ? nivel : "dificil";
  nivelIa = id;
  definirPerfilIa(PERFIL_NIVEL[id]);
  usarNivel(id);
}

export function nivelIaAtual() {
  return nivelIa;
}

export function definirIaRede(ligada) {
  redeLigada = ligada !== false;
}

export function iaRedeLigada() {
  return redeLigada;
}

function ocupado(ator) {
  return emRecuo(ator) || emAvanco(ator) || emEsquiva(ator) || (ator.conjuroRestante || 0) > 0 || (ator.jatoDur || 0) > 0;
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
  const corpo = golpeDeCorpo(ator);
  if (!corpo) return "fugir";
  const hp = ator.hpMax > 0 ? ator.hp / ator.hpMax : 1;
  // Sem tiro, a vida baixa não pode abrir distância: o soco é o único dano.
  if (hp < VIDA_FUGA && tiroPronto) return "fugir";
  return "perseguir";
}

/** Com a barra cheia, o dash pode sair para qualquer lado. A rede decide se vale a pena. */
function pensarEsquiva(ator, alvo, tiros) {
  if (!ator || !alvo || (ator.esquiva || 0) < 1 || ocupado(ator)) return false;
  const tiroPronto = ator.usaDistancia !== false && golpeProntoForma(ator, "projectile", "arc");
  const hp = ator.hpMax > 0 ? ator.hp / ator.hpMax : 1;
  // Vida baixa ensina o dash para trás. Sem tiro, os dois só se afastam e a luta para.
  if (hp < VIDA_FUGA && !tiroPronto && !tiroNaJanela(ator, alvo, tiros, JANELA_REDE, corredorRede())) return false;
  const faixa = regua(ator, "esquivar");
  observar(ator, alvo, tiros, faixa.parada, entrada);
  calcularHabilidade("esquivar");
  if (!aplicarHabilidade("esquivar", ator, alvo)) return false;
  if (emEsquiva(ator)) cancelarConjuracao(ator);
  return true;
}

/** Decide no máximo a 10 Hz. */
export function pensar(ator, alvo, dt, tiros, forcar) {
  if (!ator || !alvo || ator.morto || alvo.morto) {
    if (ator) {
      ator.miraX = NaN;
      ator.miraY = NaN;
    }
    return;
  }
  if (pensarEsquiva(ator, alvo, tiros)) return;
  if ((ator.jatoDur || 0) > 0) {
    ator._iaT = (ator._iaT || 0) + (dt || 0);
    if (!forcar && ator._iaT < passoDecisaoIa()) return;
    ator._iaT = 0;
    const faixa = regua(ator, "atirar");
    observar(ator, alvo, tiros, faixa.parada, entrada);
    calcularHabilidade("atirar");
    aplicarHabilidade("atirar", ator, alvo);
    return;
  }
  ator._iaT = (ator._iaT || 0) + (dt || 0);
  if (!forcar && ator.hab && ator._iaT < passoDecisaoIa()) return;
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
