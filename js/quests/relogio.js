/**
 * Dia do quadro: avança quando a hora do céu cruza 06:00.
 */

import { obterHora } from "../render/3d/ceu/controleCeu.js";
import { QUEST_REFRESH_HOUR, createQuestState } from "./tipos.js";

/**
 * @param {ReturnType<typeof createQuestState>} state
 * @returns {number}
 */
export function sincronizarDiaQuadro(state) {
  if (!state) return 0;
  const hora = obterHora();
  if (!Number.isFinite(state.boardDay)) state.boardDay = 0;

  if (!Number.isFinite(state.ultimaHora)) {
    state.ultimaHora = hora;
    return state.boardDay | 0;
  }

  const prev = state.ultimaHora;
  // Avanço contínuo (ciclo normal ou debug ]): conta cruzamentos de 6h.
  if (hora + 1e-4 >= prev) {
    let cursor = prev;
    let guard = 0;
    while (cursor < hora && guard < 64) {
      const teto = Math.min(hora, Math.floor(cursor) + 1);
      if (cursor < QUEST_REFRESH_HOUR && teto >= QUEST_REFRESH_HOUR) {
        state.boardDay = (state.boardDay | 0) + 1;
      }
      if (teto <= cursor) break;
      cursor = teto;
      guard++;
    }
  } else {
    // Wrap 24→0 (ou rewind parcial): fecha o dia antigo e abre o novo.
    if (prev < QUEST_REFRESH_HOUR) {
      state.boardDay = (state.boardDay | 0) + 1;
    }
    if (hora >= QUEST_REFRESH_HOUR) {
      state.boardDay = (state.boardDay | 0) + 1;
    }
  }

  state.ultimaHora = hora;
  return state.boardDay | 0;
}
