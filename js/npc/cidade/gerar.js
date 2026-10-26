/**
 * Gera 1 residente outdoor por casa com porta.
 */
import { deLocalKanto } from "../../mundo/bounds.js";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { AREA_KANTO } from "../../mundo/regiao/grafoKanto.js";
import { CIDADES_KANTO } from "../../mundo/regiao/kantoCidades.js";
import {
  faixaDaPorta,
  montarLayout,
  saidaDaPorta,
} from "../../mundo/regiao/volumesCidade.js";
import { falaCivil, resolverNpc } from "../catalogo/identidade.js";
import { PERFIL_ANDAR } from "../catalogo/identidade.js";

/**
 * @returns {object[]}
 */
export function gerarNpcsCidade() {
  const lista = [];
  for (let c = 0; c < CIDADES_KANTO.length; c++) {
    const def = CIDADES_KANTO[c];
    const layout = montarLayout(def);
    const origem = deLocalKanto(def.ax * AREA_KANTO, def.ay * AREA_KANTO);
    const ox = origem.x;
    const oy = origem.y;
    const volumes = layout.volumes || [];
    let casaIdx = 0;
    for (let i = 0; i < volumes.length; i++) {
      const v = volumes[i];
      if (v.papel !== "casa" || v.porta === false) continue;
      const porta = faixaDaPorta(v, null);
      if (!porta) continue;
      const spawn = saidaDaPorta(v, 0, 0, null);
      const seed = `${def.key}:casa:${casaIdx}`;
      const id = resolverNpc({ seed });
      const portaMundo = porta
        ? {
            x0: ox + porta.x0,
            y0: oy + porta.y0,
            x1: ox + porta.x1,
            y1: oy + porta.y1,
          }
        : null;
      const casaMundo = {
        id: seed,
        x0: ox + v.x0,
        y0: oy + v.y0,
        x1: ox + v.x1,
        y1: oy + v.y1,
        lote: {
          x0: ox + v.lote.x0,
          y0: oy + v.lote.y0,
          x1: ox + v.lote.x1,
          y1: oy + v.lote.y1,
        },
        portaLocal: portaMundo,
      };
      lista.push({
        id: `${seed}-residente`,
        tipo: "civil",
        escopo: "cidade",
        cidadeKey: def.key,
        houseId: seed,
        peopleId: id.peopleId,
        nome: id.nome,
        sexo: id.sexo,
        origem: id.origem,
        coluna: id.coluna,
        perfilAndar: id.perfilAndar,
        peopleSeed: seed,
        x: ox + spawn.x,
        y: oy + spawn.y,
        z: ALTURA_PRACA,
        facing: { x: 0, y: 1 },
        raio: 0.4,
        modo: id.perfilAndar === PERFIL_ANDAR.STILL ? "parado" : "lote",
        fala: [falaCivil(`${seed}:fala`, "cumprimentos")],
        retrato: null,
        casa: casaMundo,
        ox,
        oy,
        vx: 0,
        vy: 0,
        andando: false,
        animT: 0,
        frame: 0,
        visivel: true,
      });
      casaIdx += 1;
    }
  }
  return lista;
}
