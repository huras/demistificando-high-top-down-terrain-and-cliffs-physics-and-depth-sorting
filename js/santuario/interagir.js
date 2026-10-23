/**
 * Prompt e fluxo de interação com a pedra no overworld.
 */
import { todaVegetacao } from "../mundo/bioma/propsBioma.js";
import { findNearbyShrine } from "./colocacao.js";
import {
  descobrirSantuario,
  destravarEntrada,
  entradaAberta,
} from "./estadoSantuario.js";
import { shrinePuzzleImageSrc } from "./puzzleRetrato.js";
import { garantirPuzzleModal } from "./puzzleModal.js";
import { nomeTemplo } from "./nomes.js";

export function santuarioPerto(x, y) {
  return findNearbyShrine({ x, y }, todaVegetacao());
}

export function promptSantuario(stone) {
  if (!stone) return null;
  descobrirSantuario(stone.shrineId);
  const open = entradaAberta(stone.shrineId) || stone.entranceOpen;
  return {
    id: open ? "entrarSantuario" : "falarSantuario",
    rotulo: open ? "Entrar" : "Falar",
    ancora: { x: stone.x, y: stone.y, z: stone.z || 0 },
    stone,
    locked: !open,
  };
}

/**
 * Abre o puzzle; onUnlock quando resolver.
 * @returns {boolean}
 */
export function abrirPuzzleSantuario(stone, onUnlock) {
  const modal = garantirPuzzleModal();
  if (!modal || !stone?.shrineId) return false;
  const imageSrc = shrinePuzzleImageSrc(stone.shrineId, stone.element, stone);
  void modal.open(
    {
      kind: "shrine",
      id: stone.shrineId,
      title: nomeTemplo(stone.shrineId, stone.element),
      imageSrc,
    },
    {
      onSolve: () => {
        destravarEntrada(stone.shrineId);
        stone.entranceOpen = true;
        onUnlock?.(stone);
      },
    }
  );
  return true;
}
