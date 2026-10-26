/**
 * Cast autorado mínimo (extensível). Lab/hub usam schemas próprios migrados.
 */
import { deLocalKanto } from "../../mundo/bounds.js";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { AREA_KANTO } from "../../mundo/regiao/grafoKanto.js";
import { CIDADES_KANTO } from "../../mundo/regiao/kantoCidades.js";
import { montarLayout } from "../../mundo/regiao/volumesCidade.js";
import { PERFIL_ANDAR, resolverNpc } from "../catalogo/identidade.js";

/**
 * Jenny perto do centro da cidade (se houver volume centro).
 */
export function npcsAutoradosCidade() {
  const lista = [];
  for (let c = 0; c < CIDADES_KANTO.length; c++) {
    const def = CIDADES_KANTO[c];
    if (def.tier === "starter") continue;
    const layout = montarLayout(def);
    const centro = (layout.volumes || []).find((v) => v.papel === "centro");
    if (!centro) continue;
    const origem = deLocalKanto(def.ax * AREA_KANTO, def.ay * AREA_KANTO);
    const id = resolverNpc({
      peopleId: "pt-police",
      seed: `${def.key}:jenny`,
      nomeFixo: "Jenny",
      forceStill: true,
    });
    lista.push({
      id: `${def.key}-jenny`,
      tipo: "civil",
      escopo: "cidade",
      cidadeKey: def.key,
      peopleId: id.peopleId,
      nome: "Jenny",
      sexo: "female",
      origem: id.origem,
      coluna: id.coluna,
      perfilAndar: PERFIL_ANDAR.STILL,
      peopleSeed: `${def.key}:jenny`,
      x: origem.x + (centro.x0 + centro.x1) * 0.5,
      y: origem.y + centro.y1 + 1.2,
      z: ALTURA_PRACA,
      facing: { x: 0, y: 1 },
      raio: 0.4,
      modo: "parado",
      fala: [
        "Sou a Jenny desta cidade.",
        "Se vir algo suspeito nas rotas, me avise.",
      ],
      retrato: null,
      vx: 0,
      vy: 0,
      andando: false,
      animT: 0,
      frame: 0,
      visivel: true,
    });
  }
  return lista;
}
