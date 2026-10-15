/**
 * Discos da praça, das caixas de correio e dos móveis.
 * Ficam num chunk sentinela: não somem quando o stream descarrega a cidade.
 */
import { indexarBases } from "../../fisica/obstaculos.js";
import { ALTURA_PRACA } from "../regiao/amostraKanto.js";
import { AREA_KANTO } from "../regiao/grafoKanto.js";
import { CIDADES_KANTO } from "../regiao/kantoCidades.js";
import { decoracaoDaCidade } from "../regiao/decoracaoKanto.js";
import { montarLayout } from "../regiao/volumesCidade.js";
import { moveisDaSala } from "./interiorCasa.js";

const RAIO_QUADRO = 0.72;
const RAIO_CORREIO = 0.38;

export function indexarColisaoCidade() {
  const lista = [];
  const z = ALTURA_PRACA;
  for (let c = 0; c < CIDADES_KANTO.length; c++) {
    const def = CIDADES_KANTO[c];
    const layout = montarLayout(def);
    const ox = def.ax * AREA_KANTO;
    const oy = def.ay * AREA_KANTO;
    const decor = decoracaoDaCidade(layout);
    lista.push({ x: ox + decor.quadro.x, y: oy + decor.quadro.y, z, r: RAIO_QUADRO });
    lista.push({ x: ox + decor.correio.x, y: oy + decor.correio.y, z, r: RAIO_CORREIO });
    for (let i = 0; i < decor.casas.length; i++) {
      const casa = decor.casas[i];
      lista.push({ x: ox + casa.x, y: oy + casa.y, z, r: RAIO_CORREIO });
    }
  }
  const moveis = moveisDaSala();
  for (let i = 0; i < moveis.length; i++) {
    const item = moveis[i];
    lista.push({ x: item.x, y: item.y, z, r: item.r });
  }
  indexarBases(-9998, -9998, lista);
}
