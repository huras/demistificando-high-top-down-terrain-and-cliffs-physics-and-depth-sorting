/**
 * Marcas do mapa. Cidade e rota hoje; um ícone novo entra na lista.
 */
import { CIDADES_KANTO } from "../../mundo/regiao/kantoCidades.js";
import { AREA_KANTO, zonaEm } from "../../mundo/regiao/grafoKanto.js";
import { ROTAS_KANTO } from "../../mundo/regiao/kantoRotas.js";

const extras = [];

function mundo(ax, ay) {
  return [(ax + 0.5) * AREA_KANTO, (ay + 0.5) * AREA_KANTO];
}

export function registrarMarca(marca) {
  extras.push(marca);
}

export function cidadesDoMapa() {
  const lista = [];
  for (let i = 0; i < CIDADES_KANTO.length; i++) {
    const cidade = CIDADES_KANTO[i];
    const [x, y] = mundo(cidade.ax, cidade.ay);
    lista.push({
      tipo: "cidade",
      id: cidade.key,
      nome: cidade.nome,
      x,
      y,
      ax: cidade.ax,
      ay: cidade.ay,
    });
  }
  return lista;
}

export function rotasDoMapa() {
  const lista = [];
  for (let i = 0; i < ROTAS_KANTO.length; i++) {
    const rota = ROTAS_KANTO[i];
    const pontos = [];
    for (let p = 0; p < rota.path.length; p++) {
      pontos.push(mundo(rota.path[p][0], rota.path[p][1]));
    }
    lista.push({
      tipo: "rota",
      id: rota.id,
      nome: rota.nome,
      agua: !!rota.agua,
      pontos,
    });
  }
  return lista;
}

export function marcasExtras() {
  return extras;
}

export function layoutDaCidade(cidade) {
  const zona = zonaEm(cidade.ax, cidade.ay);
  if (!zona?.layout) return null;
  return {
    ox: cidade.ax * AREA_KANTO,
    oy: cidade.ay * AREA_KANTO,
    fp: zona.layout.fp,
    volumes: zona.layout.volumes,
  };
}
