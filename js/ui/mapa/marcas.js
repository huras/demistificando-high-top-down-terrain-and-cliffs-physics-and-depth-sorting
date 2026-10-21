/**
 * Marcas do mapa. Cidade e rota hoje; um ícone novo entra na lista.
 */
import { deLocalKanto } from "../../mundo/bounds.js";
import { SPAWN as SPAWN_DEMO } from "../../mundo/mapaDemo.js";
import { CIDADES_KANTO } from "../../mundo/regiao/kantoCidades.js";
import { AREA_KANTO, zonaEm } from "../../mundo/regiao/grafoKanto.js";
import { ROTAS_KANTO } from "../../mundo/regiao/kantoRotas.js";

const extras = [];

function mundo(ax, ay) {
  const p = deLocalKanto((ax + 0.5) * AREA_KANTO, (ay + 0.5) * AREA_KANTO);
  return [p.x, p.y];
}

const VIZINHOS = Object.freeze([
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]);

/** Cidades ortogonais à célula (path da rota não inclui cidade). */
function cidadesVizinhas(ax, ay) {
  const lista = [];
  for (let i = 0; i < VIZINHOS.length; i++) {
    const vx = ax + VIZINHOS[i][0];
    const vy = ay + VIZINHOS[i][1];
    const zona = zonaEm(vx, vy);
    if (zona?.tipo === "cidade") lista.push([vx, vy]);
  }
  return lista;
}

function chaveCelula(ax, ay) {
  return `${ax},${ay}`;
}

function empurrarCidades(pontos, celulas, vistos, noInicio) {
  for (let i = 0; i < celulas.length; i++) {
    const ax = celulas[i][0];
    const ay = celulas[i][1];
    const chave = chaveCelula(ax, ay);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const pt = mundo(ax, ay);
    if (noInicio) pontos.unshift(pt);
    else pontos.push(pt);
  }
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
  lista.push({
    tipo: "teste",
    id: "demo-teste",
    nome: "Teste",
    x: SPAWN_DEMO.x,
    y: SPAWN_DEMO.y,
    z: SPAWN_DEMO.z,
  });
  return lista;
}

export function rotasDoMapa() {
  const lista = [];
  for (let i = 0; i < ROTAS_KANTO.length; i++) {
    const rota = ROTAS_KANTO[i];
    const path = rota.path;
    const pontos = [];
    for (let p = 0; p < path.length; p++) {
      pontos.push(mundo(path[p][0], path[p][1]));
    }
    if (path.length > 0) {
      const vistos = new Set();
      const primeiro = path[0];
      const ultimo = path[path.length - 1];
      empurrarCidades(pontos, cidadesVizinhas(primeiro[0], primeiro[1]), vistos, true);
      empurrarCidades(pontos, cidadesVizinhas(ultimo[0], ultimo[1]), vistos, false);
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
  const o = deLocalKanto(cidade.ax * AREA_KANTO, cidade.ay * AREA_KANTO);
  return {
    ox: o.x,
    oy: o.y,
    fp: zona.layout.fp,
    volumes: zona.layout.volumes,
  };
}
