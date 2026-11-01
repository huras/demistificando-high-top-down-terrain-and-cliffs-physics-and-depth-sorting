/**
 * Pins do mapa mundial / minimapa para sítios outdoor.
 */
import { paraLocalKanto } from "../bounds.js";
import { AREA_KANTO, LADO_KANTO, zonaEm } from "../regiao/grafoKanto.js";
import { alturaDoRelevo } from "../bioma/catalogo.js";
import { TIPO_SITE } from "./catalogo.js";
import { zonaAceitaSite } from "./bioma.js";
import { garantirSitesVizinhos, peekSiteDaArea } from "./plano.js";
import { corDoSite, emojiDoSite } from "../../mapa/pinSite.js";

const NOME = Object.freeze({
  [TIPO_SITE.FAZENDA]: "Fazenda",
  [TIPO_SITE.CEMITERIO]: "Cemitério",
  [TIPO_SITE.POSTO]: "Posto",
  [TIPO_SITE.DOCA]: "Doca",
  [TIPO_SITE.MIRANTE]: "Mirante",
});

/**
 * Materializa sítios perto do jogador (minimapa) sem varrer o mundo.
 * @param {number} px
 * @param {number} py
 * @param {number} [raioAreas=2]
 */
export function garantirSitesNoMapa(px, py, raioAreas = 2) {
  if (!Number.isFinite(px) || !Number.isFinite(py)) return;
  const local = paraLocalKanto(px, py);
  const ax = Math.floor(local.x / AREA_KANTO);
  const ay = Math.floor(local.y / AREA_KANTO);
  if (ax < 0 || ay < 0 || ax >= LADO_KANTO || ay >= LADO_KANTO) return;
  garantirSitesVizinhos(ax, ay, raioAreas);
}

/**
 * Só marca áreas já materializadas no cache — evita gerar o mundo inteiro no open do mapa.
 * @param {{ px?: number, py?: number, mini?: boolean }} [opts]
 */
export function marcasSites(opts = null) {
  if (opts?.mini && Number.isFinite(opts.px) && Number.isFinite(opts.py)) {
    garantirSitesNoMapa(opts.px, opts.py, 2);
  }

  const lista = [];
  for (let ay = 0; ay < LADO_KANTO; ay++) {
    for (let ax = 0; ax < LADO_KANTO; ax++) {
      const zona = zonaEm(ax, ay);
      if (!zonaAceitaSite(zona)) continue;
      const site = peekSiteDaArea(ax, ay);
      if (!site) continue;
      const subtipo = site.tipo;
      lista.push({
        tipo: "site",
        id: site.id,
        nome: NOME[subtipo] || "Sítio",
        subtipo,
        emoji: emojiDoSite(subtipo),
        cor: corDoSite(subtipo),
        x: site.mapX,
        y: site.mapY,
        z: site.hPad ?? alturaDoRelevo(site.mapX, site.mapY),
        ax,
        ay,
      });
    }
  }
  return lista;
}

export { NOME as NOMES_SITE };
