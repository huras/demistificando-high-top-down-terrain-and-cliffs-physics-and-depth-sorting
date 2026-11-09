/**
 * Compat: batalha treinador usa o BattleStage overlay unificado.
 */
import { estado } from "../jogo/estado.js";
import { atoresArena, estadoLuta } from "./luta.js";
import {
  abrirOverlayStage,
  definirStatusStage,
  fecharOverlayStage,
  overlayStageAberto,
  tickOverlayStage,
} from "./stage/overlay.js";

export function overlayAberto() {
  return overlayStageAberto();
}

export function abrirOverlayTreinador({ nomePlayer, nomeFoe } = {}) {
  if (!estado.batalhaStage) estado.batalhaStage = { kind: "trainer" };
  return abrirOverlayStage({
    nomePlayer: nomePlayer || "Você",
    nomeFoe: nomeFoe || "Treinador",
    podeFugir: false,
    obterAtores: () => atoresArena(),
    obterSessaoHud: () => {
      const e = estadoLuta();
      return {
        aliados: e.esquerda ? [e.esquerda] : [],
        foes: e.direita ? [e.direita] : [],
      };
    },
  });
}

export function fecharOverlayTreinador() {
  fecharOverlayStage();
  if (estado.batalhaStage?.kind === "trainer") estado.batalhaStage = null;
}

export function definirStatusBatalha(texto) {
  definirStatusStage(texto);
}

export function tickOverlayTreinador(bruto, tickFn) {
  tickOverlayStage(bruto, tickFn);
}
