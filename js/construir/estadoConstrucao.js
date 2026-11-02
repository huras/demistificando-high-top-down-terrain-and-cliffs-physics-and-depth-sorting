/**
 * Persistência do sistema de construção no save.
 */
import { hidratarBase, resetBase, serializarBase } from "./base.js";
import {
  hidratarEstruturas,
  listarCasas,
  resetEstruturas,
  serializarEstruturas,
  interiorDaCasa,
} from "./estruturas.js";
import { hidratarStock, resetStock, serializarStock } from "./stock.js";
import { cancelarRitual, temRitualAtivo } from "./ritual.js";
import { limparSelecaoConstruir, buildMode } from "./modo.js";

export function serializarConstrucao() {
  return {
    playerBase: serializarBase(),
    playerStructures: serializarEstruturas(),
    ...serializarStock(),
  };
}

/** Moveis indoor das casas do jogador para mesclar em estado.moveis. */
export function moveisDasCasasJogador() {
  /** @type {Record<string, { key: string, x: number, y: number }[]>} */
  const out = Object.create(null);
  for (const house of listarCasas()) {
    const casaId = `player-${house.id}`;
    const interior = interiorDaCasa(house.id);
    const furniture = interior?.floors?.[0]?.furniture;
    if (!Array.isArray(furniture)) continue;
    out[casaId] = furniture.map((m) => ({
      key: m.key,
      x: m.x | 0,
      y: m.y | 0,
    }));
  }
  return out;
}

export function hidratarConstrucao(dados) {
  if (temRitualAtivo()) cancelarRitual();
  limparSelecaoConstruir();
  buildMode.catalogOpen = false;
  if (!dados) {
    resetBase();
    resetEstruturas();
    resetStock();
    return;
  }
  hidratarBase(dados.playerBase);
  hidratarEstruturas(dados.playerStructures);
  hidratarStock(dados);
}

export function resetConstrucao() {
  if (temRitualAtivo()) cancelarRitual();
  limparSelecaoConstruir();
  buildMode.catalogOpen = false;
  resetBase();
  resetEstruturas();
  resetStock();
}
