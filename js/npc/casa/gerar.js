/**
 * Residentes indoor em casas genéricas (sala3d).
 */
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import {
  MIOL_X,
  MIOL_Y,
  ORIGEM_SALA_X,
  ORIGEM_SALA_Y,
} from "../../mundo/cidade/sala3d.js";
import {
  falaCivil,
  nomeNpcUnico,
  PERFIL_ANDAR,
  resolverNpc,
} from "../catalogo/identidade.js";
import { hashStr, mulberry32, pickIndex } from "../rng.js";

const nomesUsadosPorSkin = new Map();

/**
 * @param {string} predioId seed da casa / predio
 * @returns {object[]}
 */
export function gerarNpcsCasa(predioId = "casa") {
  const rng = mulberry32(hashStr(`indoor:${predioId}`));
  const qtd = pickIndex(rng, 3); // 0–2
  const lista = [];
  const ox = ORIGEM_SALA_X + 1;
  const oy = ORIGEM_SALA_Y + 1;
  const spots = [
    { x: 3.5, y: 4.5 },
    { x: MIOL_X - 3.5, y: 5.2 },
    { x: MIOL_X * 0.5, y: MIOL_Y - 4 },
  ];
  for (let i = 0; i < qtd; i++) {
    const seed = `${predioId}:indoor:${i}`;
    const id = resolverNpc({ seed });
    const usados =
      nomesUsadosPorSkin.get(id.peopleId) ||
      (nomesUsadosPorSkin.set(id.peopleId, new Set()),
      nomesUsadosPorSkin.get(id.peopleId));
    const nome = nomeNpcUnico(id.peopleId, seed, usados);
    usados.add(nome);
    const spot = spots[i % spots.length];
    lista.push({
      id: seed,
      tipo: "civil",
      escopo: "casa",
      predioId,
      peopleId: id.peopleId,
      nome,
      sexo: id.sexo,
      origem: id.origem,
      coluna: id.coluna,
      perfilAndar: PERFIL_ANDAR.STILL,
      peopleSeed: seed,
      x: ox + spot.x,
      y: oy + spot.y,
      z: ALTURA_PRACA,
      facing: { x: 0, y: 1 },
      raio: 0.36,
      modo: "parado",
      fala: [
        falaCivil(`${seed}:a`, "casa"),
        falaCivil(`${seed}:b`, "cumprimentos"),
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
