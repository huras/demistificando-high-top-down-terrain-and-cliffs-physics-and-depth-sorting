/** Campo: porta, enxada, regador, plantar, colher, machado e picareta. */

import { AREA_KANTO, zonaNoMundo } from "../mundo/regiao/grafoKanto.js";
import { faixaDaPorta, predioNoLayout, saidaDaPorta } from "../mundo/regiao/volumesCidade.js";
import { alturaEm } from "../mundo/altura.js";
import { obterBloco, avisarDirty } from "../mundo/voxel/storeMundo.js";
import { BLOCO } from "../mundo/voxel/tiposBloco.js";
import { vegetacaoNaArea } from "../mundo/bioma/propsBioma.js";
import { ajustarItem } from "../pokemon/party.js";
import { yawCamera } from "../render/3d/camera3d.js";
import { obterCenario3d } from "../render/3d/cenario3d.js";
import { BERRIES, CRISTAIS, FERRAMENTAS, TIPO_ITEM } from "../wild/catalogo.js";
import { ESTAGIO } from "../wild/estagios.js";
import { colher, criarSolo, plantar, regar, simularPlot } from "../wild/plots.js";
import { criarSala } from "../wild/salas.js";
import { sfx } from "./audio.js";
import {
  contar,
  darItem,
  estado,
  gastar,
  marcarQuest,
  nomeDe,
  plotEm,
} from "./estado.js";

const PAPEIS = new Set(["casa", "loja", "centro"]);

export function loteSob(x, y) {
  const zona = zonaNoMundo(x, y);
  if (!zona?.layout || zona.tipo !== "cidade") return null;
  const ax = (x / AREA_KANTO) | 0;
  const ay = (y / AREA_KANTO) | 0;
  const lx = x - ax * AREA_KANTO;
  const ly = y - ay * AREA_KANTO;
  const predio = predioNoLayout(lx, ly, zona.layout);
  if (!predio || !PAPEIS.has(predio.papel)) return null;
  return { zona, predio, ax, ay };
}

export function idCasa(info) {
  if (!info) return "";
  const v = info.predio;
  return `${info.zona.key}:${v.papel}:${v.x0}:${v.y0}`;
}

function gramaLivre(x, y) {
  const ix = x | 0;
  const iy = y | 0;
  if (loteSob(ix + 0.5, iy + 0.5)) return false;
  const z = alturaEm(ix, iy);
  if (obterBloco(ix, iy, z) !== BLOCO.GRAMA) return false;
  const props = vegetacaoNaArea(ix, iy, ix + 1, iy + 1);
  for (let i = 0; i < props.length; i++) {
    if (props[i].oculto) continue;
    if (Math.floor(props[i].x) === ix && Math.floor(props[i].y) === iy) return false;
  }
  return true;
}

export function celulaAlvo(corpo) {
  let dx = corpo.vx || 0;
  let dy = corpo.vy || 0;
  if (Math.hypot(dx, dy) < 0.08) {
    const cam = obterCenario3d()?.camera3d;
    const yaw = cam ? yawCamera(cam) : 0;
    dx = Math.sin(yaw);
    dy = Math.cos(yaw);
  }
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: Math.floor(corpo.x + (dx / len) * 1.25),
    y: Math.floor(corpo.y + (dy / len) * 1.25),
  };
}

function naPortaFrente(info, x, y) {
  const faixa = faixaDaPorta(info.predio);
  if (!faixa) return false;
  const ox = info.ax * AREA_KANTO;
  const oy = info.ay * AREA_KANTO;
  return x >= ox + faixa.x0 && x < ox + faixa.x1 && y >= oy + faixa.y0 && y < oy + faixa.y1;
}

export function tentarEntrar(corpo) {
  if (estado.interior || estado.saidaGrace > 0) return false;
  const info = loteSob(corpo.x, corpo.y);
  if (!info || info.predio.porta === false) return false;
  if (!naPortaFrente(info, corpo.x, corpo.y)) return false;
  const sala = criarSala(info.predio.papel);
  if (!sala) return false;
  estado.interior = {
    sala,
    papel: info.predio.papel,
    casaId: idCasa(info),
    ax: info.ax,
    ay: info.ay,
    predio: info.predio,
    px: sala.spawn.x + 0.5,
    py: sala.spawn.y + 0.5,
  };
  estado.painel = null;
  sfx("porta");
  return true;
}

function saidaDoPredio(interior) {
  const v = interior.predio;
  const ox = interior.ax * AREA_KANTO;
  const oy = interior.ay * AREA_KANTO;
  return saidaDaPorta(v, ox, oy);
}

export function sairInterior(corpo) {
  const interior = estado.interior;
  if (!interior) return;
  const saida = saidaDoPredio(interior);
  corpo.x = saida.x;
  corpo.y = saida.y;
  corpo.vx = 0;
  corpo.vy = 0;
  estado.interior = null;
  estado.construir = false;
  estado.craft = false;
  estado.dialogo = null;
  estado.saidaGrace = 0.6;
  sfx("porta");
}

let corteAcum = 0;

export function tickCampo(dt) {
  if (estado.saidaGrace > 0) estado.saidaGrace = Math.max(0, estado.saidaGrace - dt);
  const agora = Date.now();
  for (let i = 0; i < estado.plots.length; i++) simularPlot(estado.plots[i], agora);
  corteAcum += dt;
  if (estado.cortados.length && corteAcum >= 0.4) {
    corteAcum = 0;
    aplicarCortes();
  }
}

function aplicarCortes() {
  if (!estado.cortados.length) return;
  const conjunto = new Set(estado.cortados);
  const props = vegetacaoNaArea(-1e9, -1e9, 1e9, 1e9);
  let mudou = false;
  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    if (!p.oculto && conjunto.has(p.id)) {
      p.oculto = true;
      mudou = true;
    }
  }
  if (mudou) avisarDirty();
}

function propPerto(x, y, tipos) {
  const props = vegetacaoNaArea(x - 2, y - 2, x + 2, y + 2);
  let melhor = null;
  let dist = 1.6;
  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    if (p.oculto || !tipos.has(p.tipo)) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < dist) {
      dist = d;
      melhor = p;
    }
  }
  return melhor;
}

export function usarFerramenta(corpo) {
  const item = estado.hotbar[estado.slotAtivo];
  if (!item || item.tipo !== TIPO_ITEM.FERRAMENTA) return "Segure uma ferramenta na roda (Tab).";
  if (contar(item.tipo, item.key) <= 0) return "Você não tem essa ferramenta.";
  const alvo = celulaAlvo(corpo);
  if (item.key === "hoe") return usarEnxada(alvo);
  if (item.key === "wateringCan") return usarRegador(alvo);
  if (item.key === "axe") return usarMachado(corpo);
  if (item.key === "pickaxe") return usarPicareta(corpo);
  if (item.key === "hammer") return "O martelo abre o catálogo dentro de casa.";
  return "";
}

function usarEnxada(alvo) {
  if (plotEm(alvo.x, alvo.y)) return "Aqui já tem canteiro.";
  if (!gramaLivre(alvo.x, alvo.y)) return "A enxada só cava grama livre, fora dos prédios.";
  estado.plots.push(criarSolo(alvo.x, alvo.y));
  sfx("cavar");
  darFibra();
  return "Solo preparado.";
}

function darFibra() {
  if (Math.random() < 0.5) ajustarItem("plantFiber", 1);
}

function usarRegador(alvo) {
  const plot = plotEm(alvo.x, alvo.y);
  if (!plot || plot.stage === ESTAGIO.SOLO) return "Não há planta para regar.";
  if (plot.stage === ESTAGIO.MADURA) return "Já está madura. Colha com a berry na mão, ou use R sem ferramenta.";
  if (!regar(plot)) return "Não deu para regar.";
  sfx("cavar");
  return "Regou.";
}

export function plantarOuColher(alvo, item) {
  const plot = plotEm(alvo.x, alvo.y);
  if (!plot) return "";
  if (plot.stage === ESTAGIO.MADURA) {
    const key = colher(plot);
    if (!key) return "";
    darItem(TIPO_ITEM.BERRY, key, 2 + Math.floor(Math.random() * 2));
    marcarQuest("berry");
    sfx("colher");
    return `Colheu ${nomeDe(TIPO_ITEM.BERRY, key)}.`;
  }
  if (plot.stage === ESTAGIO.SOLO && item?.tipo === TIPO_ITEM.BERRY && BERRIES[item.key]) {
    if (!gastar(TIPO_ITEM.BERRY, item.key, 1)) return "Sem berry para plantar.";
    plantar(plot, item.key);
    sfx("cavar");
    return `Plantou ${BERRIES[item.key].nome}.`;
  }
  return "";
}

function usarMachado(corpo) {
  const prop = propPerto(corpo.x, corpo.y, new Set(["arvore"]));
  if (!prop) return "Nenhuma árvore por perto.";
  prop.oculto = true;
  if (!estado.cortados.includes(prop.id)) estado.cortados.push(prop.id);
  ajustarItem("wood", 2 + Math.floor(Math.random() * 2));
  avisarDirty();
  sfx("cavar");
  return "Madeira obtida.";
}

function usarPicareta(corpo) {
  const prop = propPerto(corpo.x, corpo.y, new Set(["pedra", "cristal"]));
  if (!prop) return "Nenhuma pedra por perto.";
  prop.oculto = true;
  if (!estado.cortados.includes(prop.id)) estado.cortados.push(prop.id);
  if (prop.tipo === "cristal") {
    const key = CRISTAIS[Math.floor(Math.random() * CRISTAIS.length)];
    ajustarItem(key, 1);
  } else {
    ajustarItem("stone", 2);
  }
  avisarDirty();
  sfx("cavar");
  return prop.tipo === "cristal" ? "Cristal obtido." : "Pedra obtida.";
}

export function dicaFerramenta() {
  const item = estado.hotbar[estado.slotAtivo];
  if (!item) return "";
  if (item.tipo === TIPO_ITEM.FERRAMENTA) return FERRAMENTAS[item.key]?.dica || "";
  if (item.tipo === TIPO_ITEM.BLOCO) return "Botão direito coloca o bloco.";
  if (item.tipo === TIPO_ITEM.BERRY) return "R usa no Pokémon ou em você. Em solo cavado, planta.";
  if (item.tipo === TIPO_ITEM.REMEDIO) return "R usa no Pokémon, ou em você se ele não precisar.";
  return "";
}
