/**
 * Plaza AABB + amostragem natural pra achatar o sítio (min dry height).
 */
import { ehCidade } from "../regiao/grafoKanto.js";
import { alturaDoRelevoNatural, nivelMarBlocos } from "../bioma/catalogo.js";
import { temPlanoLetra } from "../../letras/relevo.js";
import {
  SITE_AVENTAL,
  SITE_AVENTAL_MONTANHA,
  SITE_DESNIVEL,
  SITE_DESNIVEL_CEMITERIO,
  SITE_DESNIVEL_MIRANTE,
  TIPO_SITE,
} from "./catalogo.js";

/**
 * @param {object} site
 * @param {number|null} [padOverride]
 * @returns {{ x0:number, y0:number, x1:number, y1:number }|null}
 */
export function plazaBoundsDoSite(site, padOverride = null) {
  if (!site) return null;
  const pad =
    padOverride != null
      ? Math.max(0, padOverride | 0)
      : Math.max(2, (site.limpaVeg ?? 1) + 2);
  return {
    x0: Math.floor(site.x0) - pad,
    y0: Math.floor(site.y0) - pad,
    x1: Math.ceil(site.x1) + pad,
    y1: Math.ceil(site.y1) + pad,
  };
}

export function aventalDoTipo(tipo) {
  if (tipo === TIPO_SITE.MIRANTE) return SITE_AVENTAL_MONTANHA;
  return SITE_AVENTAL;
}

export function desnivelMaxDoTipo(tipo) {
  if (tipo === TIPO_SITE.MIRANTE) return SITE_DESNIVEL_MIRANTE;
  if (tipo === TIPO_SITE.CEMITERIO) return SITE_DESNIVEL_CEMITERIO;
  return SITE_DESNIVEL;
}

/**
 * Amostra alturas naturais no retângulo (coords mundiais, x1/y1 exclusive).
 * @returns {{ ok:boolean, minH:number, maxH:number, hPad:number, nSecas:number }|null}
 */
export function amostrarPlazaNatural(x0, y0, x1, y1, opts = null) {
  const mar = nivelMarBlocos();
  const desnivelMax = opts?.desnivelMax ?? SITE_DESNIVEL;
  const exigeSeco = opts?.exigeSeco !== false;
  const minSecas = opts?.minSecas ?? 4;

  let minH = Infinity;
  let maxH = -Infinity;
  let minSeca = Infinity;
  let n = 0;
  let nSecas = 0;

  for (let ty = y0; ty < y1; ty++) {
    for (let tx = x0; tx < x1; tx++) {
      const borda = tx === x0 || ty === y0 || tx === x1 - 1 || ty === y1 - 1;
      if (!borda && ((tx + ty) & 1) === 1) continue;
      const wx = tx + 0.5;
      const wy = ty + 0.5;
      if (ehCidade(wx, wy)) return null;
      if (temPlanoLetra(tx, ty)) return null;
      const h = alturaDoRelevoNatural(wx, wy) | 0;
      if (!Number.isFinite(h)) return null;
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
      n++;
      if (h >= mar) {
        nSecas++;
        if (h < minSeca) minSeca = h;
      }
    }
  }

  if (!n || !Number.isFinite(minH)) return null;
  if (maxH - minH > desnivelMax) return null;

  if (exigeSeco) {
    if (nSecas < minSecas || !Number.isFinite(minSeca)) return null;
    return {
      ok: true,
      minH,
      maxH,
      hPad: Math.max(mar, minSeca),
      nSecas,
    };
  }

  // Doca: aceita beira; pad sobe pelo menos ao nível do mar se houver alguma seca.
  const hPad = Number.isFinite(minSeca)
    ? Math.max(mar, minSeca)
    : Math.max(mar, minH);
  if (nSecas < 1) return null;
  return { ok: true, minH, maxH, hPad, nSecas };
}
