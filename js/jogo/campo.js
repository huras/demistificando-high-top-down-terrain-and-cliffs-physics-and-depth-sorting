/** Campo: porta, enxada, regador, plantar, colher, machado e picareta. */

import { ALCANCE_CONSTRUIR, RAIO_STREAM_BOLSO } from "../config.js";
import { deLocalKanto, dentroDoBolsoSala, paraLocalKanto } from "../mundo/bounds.js";
import { AREA_KANTO, zonaNoMundo } from "../mundo/regiao/grafoKanto.js";
import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";
import { naSaidaSala, spawnSala } from "../mundo/cidade/sala3d.js";
import { naSaidaLaboratorio, spawnLaboratorio } from "../mundo/cidade/laboratorio.js";
import { naSaidaCentro, spawnCentro } from "../mundo/cidade/centro.js";
import { naSaidaLoja, spawnLoja } from "../mundo/cidade/loja.js";
import { naSaidaGinasio, spawnGinasio } from "../mundo/cidade/ginasio.js";
import { naSaidaMansao, spawnMansao } from "../mundo/cidade/mansao.js";
import {
  ANDARES_CONDOMINIO,
  naSaidaCondominio,
  plantaCondominio,
  spawnCondominio,
} from "../mundo/cidade/condominio.js";
import { definirLayoutSala, definirMoveisJogador } from "../mundo/cidade/interiorCasa.js";
import {
  atualizarStreaming,
  atualizarStreamingDuplo,
  obterRaioStream,
} from "../mundo/voxel/storeMundo.js";
import { portaDoModelo, vaosPortaPerto } from "../mundo/cidade/cascaCasa.js";
import { faixaDaPorta, predioNoLayout, saidaDaPorta } from "../mundo/regiao/volumesCidade.js";
import { alturaEm } from "../mundo/altura.js";
import { obterBloco } from "../mundo/voxel/storeMundo.js";
import { BLOCO } from "../mundo/voxel/tiposBloco.js";
import { superficieDoRelevo } from "../mundo/bioma/catalogo.js";
import { ALCANCE_COLHER } from "../mundo/bioma/berriesBioma.js";
import { vegetacaoNaArea } from "../mundo/bioma/propsBioma.js";
import { ajustarItem, pokemonNoCampo } from "../pokemon/party.js";
import { executarNoProp, textoDoAcerto } from "../campo/acoes.js";
import { tickArvores } from "../campo/cicloArvore.js";
import { confirmar, preparar, FASE } from "../campo/estadoProps.js";
import { tickGrama } from "../campo/grama.js";
import { arbustoMaduroPerto, colherArbusto, tickBerries } from "../campo/colherBerry.js";
import { tickOrdens } from "../campo/ordem.js";
import { tickOrdensForca } from "../forca/tickOrdensForca.js";
import { yawCamera } from "../render/3d/camera3d.js";
import { obterCenario3d } from "../render/3d/cenario3d.js";
import { teclaBaixa } from "../entrada/teclado.js";
import { BERRIES, FERRAMENTAS, TIPO_ITEM, defItem } from "../wild/catalogo.js";
import { ESTAGIO } from "../wild/estagios.js";
import { lerMixClima } from "../render/3d/ceu/clima.js";
import { colher, criarSolo, molharPorChuva, plantar, regar, simularPlot } from "../wild/plots.js";
import { sfx } from "./audio.js";
import { sairArmazem } from "../historia/warehouses/entrar.js";
import { onGiovanniGymCleared } from "../historia/warehouses/overhear.js";
import { iniciarPortaTransicao, portaOcupada } from "./portaTransicao.js";
import { emAlcanceEdicao } from "../mundo/voxel/editar.js";
import { tentarColocar, tentarQuebrar } from "./blocos.js";
import {
  acharCasa,
  buildMode as modoBuild,
  casasPerto,
  iniciarRitual,
  mensagemFalha,
  plantarBandeira,
  temSelecaoConstruir,
  temClaim,
  toggleCatalogoConstruir,
  alvoDemolirPerto,
  acertarDemolicao,
  obterPreview,
} from "../construir/indice.js";
import { edificiosSitePerto } from "../mundo/sites/colocacao.js";
import { atualizarCatalogoConstruir } from "../ui/construirCatalogoHud.js";
import { definirMiraConstrucao, miraConstrucao } from "../construir/tick.js";
import { ordenarRitualConstrucao } from "../construir/ordemRitual.js";
import { clampMiraConstrucao, emAlcanceConstrucao } from "../construir/mira.js";
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
import {
  checarSaidaSantuario,
  restaurarSantuarioSalvo,
  sairSantuario,
} from "../santuario/entrar.js";
import { checarSaidaCaverna, restaurarCavernaSalva } from "../caverna/entrar.js";
import { aoEntrarCasa, aoSairInterior } from "../npc/index.js";

const PAPEIS = new Set(["casa", "loja", "centro", "lab", "ginasio", "mansao", "condominio"]);
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
  if (info.playerHouse?.id) return `player-${info.playerHouse.id}`;
  if (info.predio?.playerHouseId) return `player-${info.predio.playerHouseId}`;
  if (info.siteCasa?.id) return `site-${info.siteCasa.id}`;
  if (info.predio?.siteCasaId) return `site-${info.predio.siteCasaId}`;
  const v = info.predio;
  const zonaKey = info.zona?.key || "campo";
  return `${zonaKey}:${v.papel}:${v.x0 ?? v.x}:${v.y0 ?? v.y}`;
}

function gramaLivre(x, y) {
  const ix = x | 0;
  const iy = y | 0;
  if (loteSob(ix + 0.5, iy + 0.5)) return false;
  // alturaEm = face caminhável (topo sólido + 1); o bloco cavável está em z-1.
  const zBloco = (alturaEm(ix, iy) | 0) - 1;
  if (zBloco < 0) return false;
  const id = obterBloco(ix, iy, zBloco);
  // Gen antigo deixava TERRA no topo de bioma de grama; aceita os dois.
  if (id !== BLOCO.GRAMA && !(id === BLOCO.TERRA && superficieDoRelevo(ix, iy) === BLOCO.GRAMA)) {
    return false;
  }
  const props = vegetacaoNaArea(ix, iy, ix + 1, iy + 1);
  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    if (p.oculto || p.fase === FASE.REMOVIDO) continue;
    // Tufo de grama/mato some com a enxada; árvore/pedra/berry bloqueiam.
    if (p.tipo === "grama" || p.tipo === "mata") continue;
    if (Math.floor(p.x) === ix && Math.floor(p.y) === iy) return false;
  }
  return true;
}

function limparGramaNoCanteiro(ix, iy) {
  const props = vegetacaoNaArea(ix, iy, ix + 1, iy + 1);
  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    if (p.oculto || (p.tipo !== "grama" && p.tipo !== "mata")) continue;
    if (Math.floor(p.x) !== ix || Math.floor(p.y) !== iy) continue;
    preparar(p);
    p.fase = FASE.REMOVIDO;
    p.hp = 0;
    confirmar(p);
  }
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

/** Porta sintética (frente sul da pegada, coords mundo). */
function predioPortaSul(opts) {
  const cols = opts.cols || 6;
  const rows = opts.rows || 5;
  const x0 = opts.x - cols / 2;
  const y0 = opts.y - rows / 2;
  const x1 = x0 + cols;
  const y1 = y0 + rows;
  return {
    papel: "casa",
    modelo: opts.modelo,
    porta: true,
    x0,
    y0,
    x1,
    y1,
    x: x0,
    y: y0,
    w: cols,
    h: rows,
    ...opts.extra,
  };
}

function portaSulDe(h) {
  const rows = h.rows || 5;
  return { x: h.x, y: h.y + rows * 0.5 + 0.35 };
}

/** Porta sintética de casa do jogador (frente sul da pegada, coords mundo). */
function entradaCasaJogador(x, y) {
  const casas = casasPerto(x, y, 10);
  let melhor = null;
  let melhorD = 2.4 * 2.4;
  for (const h of casas) {
    if (!h.enterable) continue;
    const porta = portaSulDe(h);
    const dx = x - porta.x;
    const dy = y - porta.y;
    const d = dx * dx + dy * dy;
    if (d < melhorD) {
      melhorD = d;
      melhor = h;
    }
  }
  if (!melhor) return null;
  return {
    // ax/ay não se aplicam — saída usa outdoorX/Y ou a pegada mundo.
    ax: null,
    ay: null,
    predio: predioPortaSul({
      x: melhor.x,
      y: melhor.y,
      cols: melhor.cols,
      rows: melhor.rows,
      modelo: melhor.buildingId,
      extra: {
        playerHouseId: melhor.id,
        casaJogador: true,
      },
    }),
    playerHouse: melhor,
  };
}

/** Porta sintética de casa/farol de sítio outdoor. */
function entradaCasaSite(x, y) {
  const casas = edificiosSitePerto(x, y, 10);
  let melhor = null;
  let melhorD = 2.4 * 2.4;
  for (let i = 0; i < casas.length; i++) {
    const h = casas[i];
    const porta = portaSulDe(h);
    const dx = x - porta.x;
    const dy = y - porta.y;
    const d = dx * dx + dy * dy;
    if (d < melhorD) {
      melhorD = d;
      melhor = h;
    }
  }
  if (!melhor) return null;
  return {
    ax: null,
    ay: null,
    predio: predioPortaSul({
      x: melhor.x,
      y: melhor.y,
      cols: melhor.cols,
      rows: melhor.rows,
      modelo: melhor.modelo,
      extra: {
        siteCasaId: melhor.id,
        casaSite: true,
      },
    }),
    siteCasa: melhor,
  };
}

/** Saída em coords mundo (sul da pegada), sem origem de área Kanto. */
function saidaCasaJogador(interior) {
  if (Number.isFinite(interior?.outdoorX) && Number.isFinite(interior?.outdoorY)) {
    return {
      x: interior.outdoorX,
      y: interior.outdoorY,
      z: Number.isFinite(interior.outdoorZ) ? interior.outdoorZ : ALTURA_PRACA,
    };
  }
  const v = interior?.predio;
  if (!v) return { x: 0, y: 0, z: ALTURA_PRACA };
  const x0 = Number.isFinite(v.x0) ? v.x0 : v.x || 0;
  const y0 = Number.isFinite(v.y0) ? v.y0 : v.y || 0;
  const x1 = Number.isFinite(v.x1) ? v.x1 : x0 + (v.w || 6);
  const y1 = Number.isFinite(v.y1) ? v.y1 : y0 + (v.h || 5);
  return {
    x: (x0 + x1) * 0.5,
    y: y1 + 1.15,
    z: ALTURA_PRACA,
  };
}

/** Na frente da porta, dá pra entrar. Cada contato novo vale. */
export function entradaPerto(x, y) {
  const casaPlayer = entradaCasaJogador(x, y);
  if (casaPlayer) {
    portaSegura = casaPlayer.playerHouse.id;
    return casaPlayer;
  }
  const casaSite = entradaCasaSite(x, y);
  if (casaSite) {
    portaSegura = casaSite.siteCasa.id;
    return casaSite;
  }
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
  if (estado.interior || estado.saidaGrace > 0 || portaOcupada()) return false;
  const info = infoPronto || entradaPerto(corpo.x, corpo.y);
  if (!info || info.predio.porta === false) return false;
  const papel = info.predio.papel;
  if (
    papel !== "casa" &&
    papel !== "lab" &&
    papel !== "centro" &&
    papel !== "loja" &&
    papel !== "ginasio" &&
    papel !== "mansao" &&
    papel !== "condominio"
  ) {
    return false;
  }
  return iniciarPortaTransicao(corpo, "enter", () => {
    if (papel === "casa") entrarSala3d(corpo, info);
    else if (papel === "lab") entrarLaboratorio(corpo, info);
    else if (papel === "centro") entrarHub(corpo, info, spawnCentro(), "centro");
    else if (papel === "loja") entrarHub(corpo, info, spawnLoja(), "loja");
    else if (papel === "ginasio") entrarHub(corpo, info, spawnGinasio(), "ginasio");
    else if (papel === "condominio") entrarCondominio(corpo, info, 0);
    else entrarHub(corpo, info, spawnMansao(), "mansao");
  });
}

function ancorarOutdoor(interior, corpo) {
  interior.outdoorX = corpo.x;
  interior.outdoorY = corpo.y;
  interior.outdoorZ = corpo.z ?? ALTURA_PRACA;
}

function streamEntradaBolso(corpo, x, y) {
  const ox = estado.interior?.outdoorX;
  const oy = estado.interior?.outdoorY;
  if (Number.isFinite(ox) && Number.isFinite(oy)) {
    const raioBolso =
      estado.interior?.papel === "santuario" ? obterRaioStream() : RAIO_STREAM_BOLSO;
    atualizarStreamingDuplo(ox, oy, x, y, obterRaioStream(), true, raioBolso);
  } else {
    atualizarStreaming(x, y, undefined, true);
  }
}

/** Outdoor fica quente; só solta o bolso em background. */
function streamSaidaBolso(x, y) {
  atualizarStreaming(x, y, undefined, false);
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
  ancorarOutdoor(estado.interior, corpo);
  pousar(corpo, spawn.x, spawn.y);
  return true;
}

function entrarCondominio(corpo, info, andar = 0, opts = {}) {
  const floorIndex = Math.max(0, Math.min(ANDARES_CONDOMINIO - 1, andar | 0));
  const spawn = spawnCondominio(floorIndex);
  estado.interior = {
    sala3d: true,
    papel: "condominio",
    casaId: idCasa(info),
    ax: info.ax,
    ay: info.ay,
    predio: info.predio,
    floorIndex,
  };
  if (opts.manterOutdoor && Number.isFinite(opts.outdoorX) && Number.isFinite(opts.outdoorY)) {
    estado.interior.outdoorX = opts.outdoorX;
    estado.interior.outdoorY = opts.outdoorY;
    estado.interior.outdoorZ = opts.outdoorZ;
  } else {
    ancorarOutdoor(estado.interior, corpo);
  }
  pousar(corpo, spawn.x, spawn.y);
  if (!opts.silencio) {
    estado.itemGet =
      floorIndex === 0
        ? "Condomínios de Celadon"
        : `Condomínios de Celadon — andar ${floorIndex + 1}`;
  }
  return true;
}

export function trocarAndarCondominio(corpo, dir) {
  const int = estado.interior;
  if (int?.papel !== "condominio") return false;
  const next = (int.floorIndex | 0) + (dir > 0 ? 1 : -1);
  if (next < 0 || next >= ANDARES_CONDOMINIO) return false;
  const planta = plantaCondominio(next);
  let spawn = spawnCondominio(next);
  // Spawna longe do gatilho oposto pra não oscilar entre andares.
  if (dir > 0 && planta.stairsDown) {
    spawn = {
      x: planta.origemX + planta.stairsDown.x,
      y: planta.origemY + planta.stairsDown.y - 1.6,
      z: ALTURA_PRACA,
    };
  } else if (dir < 0 && planta.stairsUp) {
    spawn = {
      x: planta.origemX + planta.stairsUp.x,
      y: planta.origemY + planta.stairsUp.y - 1.6,
      z: ALTURA_PRACA,
    };
  }
  int.floorIndex = next;
  pousar(corpo, spawn.x, spawn.y, { silencio: true });
  estado.itemGet = `Condomínios de Celadon — andar ${next + 1}`;
  sfx("porta");
  return true;
}

export function entrarApartamentoCondominio(corpo, alvo) {
  const int = estado.interior;
  if (int?.papel !== "condominio" || !alvo?.casaId) return false;
  const casaId = alvo.casaId;
  definirLayoutSala(casaId);
  definirMoveisJogador(estado.moveis[casaId] || []);
  const spawn = spawnSala();
  estado.interior = {
    sala3d: true,
    papel: "casa",
    casaId,
    ax: int.ax,
    ay: int.ay,
    predio: int.predio,
    outdoorX: int.outdoorX,
    outdoorY: int.outdoorY,
    outdoorZ: int.outdoorZ,
    condominioRetorno: {
      floorIndex: int.floorIndex | 0,
      ax: int.ax,
      ay: int.ay,
      predio: int.predio,
      outdoorX: int.outdoorX,
      outdoorY: int.outdoorY,
      outdoorZ: int.outdoorZ,
      casaId: int.casaId,
    },
  };
  aoEntrarCasa(casaId);
  pousar(corpo, spawn.x, spawn.y);
  estado.itemGet = alvo.nome || "Apartamento";
  return true;
}

function entrarSala3d(corpo, info) {
  const spawn = spawnSala();
  const casaId = info.playerHouse
    ? `player-${info.playerHouse.id}`
    : idCasa(info);
  definirLayoutSala(casaId);
  definirMoveisJogador(estado.moveis[casaId] || []);
  estado.interior = {
    sala3d: true,
    papel: "casa",
    casaId,
    ax: info.ax,
    ay: info.ay,
    predio: info.predio,
    playerHouseId: info.playerHouse?.id || null,
  };
  ancorarOutdoor(estado.interior, corpo);
  aoEntrarCasa(casaId);
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
  streamEntradaBolso(corpo, spawn.x, spawn.y);
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
  ancorarOutdoor(estado.interior, corpo);
  pousar(corpo, spawn.x, spawn.y);
  return true;
}

function pousar(corpo, x, y, opts = {}) {
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
  streamEntradaBolso(corpo, x, y);
  corpo._renasceu = true;
  estado.painel = null;
  if (!opts.silencio) sfx("porta");
}

function spawnPadraoDoPapel(papel, floorIndex = 0) {
  if (papel === "lab") return spawnLaboratorio();
  if (papel === "centro") return spawnCentro();
  if (papel === "loja") return spawnLoja();
  if (papel === "ginasio") return spawnGinasio();
  if (papel === "mansao") return spawnMansao();
  if (papel === "condominio") return spawnCondominio(floorIndex);
  return spawnSala();
}

function aplicarFacingLocal(corpo, local) {
  if (!local) return;
  if (Number.isFinite(local.facing)) corpo.facing = local.facing | 0;
  if (Number.isFinite(local.dirX)) corpo.dirX = local.dirX;
  if (Number.isFinite(local.dirY)) corpo.dirY = local.dirY;
}

/**
 * Depois do boot: se o save estava dentro de um lugar, recoloca no bolso.
 * @param {object} corpo
 */
export function restaurarInteriorSalvo(corpo) {
  const snap = estado.interiorSalvo;
  estado.interiorSalvo = null;
  if (!corpo || !snap?.sala3d || !snap.papel) return false;

  const local = estado.posicaoInterior;
  if (snap.papel === "santuario") {
    const ok = restaurarSantuarioSalvo(corpo, snap, local);
    if (!ok) estado.posicaoInterior = null;
    return ok;
  }
  if (snap.papel === "caverna") {
    const ok = restaurarCavernaSalva(corpo, snap, local);
    if (!ok) estado.posicaoInterior = null;
    return ok;
  }

  if (
    Number.isFinite(snap.outdoorX) &&
    Number.isFinite(snap.outdoorY)
  ) {
    // outdoor já é a âncora do stream; garante no snap interior
  } else if (snap.playerHouseId) {
    const casa = acharCasa(snap.playerHouseId);
    if (!casa) {
      estado.posicaoInterior = null;
      return false;
    }
    const porta = {
      x: casa.x,
      y: casa.y + (casa.rows || 5) * 0.5 + 1.15,
      z: Number.isFinite(casa.z) ? casa.z : ALTURA_PRACA,
    };
    snap.outdoorX = porta.x;
    snap.outdoorY = porta.y;
    snap.outdoorZ = porta.z;
  } else if (!snap.predio) {
    estado.posicaoInterior = null;
    return false;
  }

  if (snap.papel === "casa") {
    if (snap.playerHouseId && !acharCasa(snap.playerHouseId)) {
      estado.posicaoInterior = null;
      return false;
    }
    const casaId = snap.casaId || (snap.playerHouseId ? `player-${snap.playerHouseId}` : "");
    if (!casaId) {
      estado.posicaoInterior = null;
      return false;
    }
    definirLayoutSala(casaId);
    definirMoveisJogador(estado.moveis[casaId] || []);
    estado.interior = {
      sala3d: true,
      papel: "casa",
      casaId,
      ax: snap.ax,
      ay: snap.ay,
      predio: snap.predio || null,
      playerHouseId: snap.playerHouseId || null,
      outdoorX: snap.outdoorX,
      outdoorY: snap.outdoorY,
      outdoorZ: snap.outdoorZ,
      condominioRetorno: snap.condominioRetorno || null,
    };
    aoEntrarCasa(casaId);
    const spawn = spawnSala();
    const x = local && dentroDoBolsoSala(local.x, local.y) ? local.x : spawn.x;
    const y = local && dentroDoBolsoSala(local.x, local.y) ? local.y : spawn.y;
    pousar(corpo, x, y, { silencio: true });
    aplicarFacingLocal(corpo, local);
    return true;
  }

  const hubs = new Set(["lab", "centro", "loja", "ginasio", "mansao", "condominio"]);
  if (!hubs.has(snap.papel)) {
    estado.posicaoInterior = null;
    return false;
  }

  estado.interior = {
    sala3d: true,
    papel: snap.papel,
    casaId: snap.casaId || "",
    ax: snap.ax,
    ay: snap.ay,
    predio: snap.predio || null,
    outdoorX: snap.outdoorX,
    outdoorY: snap.outdoorY,
    outdoorZ: snap.outdoorZ,
    floorIndex: snap.floorIndex | 0,
  };
  const spawn = spawnPadraoDoPapel(snap.papel, snap.floorIndex | 0);
  const x = local && dentroDoBolsoSala(local.x, local.y) ? local.x : spawn.x;
  const y = local && dentroDoBolsoSala(local.x, local.y) ? local.y : spawn.y;
  pousar(corpo, x, y, { silencio: true });
  aplicarFacingLocal(corpo, local);
  return true;
}

export function checarSaidaSala(corpo) {
  if (!estado.interior?.sala3d || portaOcupada()) return false;
  const papel = estado.interior.papel;
  if (papel === "santuario") {
    return checarSaidaSantuario(corpo);
  }
  if (papel === "caverna") {
    return checarSaidaCaverna(corpo);
  }
  if (papel === "condominio") {
    const andar = estado.interior.floorIndex | 0;
    if (naSaidaCondominio(corpo.x, corpo.y, andar)) {
      return iniciarPortaTransicao(corpo, "exit", () => sairInterior(corpo));
    }
    return false;
  }
  if (papel === "casa" && estado.interior.condominioRetorno) {
    if (!naSaidaSala(corpo.x, corpo.y)) return false;
    return iniciarPortaTransicao(corpo, "exit", () => {
      const ret = estado.interior.condominioRetorno;
      aoSairInterior();
      entrarCondominio(
        corpo,
        { ax: ret.ax, ay: ret.ay, predio: ret.predio },
        ret.floorIndex,
        {
          silencio: true,
          manterOutdoor: true,
          outdoorX: ret.outdoorX,
          outdoorY: ret.outdoorY,
          outdoorZ: ret.outdoorZ,
        },
      );
      estado.interior.casaId = ret.casaId;
    });
  }
  const naSaida =
    papel === "lab"
      ? naSaidaLaboratorio(corpo.x, corpo.y)
      : papel === "centro"
        ? naSaidaCentro(corpo.x, corpo.y)
        : papel === "loja"
          ? naSaidaLoja(corpo.x, corpo.y)
          : papel === "ginasio"
            ? naSaidaGinasio(corpo.x, corpo.y)
            : papel === "mansao"
              ? naSaidaMansao(corpo.x, corpo.y)
              : naSaidaSala(corpo.x, corpo.y);
  if (!naSaida) return false;
  return iniciarPortaTransicao(corpo, "exit", () => sairInterior(corpo));
}

/** Escadas por proximidade (mesmo padrão do armazém Rocket). */
export function checarEscadasCondominio(corpo) {
  const int = estado.interior;
  if (int?.papel !== "condominio" || portaOcupada()) return;
  const planta = plantaCondominio(int.floorIndex | 0);
  const ox = planta.origemX;
  const oy = planta.origemY;
  if (planta.stairsUp) {
    const sx = ox + planta.stairsUp.x;
    const sy = oy + planta.stairsUp.y;
    if (Math.hypot(corpo.x - sx, corpo.y - sy) < 1.3) trocarAndarCondominio(corpo, 1);
  }
  if (planta.stairsDown) {
    const sx = ox + planta.stairsDown.x;
    const sy = oy + planta.stairsDown.y;
    if (Math.hypot(corpo.x - sx, corpo.y - sy) < 1.3) trocarAndarCondominio(corpo, -1);
  }
}

function saidaDoPredio(interior) {
  if (
    interior?.playerHouseId ||
    interior?.predio?.casaJogador ||
    interior?.predio?.casaSite ||
    interior?.predio?.siteCasaId
  ) {
    return saidaCasaJogador(interior);
  }
  const v = interior.predio;
  const origem = deLocalKanto(interior.ax * AREA_KANTO, interior.ay * AREA_KANTO);
  return saidaDaPorta(v, origem.x, origem.y, portaDoModelo(v.modelo));
}

export function sairInterior(corpo) {
  const interior = estado.interior;
  if (!interior) return;
  if (interior.papel === "santuario") {
    sairSantuario(corpo);
    return;
  }
  if (interior.papel === "caverna") return;
  if (interior.papel === "armazem") {
    sairArmazem(corpo);
    return;
  }
  const eraGinasioViridian =
    interior.papel === "ginasio" && (interior.ax | 0) === 10 && (interior.ay | 0) === 11;
  const saida = saidaDoPredio(interior);
  corpo.x = saida.x;
  corpo.y = saida.y;
  corpo.vx = 0;
  corpo.vy = 0;
  if (interior.sala3d) {
    const zOut = Number.isFinite(saida.z) ? saida.z : ALTURA_PRACA;
    corpo.z = zOut;
    corpo.elevacao = zOut;
    corpo.vz = 0;
    corpo.noChao = true;
    corpo.hopLift = 0;
    corpo.pulando = false;
    corpo.pulo = null;
    // Outdoor já ficou ancorado durante a visita — sem rebuild sync.
    streamSaidaBolso(saida.x, saida.y);
    corpo._renasceu = true;
  }
  estado.interior = null;
  aoSairInterior();
  portaSegura = "";
  estado.construir = false;
  estado.craft = false;
  estado.dialogo = null;
  estado.saidaGrace = 0.6;
  sfx("porta");
  if (eraGinasioViridian) onGiovanniGymCleared();
}

/** Mix de precipitação já “visível” — evita molhar no rastro residual. */
const CHUVA_MOLHA = 0.28;

export function tickCampo(dt) {
  if (estado.saidaGrace > 0) estado.saidaGrace = Math.max(0, estado.saidaGrace - dt);
  const agora = Date.now();
  const chuva = lerMixClima()?.chuva || 0;
  if (chuva >= CHUVA_MOLHA) {
    for (let i = 0; i < estado.plots.length; i++) molharPorChuva(estado.plots[i], agora);
  }
  for (let i = 0; i < estado.plots.length; i++) simularPlot(estado.plots[i], agora);
  tickArvores(dt, agora);
  tickGrama(dt, agora);
  tickBerries(agora);
  if (!estado.ganhoAberto) {
    tickOrdens(dt);
    tickOrdensForca(dt);
  }
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
  limparGramaNoCanteiro(alvo.x | 0, alvo.y | 0);
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
  const nome = nomeDe(TIPO_ITEM.BERRY, ganho.key);
  return ganho.n > 1 ? `Colheu ${ganho.n} ${nome}.` : `Colheu ${nome}.`;
}

/** Canteiro maduro perto do jogador (mesmo raio do arbusto silvestre). */
export function plotMaduroPerto(x, y, z) {
  let melhor = null;
  let dist = ALCANCE_COLHER;
  const piso = z || 0;
  for (let i = 0; i < estado.plots.length; i++) {
    const plot = estado.plots[i];
    if (plot.stage !== ESTAGIO.MADURA || !plot.berryKey) continue;
    const px = plot.x + 0.5;
    const py = plot.y + 0.5;
    const pz = alturaEm(plot.x, plot.y);
    if (Math.abs(pz - piso) > 2) continue;
    const d = Math.hypot(px - x, py - y);
    if (d >= dist) continue;
    dist = d;
    melhor = plot;
  }
  return melhor;
}

export function colherCanteiro(plot) {
  const key = colher(plot);
  if (!key) return "";
  const n = 2 + Math.floor(Math.random() * 2);
  darItem(TIPO_ITEM.BERRY, key, n);
  marcarQuest("berry");
  sfx("colher");
  const nome = nomeDe(TIPO_ITEM.BERRY, key);
  return n > 1 ? `Colheu ${n} ${nome}.` : `Colheu ${nome}.`;
}

export function plantarOuColher(alvo, item) {
  const plot = plotEm(alvo.x, alvo.y);
  if (!plot) return "";
  if (plot.stage === ESTAGIO.MADURA) return colherCanteiro(plot);
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
  const def = defItem(item.tipo, item.key);
  if (def?.efeito?.reviverParty) {
    if (usarNoPokemon(item.tipo, item.key, mon)) {
      return `Usou ${nomeDe(item.tipo, item.key)} na party.`;
    }
    return "Nenhum Pokémon desmaiado.";
  }
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

function celulaEmAlcance(corpo, celula, alvoBloco) {
  if (alvoBloco) return emAlcanceEdicao(corpo, alvoBloco.x, alvoBloco.y, alvoBloco.z);
  if (celula) return emAlcanceEdicao(corpo, celula.x, celula.y);
  return false;
}

/** Clique esquerdo usa o que está selecionado na hotbar.
 * @param {{ x: number, y: number } | null | undefined} [miraMundo] mira do clique (mesmo ponto do ghost).
 */
export function usarNoClique(corpo, celula, alvoBloco, miraMundo) {
  const item = hotbarAtivo();
  const ocupaClique = item && (item.tipo === TIPO_ITEM.BLOCO || item.tipo === TIPO_ITEM.FERRAMENTA);
  if (!ocupaClique && celula && !plotEm(celula.x, celula.y)) {
    const arbusto = arbustoMaduroPerto(celula.x + 0.5, celula.y + 0.5, corpo?.z || 0);
    if (arbusto) {
      if (!celulaEmAlcance(corpo, celula, null)) return "Longe demais.";
      return colherSilvestre(arbusto);
    }
  }
  if (!item || !celula) return "";
  if (contar(item.tipo, item.key) <= 0) return "Você não tem esse item.";
  if (item.tipo === TIPO_ITEM.BLOCO) {
    if (!celulaEmAlcance(corpo, celula, alvoBloco)) return "Longe demais.";
    if (alvoBloco && tentarColocar(corpo, alvoBloco)) return "Colocou o bloco.";
    return "Não deu para colocar o bloco.";
  }
  if (item.tipo === TIPO_ITEM.FERRAMENTA) {
    if (item.key === "flag" && !estado.interior) {
      const cursor = miraConstrucao();
      const mira = clampMiraConstrucao(
        corpo,
        miraMundo?.x ?? cursor?.x ?? celula.x + 0.5,
        miraMundo?.y ?? cursor?.y ?? celula.y + 0.5,
      );
      definirMiraConstrucao(mira.x, mira.y);
      const r = plantarBandeira(mira.x, mira.y);
      if (!r.ok) return mensagemFalha(r.reason) || "Não deu para plantar a bandeira.";
      return r.relocated ? "Base relocada." : "Base plantada.";
    }
    if (item.key === "hammer" && estado.interior?.papel === "casa") {
      if (!estado.interior.sala3d) {
        estado.construir = true;
        return "";
      }
      // Casa 3D do jogador: móveis via catálogo indoor existente
      estado.construir = true;
      return "";
    }
    if (item.key === "hammer" && !estado.interior) {
      const cursor = miraConstrucao();
      const mira = clampMiraConstrucao(
        corpo,
        miraMundo?.x ?? cursor?.x ?? celula.x + 0.5,
        miraMundo?.y ?? cursor?.y ?? celula.y + 0.5,
      );
      const ax = mira.x;
      const ay = mira.y;
      definirMiraConstrucao(ax, ay);
      if (
        (teclaBaixa("ShiftLeft") || teclaBaixa("ShiftRight")) &&
        celulaEmAlcance(corpo, celula, null)
      ) {
        const alvo = alvoDemolirPerto(ax, ay, 2.8);
        if (alvo) {
          const hit = acertarDemolicao(alvo, 10);
          if (hit.ok) {
            return hit.destroyed
              ? hit.message || "Demolido."
              : `Demolindo… ${hit.hp}/${hit.maxHp}`;
          }
        }
        return "Nada para demolir aqui.";
      }
      if (!temSelecaoConstruir()) {
        if (!temClaim()) {
          const aberto = toggleCatalogoConstruir();
          atualizarCatalogoConstruir();
          return aberto
            ? "Plante a Bandeira antes de construir. Catálogo aberto."
            : "Plante a Bandeira da base primeiro.";
        }
        const aberto = toggleCatalogoConstruir();
        atualizarCatalogoConstruir();
        return aberto ? "Catálogo aberto — escolha uma casa." : "Catálogo fechado.";
      }
      if (!emAlcanceConstrucao(corpo, ax, ay)) {
        return `Longe demais — aproxime-se (até ${ALCANCE_CONSTRUIR} m).`;
      }
      const check = obterPreview(modoBuild.selected, ax, ay, corpo);
      if (!check?.ok) {
        return check?.reason
          ? mensagemFalha(check.reason)
          : "Não dá pra construir aqui.";
      }
      const r = iniciarRitual(modoBuild.selected, ax, ay, corpo);
      if (!r.ok) return r.message || mensagemFalha(r.reason);
      const comMon = ordenarRitualConstrucao();
      return comMon
        ? "Pokémon a caminho — construindo com marteladas…"
        : "Construção iniciada (sem companion — progresso automático).";
    }
    if (!celulaEmAlcance(corpo, celula, alvoBloco)) return "Longe demais.";
    if (item.key === "pickaxe") {
      if (alvoBloco) {
        if (tentarQuebrar(corpo, alvoBloco)) return "Quebrou o bloco.";
        const prop = usarPicaretaNo(celula.x + 0.5, celula.y + 0.5);
        if (prop && prop !== "Nenhuma pedra no clique.") return prop;
        return "Nada para quebrar.";
      }
      return usarPicaretaNo(celula.x + 0.5, celula.y + 0.5);
    }
    if (item.key === "axe") return usarMachadoNo(celula.x + 0.5, celula.y + 0.5);
    if (item.key === "hoe") return usarEnxada(celula);
    if (item.key === "wateringCan") return usarRegador(celula);
    return FERRAMENTAS[item.key]?.dica || "";
  }
  if (item.tipo === TIPO_ITEM.BERRY) {
    if (!celulaEmAlcance(corpo, celula, null)) return "Longe demais.";
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
  if (item.tipo === TIPO_ITEM.BOLA) return "Top-down: aponta o cursor — a força cai ali (vermelho = além do máximo). LMB segura/solta. RMB: mira em ombro. Escape cancela.";
  return "";
}
