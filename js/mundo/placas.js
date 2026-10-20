/**
 * Placa mais próxima do corpo: rota, quadro da praça e placas do demo.
 * A busca fica na área atual e nas vizinhas. A histerese evita piscar na borda.
 */
import { alturaEm } from "./altura.js";
import { deLocalKanto, paraLocalKanto } from "./bounds.js";
import { PROPS } from "./mapaDemo.js";
import { ALTURA_PRACA } from "./regiao/amostraKanto.js";
import { decoracaoDaCidade, decoracaoDasRotas } from "./regiao/decoracaoKanto.js";
import { AREA_KANTO, LADO_KANTO, zonaNoMundo } from "./regiao/grafoKanto.js";

const ENTRA = 2.6;
const SAI = 3.15;
const ENTRA2 = ENTRA * ENTRA;
const SAI2 = SAI * SAI;

const busca = {
  melhor: null,
  melhorD: ENTRA2,
  manteve: null,
  manteveD: Infinity,
};

let segura = null;
let rotas = null;
const quadros = new Map();
const demo = [];
let demoPronto = false;

function indiceRotas() {
  if (rotas) return rotas;
  rotas = new Map();
  const grupos = decoracaoDasRotas();
  for (let g = 0; g < grupos.length; g++) {
    const grupo = grupos[g];
    const placas = grupo.placas;
    const lista = new Array(placas.length);
    for (let i = 0; i < placas.length; i++) {
      const placa = placas[i];
      lista[i] = {
        id: `rota:${grupo.ax}:${grupo.ay}:${i}`,
        x: placa.x,
        y: placa.y,
        z: placa.h,
        nome: placa.nome,
        linhas: [`A estrada segue para ${placa.nome}.`],
      };
    }
    rotas.set(grupo.ay * LADO_KANTO + grupo.ax, lista);
  }
  return rotas;
}

function quadroDa(zona) {
  let quadro = quadros.get(zona.id);
  if (quadro) return quadro;
  const decor = decoracaoDaCidade(zona.layout);
  const pos = deLocalKanto(zona.ax * AREA_KANTO + decor.quadro.x, zona.ay * AREA_KANTO + decor.quadro.y);
  quadro = {
    id: `quadro:${zona.id}`,
    x: pos.x,
    y: pos.y,
    z: ALTURA_PRACA,
    nome: zona.nome,
    linhas: [`Quadro de avisos de ${zona.nome}.`],
  };
  quadros.set(zona.id, quadro);
  return quadro;
}

function garantirDemo() {
  if (demoPronto) return;
  demoPronto = true;
  for (let i = 0; i < PROPS.length; i++) {
    const prop = PROPS[i];
    if (prop.tipo !== "placa" || !prop.texto) continue;
    demo.push({
      id: prop.id,
      x: prop.x,
      y: prop.y,
      z: 0,
      zPronto: false,
      nome: "Placa",
      linhas: [prop.texto],
    });
  }
}

function alturaDemo(item, zFallback) {
  if (item.zPronto) return;
  const h = alturaEm(item.x | 0, item.y | 0);
  if (h > 0) {
    item.z = h;
    item.zPronto = true;
    return;
  }
  item.z = zFallback;
}

function considerar(item, x, y) {
  const dx = item.x - x;
  const dy = item.y - y;
  const d = dx * dx + dy * dy;
  if (segura && item.id === segura.id && d <= SAI2) {
    busca.manteve = item;
    busca.manteveD = d;
  }
  if (d <= busca.melhorD) {
    busca.melhorD = d;
    busca.melhor = item;
  }
}

function considerarLista(lista, x, y) {
  if (!lista) return;
  for (let i = 0; i < lista.length; i++) considerar(lista[i], x, y);
}

export function placaPerto(x, y, zFallback = 0) {
  busca.melhor = null;
  busca.melhorD = ENTRA2;
  busca.manteve = null;
  busca.manteveD = Infinity;

  const local = paraLocalKanto(x, y);
  const ax = (local.x / AREA_KANTO) | 0;
  const ay = (local.y / AREA_KANTO) | 0;
  const mapa = indiceRotas();
  for (let dy = -1; dy <= 1; dy++) {
    const cy = ay + dy;
    if (cy < 0 || cy >= LADO_KANTO) continue;
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ax + dx;
      if (cx < 0 || cx >= LADO_KANTO) continue;
      considerarLista(mapa.get(cy * LADO_KANTO + cx), x, y);
    }
  }

  const zona = zonaNoMundo(x, y);
  if (zona?.tipo === "cidade" && zona.layout) considerar(quadroDa(zona), x, y);

  garantirDemo();
  for (let i = 0; i < demo.length; i++) {
    const item = demo[i];
    alturaDemo(item, zFallback);
    considerar(item, x, y);
  }

  if (busca.manteve && (!busca.melhor || busca.melhor.id === busca.manteve.id)) {
    segura = busca.manteve;
    return segura;
  }
  segura = busca.melhor;
  return segura;
}
