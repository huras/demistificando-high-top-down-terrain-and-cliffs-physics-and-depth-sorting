/**
 * Tick de construção: ghost, ritual com companion, colisão, HUD.
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
  claimRect,
  temClaim,
} from "./indice.js";
import { sincronizarColisaoBase } from "./colisao.js";
import { tickOrdemConstrucao } from "./ordemRitual.js";
import { poeiraDoPreview } from "./poeira.js";
import { clampMiraConstrucao } from "./mira.js";

/** @type {{ x: number, y: number } | null} */
let mira = null;
let autoHitAcc = 0;
const AUTO_HIT_GRACE = 2.5; // s sem companion antes de auto-hit

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
  const aim = clampMiraConstrucao(corpo, mira?.x, mira?.y);
  const aimX = aim.x;
  const aimY = aim.y;
  const hammer =
    item?.tipo === TIPO_ITEM.FERRAMENTA && item.key === "hammer" && !estado.interior;
  const flag =
    item?.tipo === TIPO_ITEM.FERRAMENTA && item.key === "flag" && !estado.interior;

  let buildPreview = null;
  let flagPreview = null;

  if (flag) {
    flagPreview = previewBandeira(aimX, aimY);
  } else if (hammer && temSelecaoConstruir()) {
    buildPreview = obterPreview(buildMode.selected, aimX, aimY, corpo);
    if (buildPreview) {
      buildPreview.kind = buildMode.selected.kind;
      buildPreview.id = buildMode.selected.id;
    }
  } else if (hammer && temClaim()) {
    // Outline do claim mesmo sem seleção
    flagPreview = { ok: true, rect: claimRect() };
  }

  if (temRitualAtivo()) {
    const ordem = tickOrdemConstrucao(dt);
    if (ordem?.hit && siteConstrucao()) {
      poeiraDoPreview(siteConstrucao().preview);
    }
    // Fallback: se não há companion trabalhando, auto-hit após grace
    if (ordem?.precisaAuto !== false && !ordem?.hit) {
      autoHitAcc += dt;
      if (autoHitAcc >= AUTO_HIT_GRACE) {
        const r = tickRitual(dt, { autoHit: true });
        if (r?.hit || r?.done) poeiraDoPreview(siteConstrucao()?.preview);
      }
    } else {
      autoHitAcc = 0;
    }
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
  } else {
    autoHitAcc = 0;
  }

  cenario?.ghostConstrucao?.atualizar?.(buildPreview, flagPreview);
  // Catálogo NÃO repinta aqui: innerHTML por frame destrói os botões no meio do clique.
}
