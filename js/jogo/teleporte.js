/**
 * Relógio da viagem entre cidades. A câmera aproxima, o grupo some,
 * pousa na praça e a câmera afasta de volta.
 * Enquanto sobe, o streaming já aquece o destino (disco duplo).
 */
import { ZOOM_MAX, ZOOM_MIN } from "../config.js";
import { deLocalKanto } from "../mundo/bounds.js";
import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";
import { AREA_KANTO, CENTRO_AREA } from "../mundo/regiao/grafoKanto.js";
import {
  atualizarStreaming,
  obterRaioStream,
  streamDiscoPronto,
} from "../mundo/voxel/storeMundo.js";
import { OFFSET_MON, OFFSET_NPC } from "../navegacao/espacoSeguir.js";
import { resetarNav } from "../navegacao/seguirCaminho.js";
import { pokemonDeployado } from "../pokemon/party.js";
import { estado } from "./estado.js";
import {
  gapJornada,
  pausarJornada,
  registrarTeleporte,
} from "./jornada.js";

const SUBIDA = 1.7;
const DESCIDA = 1.3;
const ESPERA_MAX = 1.2;
const FOLGA_DIST = 22;
const SUBIDA_BLOCOS = 17;
const POR_ATOR = 26;
const RAIO_MIOLO = 2;

const sementes = [];
for (let i = 0; i < POR_ATOR * 3; i++) {
  const ang = i * 2.399963229728653;
  sementes.push({
    ox: Math.cos(ang) * (0.12 + (i % 5) * 0.1),
    oy: Math.sin(ang * 1.31) * (0.12 + (i % 4) * 0.11),
    oz: 0.2 + (i % 7) * 0.18,
    giro0: i * 0.73,
    tam: 0.28 + (i % 3) * 0.08,
    atraso: (i % 8) * 0.042,
  });
}

const pecas = [];
for (let i = 0; i < sementes.length; i++) {
  pecas.push({ x: 0, y: 0, z: 0, tam: 0, alfa: 0, giro: 0 });
}

let fase = "ocioso";
let faseT = 0;
let destino = null;
let ancoras = null;
let alfa = 1;
let zoomBase = null;
let monMarcado = null;
let pecasN = 0;
/** @type {null | { x: number, y: number }} */
let origemViagem = null;
/** @type {null | ((x: number, y: number) => boolean)} */
let checarMalhaDestino = null;

export function teleporteOcupado() {
  return fase !== "ocioso";
}

export function alfaSprites() {
  return alfa;
}

export function pecasAgora() {
  return pecas;
}

export function pecasContagem() {
  return pecasN;
}

/** Centro de stream/malha durante a viagem; null fora dela. */
export function focoStreaming() {
  return destino ? { x: destino.x, y: destino.y, z: destino.z } : null;
}

/** Ainda na origem (preparo ou subida) — usa disco duplo. */
export function teleporteNaOrigem() {
  return !!destino && fase !== "descida";
}

export function definirChecagemMalhaTeleporte(fn) {
  checarMalhaDestino = typeof fn === "function" ? fn : null;
}

export function destinoProntoParaCortar() {
  if (!destino) return false;
  if (!streamDiscoPronto(destino.x, destino.y, RAIO_MIOLO)) return false;
  if (checarMalhaDestino && !checarMalhaDestino(destino.x, destino.y)) return false;
  return true;
}

function resolverDestino(alvo) {
  if (!alvo) return null;
  if (Number.isFinite(alvo.x) && Number.isFinite(alvo.y)) {
    return {
      x: alvo.x,
      y: alvo.y,
      z: Number.isFinite(alvo.z) ? alvo.z : ALTURA_PRACA,
    };
  }
  if (Number.isFinite(alvo.ax) && Number.isFinite(alvo.ay)) {
    const p = deLocalKanto(
      alvo.ax * AREA_KANTO + CENTRO_AREA + 0.5,
      alvo.ay * AREA_KANTO + CENTRO_AREA + 0.5,
    );
    return { x: p.x, y: p.y, z: ALTURA_PRACA };
  }
  return null;
}

/** Marca o destino e libera o preload (mapa ainda aberto). Sem VFX. */
export function prepararViagem(alvo) {
  if (fase !== "ocioso") return false;
  const p = resolverDestino(alvo);
  if (!p) return false;
  destino = p;
  ancoras = null;
  return true;
}

export function comecarSubida(alvo) {
  if (fase !== "ocioso") return;
  if (alvo) {
    const p = resolverDestino(alvo);
    if (!p) return;
    destino = p;
  } else if (!destino) {
    return;
  }
  ancoras = null;
  fase = "subida";
  faseT = 0;
  alfa = 1;
  pecasN = 0;
  origemViagem = null;
  pausarJornada(true);
  gapJornada();
}

function saida(t) {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  const inv = 1 - u;
  return 1 - inv * inv * inv;
}

function encaixe(u, atraso) {
  const t = (u - atraso) / (1 - atraso);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

function pousarCorpo(corpo, x, y, z) {
  corpo.x = x;
  corpo.y = y;
  corpo.z = z;
  corpo.elevacao = z;
  corpo.vx = 0;
  corpo.vy = 0;
  corpo.vz = 0;
  corpo.noChao = true;
  corpo.hopLift = 0;
  corpo.pulando = false;
  corpo.pulo = null;
  corpo.planando = false;
  corpo.voando = false;
  corpo.escalando = false;
  corpo.escalada = null;
  corpo.mantle = null;
  corpo.nadando = false;
  corpo.coyoteT = 0;
  corpo.puloBufferT = 0;
  corpo.tempoAr = 0;
  const falta = !streamDiscoPronto(x, y, obterRaioStream());
  atualizarStreaming(x, y, undefined, falta);
  corpo._renasceu = true;
}

function pousarMon(mon, x, y, z) {
  mon.x = x;
  mon.y = y;
  mon.z = z;
  mon.elevacao = z;
  mon.vx = 0;
  mon.vy = 0;
  mon.vz = 0;
  mon.hopLift = 0;
  mon.noChao = true;
  mon._colocado = true;
  if (mon.nav) resetarNav(mon);
}

function cortar(ctx) {
  if (estado.interior) {
    estado.interior = null;
    estado.saidaGrace = 0.6;
  }
  const ox = origemViagem?.x ?? ctx.corpo.x;
  const oy = origemViagem?.y ?? ctx.corpo.y;
  registrarTeleporte(ox, oy, destino.x, destino.y);
  origemViagem = null;
  pousarCorpo(ctx.corpo, destino.x, destino.y, destino.z);
  const mon = pokemonDeployado();
  ancoras = [
    { x: destino.x, y: destino.y, z: destino.z },
    { x: destino.x + OFFSET_NPC.x, y: destino.y + OFFSET_NPC.y, z: destino.z },
  ];
  if (mon) {
    pousarMon(mon, destino.x + OFFSET_MON.x, destino.y + OFFSET_MON.y, destino.z);
    ancoras.push({
      x: destino.x + OFFSET_MON.x,
      y: destino.y + OFFSET_MON.y,
      z: destino.z,
    });
  }
}

function origensVivas(ctx) {
  const lista = [
    {
      x: ctx.corpo.x,
      y: ctx.corpo.y,
      z: ctx.corpo.elevacao ?? ctx.corpo.z,
    },
  ];
  if (ctx.agente) {
    lista.push({
      x: ctx.agente.x,
      y: ctx.agente.y,
      z: ctx.agente.elevacao ?? ctx.agente.z,
    });
  }
  const mon = pokemonDeployado();
  if (mon) {
    lista.push({
      x: mon.x,
      y: mon.y,
      z: mon.elevacao ?? mon.z,
    });
  }
  return lista;
}

function montarPecas(origens, u, subindo) {
  pecasN = 0;
  for (let a = 0; a < origens.length; a++) {
    const origem = origens[a];
    for (let i = 0; i < POR_ATOR; i++) {
      const s = sementes[a * POR_ATOR + i];
      const e = encaixe(u, s.atraso);
      if (e <= 0) continue;
      const sobe = subindo ? e : 1 - e;
      const opacidade = subindo
        ? e < 0.2
          ? e / 0.2
          : Math.max(0, 1 - (e - 0.2) / 0.8)
        : Math.max(0, 1 - e);
      if (opacidade <= 0.02) continue;
      const p = pecas[pecasN++];
      p.x = origem.x + s.ox;
      p.y = origem.y + s.oy;
      p.z = origem.z + s.oz + sobe * SUBIDA_BLOCOS;
      p.tam = s.tam;
      p.alfa = opacidade;
      p.giro = s.giro0 + u * (subindo ? 8 : -8);
    }
  }
}

function aplicarCamera(ctx, extra) {
  if (ctx.camera3d) {
    // Negativo aproxima na saída e afasta na chegada (extra 0→1→0).
    ctx.camera3d.folgaTeleporte = -extra;
    ctx.camera3d.folgaDist = -extra * FOLGA_DIST;
    ctx.camera3d.folgaPitch = -extra * 0.38;
  }
  if (ctx.modo === "2d" && ctx.camera) {
    if (zoomBase == null) zoomBase = ctx.camera.zoom;
    const alvo = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomBase * 1.55));
    ctx.camera.zoom = zoomBase + (alvo - zoomBase) * extra;
  }
}

function soltarCamera(ctx) {
  if (ctx.camera3d) {
    ctx.camera3d.folgaTeleporte = 0;
    ctx.camera3d.folgaDist = 0;
    ctx.camera3d.folgaPitch = 0;
  }
  if (ctx.camera && zoomBase != null) ctx.camera.zoom = zoomBase;
  zoomBase = null;
}

function marcarMon(valor) {
  const mon = pokemonDeployado();
  if (monMarcado && monMarcado !== mon) {
    if (monMarcado._sumicoTeleporte) {
      monMarcado._sumindo = null;
      monMarcado._sumicoTeleporte = false;
    }
    monMarcado = null;
  }
  if (!mon) return;
  if (valor == null) {
    if (mon._sumicoTeleporte) {
      mon._sumindo = null;
      mon._sumicoTeleporte = false;
    }
    return;
  }
  mon._sumindo = valor;
  mon._sumicoTeleporte = true;
  monMarcado = mon;
}

function encerrar(ctx) {
  fase = "ocioso";
  faseT = 0;
  alfa = 1;
  pecasN = 0;
  ancoras = null;
  destino = null;
  origemViagem = null;
  pausarJornada(false);
  soltarCamera(ctx);
  marcarMon(null);
}

export function tickTeleporte(dt, ctx) {
  if (fase === "ocioso") return;
  try {
  if (fase === "subida" && !origemViagem && ctx?.corpo) {
    origemViagem = { x: ctx.corpo.x, y: ctx.corpo.y };
  }
  faseT += Math.min(0.05, dt || 0);
  if (fase === "subida" && faseT >= SUBIDA) {
    if (destinoProntoParaCortar() || faseT >= SUBIDA + ESPERA_MAX) {
      cortar(ctx);
      fase = "descida";
      faseT = 0;
    }
  }
  if (fase === "descida" && faseT >= DESCIDA) {
    encerrar(ctx);
    return;
  }
  const subindo = fase === "subida";
  const dur = subindo ? SUBIDA : DESCIDA;
  const u = Math.min(1, faseT / dur);
  const extra = subindo ? saida(u) : 1 - saida(u);
  alfa = subindo ? 1 - saida(u) : saida(u);
  aplicarCamera(ctx, extra);
  montarPecas(subindo ? origensVivas(ctx) : ancoras || origensVivas(ctx), u, subindo);
  marcarMon(alfa);
  } catch (err) {
    console.error(err);
    encerrar(ctx);
  }
}
