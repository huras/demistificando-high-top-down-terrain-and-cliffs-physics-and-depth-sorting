/**
 * Tick de construção: ghost, ritual, colisão, HUD.
 */
import { hotbarAtivo, estado } from "../jogo/estado.js";
import { TIPO_ITEM } from "../wild/catalogo.js";
import {
  buildMode,
  obterPreview,
  previewBandeira,
  temSelecaoConstruir,
  temRitualAtivo,
  tickRitual,
  siteConstrucao,
} from "./indice.js";
import { sincronizarColisaoBase } from "./colisao.js";
import { atualizarCatalogoConstruir } from "../ui/construirCatalogoHud.js";

/** @type {{ x: number, y: number } | null} */
let mira = null;

export function definirMiraConstrucao(x, y) {
  if (Number.isFinite(x) && Number.isFinite(y)) mira = { x, y };
}

export function miraConstrucao() {
  return mira;
}

/**
 * @param {object} corpo
 * @param {number} dt
 * @param {object} [cenario] estado 3d
 */
export function tickConstrucao(corpo, dt, cenario) {
  sincronizarColisaoBase();

  const item = hotbarAtivo();
  const aimX = mira?.x ?? corpo?.x ?? 0;
  const aimY = mira?.y ?? corpo?.y ?? 0;

  let buildPreview = null;
  let flagPreview = null;

  if (item?.tipo === TIPO_ITEM.FERRAMENTA && item.key === "flag" && !estado.interior) {
    flagPreview = previewBandeira(aimX, aimY);
  } else if (
    item?.tipo === TIPO_ITEM.FERRAMENTA &&
    item.key === "hammer" &&
    !estado.interior &&
    temSelecaoConstruir()
  ) {
    buildPreview = obterPreview(buildMode.selected, aimX, aimY, corpo);
    if (buildPreview) {
      buildPreview.kind = buildMode.selected.kind;
      buildPreview.id = buildMode.selected.id;
    }
  }

  if (temRitualAtivo()) {
    // Fallback: auto-hit se não houver companion conduzindo
    tickRitual(dt, { autoHit: true });
    const site = siteConstrucao();
    if (site) {
      buildPreview = {
        ok: true,
        preview: site.preview,
        kind: site.kind,
        id: site.id,
        progress: site.progress,
      };
    }
  }

  cenario?.ghostConstrucao?.atualizar?.(buildPreview, flagPreview);
  if (buildMode.catalogOpen) atualizarCatalogoConstruir();
}
