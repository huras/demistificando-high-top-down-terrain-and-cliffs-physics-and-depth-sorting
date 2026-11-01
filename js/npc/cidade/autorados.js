/**
 * Cast autorado mínimo (extensível). Lab/hub usam schemas próprios migrados.
 */
import { deLocalKanto } from "../../mundo/bounds.js";
import { AREA_KANTO } from "../../mundo/regiao/grafoKanto.js";
import { CIDADES_KANTO } from "../../mundo/regiao/kantoCidades.js";
import { montarLayout } from "../../mundo/regiao/volumesCidade.js";
import { falaCivil, PERFIL_ANDAR, resolverNpc } from "../catalogo/identidade.js";
import { alturaSpawnNpc } from "../locomocao.js";

function npcParado({
  id,
  cidadeKey,
  peopleId,
  nomeFixo,
  seed,
  wx,
  wy,
  facing = { x: 0, y: 1 },
  fala,
}) {
  const idRes = resolverNpc({
    peopleId,
    seed,
    nomeFixo,
    forceStill: true,
  });
  const z0 = alturaSpawnNpc(wx, wy);
  return {
    id,
    tipo: "civil",
    escopo: "cidade",
    cidadeKey,
    peopleId: idRes.peopleId,
    nome: nomeFixo || idRes.nome,
    sexo: idRes.sexo,
    origem: idRes.origem,
    coluna: idRes.coluna,
    perfilAndar: PERFIL_ANDAR.STILL,
    peopleSeed: seed,
    x: wx,
    y: wy,
    z: z0,
    elevacao: z0,
    facing,
    raio: 0.4,
    modo: "parado",
    fala,
    retrato: null,
    vx: 0,
    vy: 0,
    andando: false,
    animT: 0,
    frame: 0,
    visivel: true,
  };
}

/**
 * Oficial perto do centro da cidade (sprite police = masculino).
 * Celadon: jardineiro, fã da Erika e rumor da mansão.
 */
export function npcsAutoradosCidade() {
  const lista = [];
  for (let c = 0; c < CIDADES_KANTO.length; c++) {
    const def = CIDADES_KANTO[c];
    if (def.tier === "starter") continue;
    const layout = montarLayout(def);
    const volumes = layout.volumes || [];
    const centro = volumes.find((v) => v.papel === "centro");
    if (!centro) continue;
    const origem = deLocalKanto(def.ax * AREA_KANTO, def.ay * AREA_KANTO);
    const wx = origem.x + (centro.x0 + centro.x1) * 0.5;
    const wy = origem.y + centro.y1 + 1.2;
    lista.push(
      npcParado({
        id: `${def.key}-oficial`,
        cidadeKey: def.key,
        peopleId: "pt-police",
        nomeFixo: "Ken",
        seed: `${def.key}:oficial`,
        wx,
        wy,
        fala: [
          "Sou o oficial desta cidade.",
          "Se vir algo suspeito nas rotas, me avise.",
        ],
      }),
    );

    if (def.key !== "celadon") continue;

    const ginasio = volumes.find((v) => v.papel === "ginasio");
    const mansao = volumes.find((v) => v.papel === "mansao");
    const pracaX = origem.x + 64;
    const pracaY = origem.y + 64;

    lista.push(
      npcParado({
        id: "celadon-jardineiro",
        cidadeKey: "celadon",
        peopleId: "pt-aroma-lady",
        nomeFixo: "Lila",
        seed: "celadon:jardineiro",
        wx: pracaX + 3.5,
        wy: pracaY + 6.5,
        facing: { x: 0, y: -1 },
        fala: [
          falaCivil("celadon:jardineiro:a", "celadon"),
          "Rego estas flores toda manhã. Não pise nelas, por favor!",
        ],
      }),
    );

    if (ginasio) {
      lista.push(
        npcParado({
          id: "celadon-fa-erika",
          cidadeKey: "celadon",
          peopleId: "pt-beauty",
          nomeFixo: "Suki",
          seed: "celadon:fa-erika",
          wx: origem.x + (ginasio.x0 + ginasio.x1) * 0.5,
          wy: origem.y + ginasio.y1 + 1.4,
          fala: [
            "A Erika é a líder mais elegante de Kanto!",
            falaCivil("celadon:fa:b", "celadon"),
          ],
        }),
      );
    }

    if (mansao) {
      lista.push(
        npcParado({
          id: "celadon-rumor-mansao",
          cidadeKey: "celadon",
          peopleId: "pt-gentleman",
          nomeFixo: "Victor",
          seed: "celadon:rumor-mansao",
          wx: origem.x + (mansao.x0 + mansao.x1) * 0.5,
          wy: origem.y + mansao.y1 + 1.5,
          fala: [
            "A mansão… hermosa, porém inquietante.",
            "Ouvi passos no segundo andar. Talvez seja só vento.",
          ],
        }),
      );
    }
  }
  return lista;
}
