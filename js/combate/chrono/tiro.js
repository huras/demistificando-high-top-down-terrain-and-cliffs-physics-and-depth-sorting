/**
 * Engate Chrono por tiro ranged no overworld (fora de sessão).
 * Wild acerta player/party → luta. Player/party acerta wild vivo → luta.
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
export function tentarEngateChronoPorTiro(atacante, alvo, efeitos = null) {
  if (!modoChronoCampo() || sessaoChronoAtiva()) return false;
  if (!atacante || !alvo || alvo.morto || (alvo.hp != null && alvo.hp <= 0)) return false;

  const facAtk = atacante.faccao;
  const facAlvo = alvo.faccao;

  // Tiro selvagem no treinador ou no party → Chrono com o wild.
  if (facAtk === "selvagem" && (facAlvo === "treinador" || facAlvo === "party")) {
    if (!garantirPartyChrono()) return false;
    return abrirSessaoChrono(atacante, { motivo: "tiro", efeitos });
  }

  // Tiro do player/party num wild que sobreviveu → Chrono.
  if (
    facAlvo === "selvagem" &&
    (facAtk === "treinador" || facAtk === "party")
  ) {
    if (!garantirPartyChrono()) return false;
    return abrirSessaoChrono(alvo, { motivo: "tiro", efeitos });
  }

  return false;
}
