/**
 * Pool limitada de sky passers — cruise aéreo efêmero.
 */
import { alturaEm } from "../../../mundo/altura.js";
import { criarAtor } from "../../ator.js";
import { especie } from "../../dados.js";
import { nivelEm } from "../../distribuicao/forca.js";
import { garantirAtlas } from "../../sprites.js";
import { HABITAT } from "../kinds.js";
import { PERFIL_NINHO_VOO } from "../perfis.js";
import { sortearSkyPasser, poolSkyDeChaves } from "./catalogo.js";

export const SKY_CFG = Object.freeze({
  maxLive: 12,
  intervalMinSec: 16,
  intervalMaxSec: 48,
  flockChance: 0.28,
  flockSizeMin: 2,
  flockSizeMax: 5,
  speedMin: 3.4,
  speedMax: 6.2,
  altMin: 4.4,
  altMax: 9,
  cullPad: 36,
  spawnPad: 22,
});

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function criarSlot() {
  return {
    active: false,
    ator: null,
    dirX: 1,
    dirY: 0,
    speed: 4,
    alt: 6,
    bobPhase: 0,
    bobOmega: 2.1,
  };
}

/** @type {ReturnType<typeof criarSlot>[]} */
const slots = [];
for (let i = 0; i < SKY_CFG.maxLive; i++) slots.push(criarSlot());

let proximoSpawn = 0;
let flockSeq = 1;

function vivos() {
  const out = [];
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].active && slots[i].ator && !slots[i].ator.capturado) out.push(slots[i]);
  }
  return out;
}

function liberar(slot) {
  slot.active = false;
  slot.ator = null;
}

function livre() {
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i].active) return slots[i];
  }
  return null;
}

/**
 * @param {number} px
 * @param {number} py
 * @param {string[]} [chavesLocais]
 * @param {number} agora
 */
/**
 * Prefere espécie com strip FlapAround no atlas (evita Walk no ar).
 * @param {readonly { dex: number, key: string }[] | null} pool
 */
function escolherComFlap(pool) {
  const tentativas = 8;
  let fallback = null;
  for (let i = 0; i < tentativas; i++) {
    const entry = sortearSkyPasser(Math.random(), pool);
    if (!entry) return null;
    if (!fallback) fallback = entry;
    const pack = garantirAtlas(entry.dex, false);
    if (pack?.estado === "fila" || pack?.estado === "carregando") {
      // Ainda carregando: aceita e o tickVisual usa FlapAround quando vier.
      return entry;
    }
    if (pack?.anims?.FlapAround) return entry;
  }
  return fallback;
}

function spawnFlock(px, py, chavesLocais, agora) {
  const pool = poolSkyDeChaves(chavesLocais || []);
  const entry = escolherComFlap(pool.length ? pool : null);
  if (!entry) return;
  const esp = especie(entry.key);
  if (!esp) return;
  // Pré-aquece atlas pra FlapAround estar pronto no 1º frame.
  garantirAtlas(esp.dex, false);

  const ang = Math.random() * Math.PI * 2;
  const dirX = Math.cos(ang);
  const dirY = Math.sin(ang);
  const pad = SKY_CFG.spawnPad;
  const sx = px - dirX * pad + (Math.random() - 0.5) * 6;
  const sy = py - dirY * pad + (Math.random() - 0.5) * 6;
  const chao = alturaEm(Math.floor(sx), Math.floor(sy)) || 1;
  const alt = lerp(SKY_CFG.altMin, SKY_CFG.altMax, Math.random());
  const speed = lerp(SKY_CFG.speedMin, SKY_CFG.speedMax, Math.random());
  const n =
    Math.random() < SKY_CFG.flockChance
      ? SKY_CFG.flockSizeMin +
        ((Math.random() * (SKY_CFG.flockSizeMax - SKY_CFG.flockSizeMin + 1)) | 0)
      : 1;
  const flockId = flockSeq++;
  const nivel = Math.max(1, nivelEm(px, py) | 0);

  for (let i = 0; i < n; i++) {
    const slot = livre();
    if (!slot) break;
    const lane = (i - (n - 1) * 0.5) * 0.7;
    const ox = -dirY * lane;
    const oy = dirX * lane;
    const ator = criarAtor({
      id: `sky-${agora | 0}-${flockId}-${i}`,
      especie: esp,
      nivel,
      shiny: false,
      faccao: "selvagem",
      x: sx + ox,
      y: sy + oy,
      z: chao,
      hostil: false,
      dormindo: 0,
    });
    ator.habitatKind = HABITAT.SKY;
    ator.skyPasser = true;
    ator.perfil = PERFIL_NINHO_VOO;
    ator.voando = true;
    ator.pulando = true;
    ator.noChao = false;
    ator.elevacao = chao + alt;
    ator.hopLift = alt;
    ator.dirX = dirX;
    ator.dirY = dirY;
    ator.vx = dirX * speed;
    ator.vy = dirY * speed;
    ator.modo = "passeio";
    slot.active = true;
    slot.ator = ator;
    slot.dirX = dirX;
    slot.dirY = dirY;
    slot.speed = speed * (0.92 + Math.random() * 0.16);
    slot.alt = alt + (Math.random() - 0.5) * 0.8;
    slot.bobPhase = Math.random() * Math.PI * 2;
    slot.bobOmega = 1.8 + Math.random() * 0.8;
  }
}

/**
 * @param {number} px
 * @param {number} py
 * @param {number} dt
 * @param {number} agora
 * @param {{ indoor?: boolean, chavesLocais?: string[] }} [ctx]
 */
export function tickSkyPassers(px, py, dt, agora, ctx = {}) {
  if (ctx.indoor) {
    for (let i = 0; i < slots.length; i++) {
      if (slots[i].active) liberar(slots[i]);
    }
    proximoSpawn = agora + 4;
    return;
  }

  if (agora >= proximoSpawn && vivos().length < SKY_CFG.maxLive) {
    spawnFlock(px, py, ctx.chavesLocais, agora);
    proximoSpawn =
      agora +
      lerp(SKY_CFG.intervalMinSec, SKY_CFG.intervalMaxSec, Math.random());
  }

  const cull = SKY_CFG.cullPad;
  const cull2 = cull * cull;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot.active || !slot.ator) continue;
    const ator = slot.ator;
    if (ator.capturado || ator.morto) {
      liberar(slot);
      continue;
    }
    // Em agro: deixa a IA de combate; senão cruise.
    if (ator.modo !== "agro") {
      slot.bobPhase += slot.bobOmega * dt;
      const bob = Math.sin(slot.bobPhase) * 0.35;
      ator.vx = slot.dirX * slot.speed;
      ator.vy = slot.dirY * slot.speed;
      ator.x += ator.vx * dt;
      ator.y += ator.vy * dt;
      ator.dirX = slot.dirX;
      ator.dirY = slot.dirY;
      ator.andando = true;
      ator.voando = true;
      const chao = alturaEm(Math.floor(ator.x), Math.floor(ator.y)) || 1;
      ator.z = chao;
      ator.elevacao = chao + slot.alt + bob;
      ator.hopLift = ator.elevacao - ator.z;
    }
    const dx = ator.x - px;
    const dy = ator.y - py;
    if (dx * dx + dy * dy > cull2 && ator.modo !== "agro") liberar(slot);
  }
}

/** Ativos pra combate / render (mesma lista que selvagens). */
export function skyPassersAtivos() {
  const out = [];
  for (let i = 0; i < slots.length; i++) {
    const a = slots[i].ator;
    if (slots[i].active && a && !a.capturado) out.push(a);
  }
  return out;
}

export function limparSkyPassers() {
  for (let i = 0; i < slots.length; i++) liberar(slots[i]);
  proximoSpawn = 0;
}
