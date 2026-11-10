/**
 * Engate Chrono por hit no overworld (fora de sessão).
 * Qualquer dano que conecta (contato / ranged / flecha) abre a luta.
 */
import { modoChronoCampo } from "./modo.js";
import {
  abrirSessaoChrono,
  garantirPartyChrono,
  sessaoChronoAtiva,
} from "./sessao.js";

/**
 * @param {object|null} atacante
 * @param {object|null} alvo
 * @param {object|null} [efeitos]
 * @returns {boolean}
 */
export function tentarEngateChronoPorHit(atacante, alvo, efeitos = null) {
  if (!modoChronoCampo() || sessaoChronoAtiva()) return false;
  if (!atacante || !alvo) return false;

  const facAtk = atacante.faccao;
  const facAlvo = alvo.faccao;
  const alvoVivo = !alvo.morto && (alvo.hp == null || alvo.hp > 0);

  // Selvagem acertou treinador/party → Chrono (manda o 1º saudável se precisar).
  if (facAtk === "selvagem" && (facAlvo === "treinador" || facAlvo === "party")) {
    if (!garantirPartyChrono()) return false;
    return abrirSessaoChrono(atacante, { motivo: "hit", efeitos });
  }

  // Player/party acertou wild que sobreviveu → Chrono.
  if (facAlvo === "selvagem" && (facAtk === "treinador" || facAtk === "party")) {
    if (!alvoVivo) return false;
    if (!garantirPartyChrono()) return false;
    return abrirSessaoChrono(alvo, { motivo: "hit", efeitos });
  }

  return false;
}

/** @deprecated use tentarEngateChronoPorHit */
export function tentarEngateChronoPorTiro(atacante, alvo, efeitos = null) {
  return tentarEngateChronoPorHit(atacante, alvo, efeitos);
}
