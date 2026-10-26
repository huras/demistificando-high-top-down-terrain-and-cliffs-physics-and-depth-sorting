/**
 * Runtime unificado: civis de cidade, indoor e viajantes.
 */
import { estado as estadoJogo } from "../jogo/estado.js";
import { carregarCatalogoNpc, catalogoPronto } from "./catalogo/carregar.js";
import { gerarNpcsCasa } from "./casa/gerar.js";
import {
  gerarNpcsCidade,
  npcsAutoradosCidade,
  tickLotWalk,
} from "./cidade/index.js";
import { npcPerfCount, npcPerfMeasure } from "./perf.js";
import {
  atualizarResidencia,
  contarAtivos,
  OW_CFG,
  tentarSpawnViajante,
  tickMovimentoViajante,
} from "./viajantes/index.js";

/** Raio (tiles) pra render + colisão dinâmica. */
export const NPC_RENDER_REACH = 36;
const NPC_RENDER_REACH_SQ = NPC_RENDER_REACH * NPC_RENDER_REACH;
/** Simula lot-walk só perto da câmera (AABB pad). */
const LOT_SIM_PAD = 20;

/** @type {object[]} */
let civisCidade = [];
/** @type {object[]} */
let civisCasa = [];
/** @type {object[]} */
let viajantes = [];
/** @type {string|null} */
let predioCasaAtual = null;
let iniciado = false;
let spawnAcc = 0;
/** @type {{ x: number, y: number }|null} */
let playerRef = null;

export async function iniciarNpc() {
  if (iniciado) return;
  await carregarCatalogoNpc();
  civisCidade = [...gerarNpcsCidade(), ...npcsAutoradosCidade()];
  iniciado = true;
}

export function npcsProntos() {
  return iniciado && catalogoPronto();
}

export function listarCivisCidade() {
  return civisCidade;
}

export function listarViajantes() {
  return viajantes;
}

/** Busca NPC por id (civis + viajantes + casa). */
export function npcPorId(id) {
  if (!id) return null;
  for (let i = 0; i < viajantes.length; i++) {
    if (viajantes[i].id === id) return viajantes[i];
  }
  for (let i = 0; i < civisCidade.length; i++) {
    if (civisCidade[i].id === id) return civisCidade[i];
  }
  for (let i = 0; i < civisCasa.length; i++) {
    if (civisCasa[i].id === id) return civisCasa[i];
  }
  return null;
}

export function listarCivisCasa() {
  return civisCasa;
}

function pertoDoPlayer(n, px, py) {
  const dx = n.x - px;
  const dy = n.y - py;
  return dx * dx + dy * dy <= NPC_RENDER_REACH_SQ;
}

/** NPCs próximos o bastante pra renderizar / colidir. */
export function listarNpcsVisiveis() {
  const interior = estadoJogo.interior;
  if (interior?.sala3d) {
    if (interior.papel === "casa") return civisCasa.filter((n) => n.visivel !== false);
    return [];
  }
  if (interior) return [];
  const px = playerRef?.x;
  const py = playerRef?.y;
  const out = [];
  if (px == null || py == null) return out;
  for (let i = 0; i < civisCidade.length; i++) {
    const n = civisCidade[i];
    if (n.visivel && pertoDoPlayer(n, px, py)) out.push(n);
  }
  for (let i = 0; i < viajantes.length; i++) {
    const n = viajantes[i];
    if (n.visivel !== false && pertoDoPlayer(n, px, py)) out.push(n);
  }
  return out;
}

/** Corpos sólidos para física (só perto do jogador). */
export function listarSolidosNpc() {
  const lista = listarNpcsVisiveis();
  const out = [];
  for (let i = 0; i < lista.length; i++) {
    const n = lista[i];
    const elev = n.elevacao ?? n.z;
    out.push({
      x: n.x,
      y: n.y,
      z: n.z,
      elevacao: elev,
      raioCorpo: n.raio || 0.38,
      npc: true,
      id: n.id,
    });
  }
  return out;
}

export function aoEntrarCasa(predioId) {
  predioCasaAtual = predioId || "casa";
  civisCasa = gerarNpcsCasa(predioCasaAtual);
}

export function aoSairInterior() {
  predioCasaAtual = null;
  civisCasa = [];
}

function aabbCamera(player, pad = LOT_SIM_PAD) {
  if (!player) return null;
  return {
    minX: player.x - pad,
    maxX: player.x + pad,
    minY: player.y - pad,
    maxY: player.y + pad,
  };
}

/**
 * @param {object} player
 * @param {number} dt
 * @param {{ periodo?: string }} [ctx]
 */
export function tickNpc(player, dt, ctx = {}) {
  if (!iniciado || !player) return;
  playerRef = player;
  const interior = estadoJogo.interior;
  const aabb = aabbCamera(player);

  if (interior?.sala3d && interior.papel === "casa") {
    for (let i = 0; i < civisCasa.length; i++) {
      tickLotWalk(civisCasa[i], player, dt, null);
    }
    return;
  }

  if (interior) return;

  npcPerfMeasure("tickCivis", () => {
    for (let i = 0; i < civisCidade.length; i++) {
      const n = civisCidade[i];
      n.visivel = pertoDoPlayer(n, player.x, player.y);
      // Lot-walk já faz LOD por AABB; só chama quem está perto o bastante.
      if (
        aabb &&
        n.x >= aabb.minX &&
        n.x <= aabb.maxX &&
        n.y >= aabb.minY &&
        n.y <= aabb.maxY
      ) {
        tickLotWalk(n, player, dt, aabb);
      }
    }
  });

  atualizarResidencia(player, viajantes, aabb);
  spawnAcc += dt;
  if (
    spawnAcc >= OW_CFG.SPAWN_INTERVAL_SEC &&
    contarAtivos(viajantes) < OW_CFG.MAX_ATIVOS
  ) {
    spawnAcc = 0;
    const spawned = tentarSpawnViajante(
      player,
      viajantes,
      aabb,
      ctx.periodo || "day",
    );
    if (spawned) viajantes.push(spawned);
  }

  npcPerfMeasure("tickViajantes", () => {
    for (let i = 0; i < viajantes.length; i++) {
      const t = viajantes[i];
      t.visivel = pertoDoPlayer(t, player.x, player.y);
      if (t.combatHold || estadoJogo.batalhaTreinador) {
        t.vx = 0;
        t.vy = 0;
        t.andando = false;
        continue;
      }
      tickMovimentoViajante(t, dt);
    }
  });
  npcPerfCount("viajantes", viajantes.length);
  npcPerfCount("civis", civisCidade.length);
}

/**
 * NPC mais próximo dentro do alcance de interação.
 */
export function npcPertoDe(x, y, alcance = 1.35) {
  const lista = listarNpcsVisiveis();
  let melhor = null;
  let melhorD = alcance * alcance;
  for (let i = 0; i < lista.length; i++) {
    const n = lista[i];
    const dx = n.x - x;
    const dy = n.y - y;
    const d = dx * dx + dy * dy;
    const r = (n.raio || 0.4) + 0.5;
    const max = (alcance + r * 0.25) ** 2;
    if (d <= max && d < melhorD) {
      melhorD = d;
      melhor = n;
    }
  }
  return melhor;
}

export function falarComNpc(npc) {
  if (!npc) return null;
  return {
    nome: npc.nome,
    linhas: (npc.fala || ["…"]).slice(),
    i: 0,
    retrato: npc.retrato || "",
    party: npc.party || null,
  };
}
