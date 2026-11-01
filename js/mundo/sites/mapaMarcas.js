/**
 * Pins do mapa mundial para sítios outdoor já resolvidos (lazy).
 */
import { TIPO_SITE } from "./catalogo.js";
import { peekSiteDaArea } from "./plano.js";
import { AREA_KANTO, LADO_KANTO, zonaEm } from "../regiao/grafoKanto.js";
import { zonaAceitaSite } from "./bioma.js";

const NOME = Object.freeze({
  [TIPO_SITE.FAZENDA]: "Fazenda",
  [TIPO_SITE.CEMITERIO]: "Cemitério",
  [TIPO_SITE.POSTO]: "Posto",
  [TIPO_SITE.DOCA]: "Doca",
  [TIPO_SITE.MIRANTE]: "Mirante",
});

/**
 * Só marca áreas já materializadas no cache — evita gerar o mundo inteiro no open do mapa.
 */
export function marcasSites() {
  const lista = [];
  for (let ay = 0; ay < LADO_KANTO; ay++) {
    for (let ax = 0; ax < LADO_KANTO; ax++) {
      const zona = zonaEm(ax, ay);
      if (!zonaAceitaSite(zona)) continue;
      const site = peekSiteDaArea(ax, ay);
      if (!site) continue;
      lista.push({
        tipo: "site",
        id: site.id,
        nome: NOME[site.tipo] || "Sítio",
        subtipo: site.tipo,
        x: site.mapX,
        y: site.mapY,
        ax,
        ay,
      });
    }
  }
  return lista;
}

export { NOME as NOMES_SITE };
