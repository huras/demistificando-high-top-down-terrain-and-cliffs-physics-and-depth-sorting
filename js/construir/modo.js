/**
 * Estado de UI / seleção do martelo outdoor e modo cerca.
 */
import { TIPO_CONSTRUIR } from "./catalogo.js";

/** @type {{ selected: { kind: string, id: string } | null, catalogOpen: boolean, fencePaint: boolean }} */
export const buildMode = {
  selected: null,
  catalogOpen: false,
  fencePaint: false,
};

export function selecionarConstruir(kind, id) {
  buildMode.selected = kind && id ? { kind, id } : null;
  if (kind === TIPO_CONSTRUIR.CERCA) buildMode.fencePaint = true;
}

export function limparSelecaoConstruir() {
  buildMode.selected = null;
  buildMode.fencePaint = false;
}

export function abrirCatalogoConstruir(aberto = true) {
  buildMode.catalogOpen = !!aberto;
  if (!aberto) return;
}

export function toggleCatalogoConstruir() {
  buildMode.catalogOpen = !buildMode.catalogOpen;
  return buildMode.catalogOpen;
}

export function temSelecaoConstruir() {
  return !!(buildMode.selected?.kind && buildMode.selected?.id);
}
