/** Campo: porta, enxada, regador, plantar, colher, machado e picareta. */

import { deLocalKanto, paraLocalKanto } from "../mundo/bounds.js";
import { AREA_KANTO, zonaNoMundo } from "../mundo/regiao/grafoKanto.js";
import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";
import { naSaidaSala, spawnSala } from "../mundo/cidade/sala3d.js";
import { naSaidaLaboratorio, spawnLaboratorio } from "../mundo/cidade/laboratorio.js";
import { naSaidaCentro, spawnCentro } from "../mundo/cidade/centro.js";
import { naSaidaLoja, spawnLoja } from "../mundo/cidade/loja.js";
import { atualizarStreaming } from "../mundo/voxel/storeMundo.js";
import { portaDoModelo, vaosPortaPerto } from "../mundo/cidade/cascaCasa.js";
import { faixaDaPorta, predioNoLayout, saidaDaPorta } from "../mundo/regiao/volumesCidade.js";
import { alturaEm } from "../mundo/altura.js";
import { obterBloco } from "../mundo/voxel/storeMundo.js";
import { BLOCO } from "../mundo/voxel/tiposBloco.js";
import { vegetacaoNaArea } from "../mundo/bioma/propsBioma.js";
import { ajustarItem, pokemonNoCampo } from "../pokemon/party.js";
import { executarNoProp, textoDoAcerto } from "../campo/acoes.js";
import { tickArvores } from "../campo/cicloArvore.js";
import { tickGrama } from "../campo/grama.js";
import { arbustoMaduroPerto, colherArbusto, tickBerries } from "../campo/colherBerry.js";
import { tickOrdens } from "../campo/ordem.js";
import { yawCamera } from "../render/3d/camera3d.js";
import { obterCenario3d } from "../render/3d/cenario3d.js";
import { BERRIES, FERRAMENTAS, TIPO_ITEM } from "../wild/catalogo.js";
import { ESTAGIO } from "../wild/estagios.js";
import { colher, criarSolo, plantar, regar, simularPlot } from "../wild/plots.js";
import { sfx } from "./audio.js";
import { tentarColocar, tentarQuebrar } from "./blocos.js";
import {
  contar,
  darItem,
  estado,
  gastar,
  hotbarAtivo,
  marcarQuest,
  nomeDe,
  plotEm,
  usarNoJogador,
  usarNoPokemon,
} from "./estado.js";

const PAPEIS = new Set(["casa", "loja", "centro", "lab"]);
/**
 * Frente da porta, maior que o alcance de grudar na parede.
 * Entrar ganha de escalar enquanto o corpo está nessa faixa.
 */
const RAIO_AVISO = 1.45;
/** Segura o aviso um pouco depois, pra não piscar na borda. */
const RAIO_SOLTA = 1.8;
let portaSegura = "";

export function loteSob(x, y) {
  const zona = zonaNoMundo(x, y);
  if (!zona?.layout || zona.tipo !== "cidade") return null;
  const local = paraLocalKanto(x, y);
  const ax = (local.x / AREA_KANTO) | 0;
  const ay = (local.y / AREA_KANTO) | 0;
  const lx = local.x - ax * AREA_KANTO;
  const ly = local.y - ay * AREA_KANTO;
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

function chavePorta(ax, ay, predio) {
  return `${ax}:${ay}:${predio.papel}:${predio.x0}:${predio.y0}`;
}

function dist2Retangulo(x, y, x0, y0, x1, y1) {
  const px = x < x0 ? x0 : x > x1 ? x1 : x;
  const py = y < y0 ? y0 : y > y1 ? y1 : y;
  const dx = x - px;
  const dy = y - py;
  return dx * dx + dy * dy;
}

function predioDoVao(zona, vao) {
  const volumes = zona.layout.volumes;
  for (let i = 0; i < volumes.length; i++) {
    const predio = volumes[i];
    if (predio.papel === vao.papel && predio.x0 === vao.loteX0 && predio.y0 === vao.loteY0) return predio;
  }
  return null;
}

function considerarPorta(zona, ax, ay, predio, d, estadoBusca) {
  if (!predio || !PAPEIS.has(predio.papel) || predio.porta === false) return;
  const chave = chavePorta(ax, ay, predio);
  const toque2 = RAIO_AVISO * RAIO_AVISO;
  const solta2 = RAIO_SOLTA * RAIO_SOLTA;
  if (d <= toque2 && d < estadoBusca.toqueD) {
    estadoBusca.toqueD = d;
    estadoBusca.toque = { zona, predio, ax, ay, chave };
    return;
  }
  if (chave === portaSegura && d <= solta2) {
    estadoBusca.solta = { zona, predio, ax, ay, chave };
  }
}

function fecharBusca(estadoBusca) {
  const escolhido = estadoBusca.toque || estadoBusca.solta;
  portaSegura = escolhido ? escolhido.chave : "";
  if (!escolhido) return null;
  return { zona: escolhido.zona, predio: escolhido.predio, ax: escolhido.ax, ay: escolhido.ay };
}

/** Na frente da porta, dá pra entrar. Cada contato novo vale. */
export function entradaPerto(x, y) {
  const zona = zonaNoMundo(x, y);
  if (!zona?.layout || zona.tipo !== "cidade") {
    portaSegura = "";
    return null;
  }
  const local = paraLocalKanto(x, y);
  const ax = (local.x / AREA_KANTO) | 0;
  const ay = (local.y / AREA_KANTO) | 0;
  const estadoBusca = { toque: null, toqueD: Infinity, solta: null };
  const vaos = vaosPortaPerto(x, y, RAIO_SOLTA);
  if (vaos) {
    for (let i = 0; i < vaos.length; i++) {
      const vao = vaos[i];
      considerarPorta(zona, ax, ay, predioDoVao(zona, vao), vao.d, estadoBusca);
    }
    return fecharBusca(estadoBusca);
  }
  const origem = deLocalKanto(ax * AREA_KANTO, ay * AREA_KANTO);
  const ox = origem.x;
  const oy = origem.y;
  const volumes = zona.layout.volumes;
  for (let i = 0; i < volumes.length; i++) {
    const predio = volumes[i];
    if (!PAPEIS.has(predio.papel) || predio.porta === false) continue;
    const faixa = faixaDaPorta(predio, portaDoModelo(predio.modelo));
    if (!faixa) continue;
    const d = dist2Retangulo(x, y, ox + faixa.x0, oy + faixa.y0, ox + faixa.x1, oy + faixa.y1);
    considerarPorta(zona, ax, ay, predio, d, estadoBusca);
  }
  return fecharBusca(estadoBusca);
}

export function tentarEntrar(corpo, infoPronto) {
  if (estado.interior || estado.saidaGrace > 0) return false;
  const info = infoPronto || entradaPerto(corpo.x, corpo.y);
  if (!info || info.predio.porta === false) return false;
  if (info.predio.papel === "casa") return entrarSala3d(corpo, info);
  if (info.predio.papel === "lab") return entrarLaboratorio(corpo, info);
  if (info.predio.papel === "centro") return entrarHub(corpo, info, spawnCentro(), "centro");
  if (info.predio.papel === "loja") return entrarHub(corpo, info, spawnLoja(), "loja");
  return false;
}

function entrarHub(corpo, info, spawn, papel) {
  estado.interior = {
    sala3d: true,
    papel,
    casaId: idCasa(info),
    ax: info.ax,
    ay: info.ay,
    predio: info.predio,
  };
  pousar(corpo, spawn.x, spawn.y);
  return true;
}

function entrarSala3d(corpo, info) {
  const spawn = spawnSala();
  estado.interior = {
    sala3d: true,
    papel: "casa",
    casaId: idCasa(info),
    ax: info.ax,
    ay: info.ay,
    predio: info.predio,
  };
  corpo.x = spawn.x;
  corpo.y = spawn.y;
  corpo.z = ALTURA_PRACA;
  corpo.elevacao = ALTURA_PRACA;
  corpo.vx = 0;
  corpo.vy = 0;
  corpo.vz = 0;
  corpo.noChao = true;
  corpo.hopLift = 0;
  corpo.pulando = false;
  corpo.pulo = null;
  atualizarStreaming(spawn.x, spawn.y, undefined, true);
  corpo._renasceu = true;
  estado.painel = null;
  sfx("porta");
  return true;
}

function entrarLaboratorio(corpo, info) {
  const spawn = spawnLaboratorio();
  estado.interior = {
    sala3d: true,
    papel: "lab",
    casaId: idCasa(info),
    ax: info.ax,
    ay: info.ay,
    predio: info.predio,
  };
  pousar(corpo, spawn.x, spawn.y);
  return true;
}

function pousar(corpo, x, y) {
  corpo.x = x;
  corpo.y = y;
  corpo.z = ALTURA_PRACA;
  corpo.elevacao = ALTURA_PRACA;
  corpo.vx = 0;
  corpo.vy = 0;
  corpo.vz = 0;
  corpo.noChao = true;
  corpo.hopLift = 0;
  corpo.pulando = false;
  corpo.pulo = null;
  atualizarStreaming(x, y, undefined, true);
  corpo._renasceu = true;
  estado.painel = null;
  sfx("porta");
}

export function checarSaidaSala(corpo) {
  if (!estado.interior?.sala3d) return false;
  const papel = estado.interior.papel;
  const naSaida =
    papel === "lab"
      ? naSaidaLaboratorio(corpo.x, corpo.y)
      : papel === "centro"
        ? naSaidaCentro(corpo.x, corpo.y)
        : papel === "loja"
          ? naSaidaLoja(corpo.x, corpo.y)
          : naSaidaSala(corpo.x, corpo.y);
  if (!naSaida) return false;
  sairInterior(corpo);
  return true;
}

function saidaDoPredio(interior) {
  const v = interior.predio;
  const origem = deLocalKanto(interior.ax * AREA_KANTO, interior.ay * AREA_KANTO);
  return saidaDaPorta(v, origem.x, origem.y, portaDoModelo(v.modelo));
}

export function sairInterior(corpo) {
  const interior = estado.interior;
  if (!interior) return;
  const saida = saidaDoPredio(interior);
  corpo.x = saida.x;
  corpo.y = saida.y;
  corpo.vx = 0;
  corpo.vy = 0;
  if (interior.sala3d) {
    corpo.z = ALTURA_PRACA;
    corpo.elevacao = ALTURA_PRACA;
    corpo.vz = 0;
    corpo.noChao = true;
    corpo.hopLift = 0;
    corpo.pulando = false;
    corpo.pulo = null;
    atualizarStreaming(saida.x, saida.y, undefined, true);
    corpo._renasceu = true;
  }
  estado.interior = null;
  portaSegura = "";
  estado.construir = false;
  estado.craft = false;
  estado.dialogo = null;
  estado.saidaGrace = 0.6;
  sfx("porta");
}

export function tickCampo(dt) {
  if (estado.saidaGrace > 0) estado.saidaGrace = Math.max(0, estado.saidaGrace - dt);
  const agora = Date.now();
  for (let i = 0; i < estado.plots.length; i++) simularPlot(estado.plots[i], agora);
  tickArvores(dt, agora);
  tickGrama(dt, agora);
  tickBerries(agora);
  if (!estado.ganhoAberto) tickOrdens(dt);
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
  if (plot.stage === ESTAGIO.MADURA) return "Já está madura. Clique com a berry para colher.";
  if (!regar(plot)) return "Não deu para regar.";
  sfx("cavar");
  return "Regou.";
}

export function colherSilvestre(prop) {
  const ganho = colherArbusto(prop);
  if (!ganho?.key) return "";
  darItem(TIPO_ITEM.BERRY, ganho.key, ganho.n);
  marcarQuest("berry");
  sfx("colher");
  const nome = nomeDe(TIPO_ITEM.BERRY, ganho.key);
  return ganho.n > 1 ? `Colheu ${ganho.n} ${nome}.` : `Colheu ${nome}.`;
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

function usarMachadoNo(x, y) {
  const prop = propPerto(x, y, new Set(["arvore"]));
  if (!prop) return "Nenhuma árvore no clique.";
  const resultado = executarNoProp("cortar", prop);
  return textoDoAcerto(resultado, prop) || (resultado === "acertou" ? "Cortou." : "");
}

function usarPicaretaNo(x, y) {
  const prop = propPerto(x, y, new Set(["pedra", "cristal"]));
  if (!prop) return "Nenhuma pedra no clique.";
  return textoDoAcerto(executarNoProp("minerar", prop), prop);
}

function usarConsumivel(item) {
  const slot = pokemonNoCampo();
  const mon = slot && !slot.capturado ? slot : null;
  const monPrecisa = !!(mon && (mon.morto || mon.hp < mon.hpMax || mon.status));
  if (monPrecisa && usarNoPokemon(item.tipo, item.key, mon)) {
    return `Usou ${nomeDe(item.tipo, item.key)} no ${mon.especie?.nome || "Pokémon"}.`;
  }
  if (usarNoJogador(item.tipo, item.key)) return `Usou ${nomeDe(item.tipo, item.key)} em você.`;
  if (mon && usarNoPokemon(item.tipo, item.key, mon)) {
    return `Usou ${nomeDe(item.tipo, item.key)} no ${mon.especie?.nome || "Pokémon"}.`;
  }
  return mon ? "Não teve efeito." : "Ninguém para usar.";
}

/** Clique esquerdo usa o que está selecionado na hotbar. */
export function usarNoClique(corpo, celula, alvoBloco) {
  const item = hotbarAtivo();
  const ocupaClique = item && (item.tipo === TIPO_ITEM.BLOCO || item.tipo === TIPO_ITEM.FERRAMENTA);
  if (!ocupaClique && celula && !plotEm(celula.x, celula.y)) {
    const arbusto = arbustoMaduroPerto(celula.x + 0.5, celula.y + 0.5, corpo?.z || 0);
    if (arbusto) return colherSilvestre(arbusto);
  }
  if (!item || !celula) return "";
  if (contar(item.tipo, item.key) <= 0) return "Você não tem esse item.";
  if (item.tipo === TIPO_ITEM.BLOCO) {
    if (alvoBloco && tentarColocar(corpo, alvoBloco)) return "Colocou o bloco.";
    return "Não deu para colocar o bloco.";
  }
  if (item.tipo === TIPO_ITEM.FERRAMENTA) {
    if (item.key === "pickaxe") {
      if (alvoBloco && tentarQuebrar(corpo, alvoBloco)) return "Quebrou o bloco.";
      return usarPicaretaNo(celula.x + 0.5, celula.y + 0.5);
    }
    if (item.key === "axe") return usarMachadoNo(celula.x + 0.5, celula.y + 0.5);
    if (item.key === "hoe") return usarEnxada(celula);
    if (item.key === "wateringCan") return usarRegador(celula);
    if (item.key === "hammer" && estado.interior?.papel === "casa" && !estado.interior.sala3d) {
      estado.construir = true;
      return "";
    }
    return FERRAMENTAS[item.key]?.dica || "";
  }
  if (item.tipo === TIPO_ITEM.BERRY) {
    const plantou = plantarOuColher(celula, item);
    if (plantou) return plantou;
  }
  if (item.tipo === TIPO_ITEM.BERRY || item.tipo === TIPO_ITEM.REMEDIO) return usarConsumivel(item);
  return "";
}

function usarMachado(corpo) {
  return usarMachadoNo(corpo.x, corpo.y);
}

function usarPicareta(corpo) {
  return usarPicaretaNo(corpo.x, corpo.y);
}

export function dicaFerramenta() {
  const item = estado.hotbar[estado.slotAtivo];
  if (!item || contar(item.tipo, item.key) <= 0) return "";
  if (item.tipo === TIPO_ITEM.FERRAMENTA) return FERRAMENTAS[item.key]?.dica || "";
  if (item.tipo === TIPO_ITEM.BLOCO) return "Clique esquerdo coloca na face mirada. Equipe pela hotbar ou roda.";
  if (item.tipo === TIPO_ITEM.BERRY) return "Clique esquerdo usa ou planta. Em solo cavado, planta.";
  if (item.tipo === TIPO_ITEM.REMEDIO) return "Clique esquerdo usa no Pokémon, ou em você se ele não precisar.";
  if (item.tipo === TIPO_ITEM.BOLA) return "A mira segue o cursor até o anel. Segure e solte para arremessar.";
  return "";
}
