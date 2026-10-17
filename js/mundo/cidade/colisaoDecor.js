/**
 * Discos da praça, dos postes, das caixas de correio e dos móveis.
 * Ficam num chunk sentinela: não somem quando o stream descarrega a cidade.
 */
import { indexarBases } from "../../fisica/obstaculos.js";
import { ALTURA_PRACA } from "../regiao/amostraKanto.js";
import { AREA_KANTO } from "../regiao/grafoKanto.js";
import { CIDADES_KANTO } from "../regiao/kantoCidades.js";
import { decoracaoDaCidade, decoracaoDasRotas, postesDeRua } from "../regiao/decoracaoKanto.js";
import { montarLayout } from "../regiao/volumesCidade.js";
import { moveisDaSala } from "./interiorCasa.js";
import { plantaLaboratorio } from "./laboratorio.js";

const RAIO_QUADRO = 0.72;
const RAIO_CORREIO = 0.38;
/** Base do mastro, sem o braço da luminária. */
const RAIO_POSTE = 0.26;
/**
 * O grupo fica no centro da caixa. O mastro do modelo.obj, na altura de 3.6,
 * fica 0.33 para trás nesse eixo (Z do Three, Y do jogo).
 */
const EIXO_POSTE_Y = -0.33;

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
    const rua = postesDeRua(layout);
    for (let i = 0; i < rua.length; i++) {
      lista.push({ x: ox + rua[i].x, y: oy + rua[i].y + EIXO_POSTE_Y, z, r: RAIO_POSTE });
    }
    for (let i = 0; i < decor.postes.length; i++) {
      const poste = decor.postes[i];
      lista.push({ x: ox + poste.x, y: oy + poste.y + EIXO_POSTE_Y, z, r: RAIO_POSTE });
    }
  }
  const rotas = decoracaoDasRotas();
  for (let i = 0; i < rotas.length; i++) {
    const postes = rotas[i].postes;
    for (let p = 0; p < postes.length; p++) {
      const poste = postes[p];
      lista.push({ x: poste.x, y: poste.y + EIXO_POSTE_Y, z: poste.h, r: RAIO_POSTE });
    }
  }
  const moveis = moveisDaSala();
  const discosLab = plantaLaboratorio().discos;
  for (let i = 0; i < discosLab.length; i++) lista.push(discosLab[i]);
  for (let i = 0; i < moveis.length; i++) {
    const item = moveis[i];
    lista.push({ x: item.x, y: item.y, z, r: item.r });
  }
  indexarBases(-9998, -9998, lista);
}
