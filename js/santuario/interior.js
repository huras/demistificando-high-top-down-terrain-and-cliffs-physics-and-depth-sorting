/**
 * Hub do santuário: dungeon gerada + estado ativo no bolso 3D.
 */
import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";
import {
  generateShrineDungeon,
  buildDecorFromDungeon,
  hashSeed,
} from "./dungeonGen.js";
import { SHRINE_MAP_COLORS } from "./catalogo.js";
import { nomeTemplo, nomeElemento } from "./nomes.js";
import { santuarioLimpo } from "./estadoSantuario.js";

export const SHRINE_INTERIOR_COLS = 96;
export const SHRINE_INTERIOR_ROWS = 96;
export const ORIGEM_SANTUARIO_X = 100700;
export const ORIGEM_SANTUARIO_Y = 100000;
export const ALTURA_PAREDE_SANTUARIO = 5;

/** @type {object | null} */
let ativo = null;

export function santuarioAtivo() {
  return ativo;
}

export function limparSantuarioAtivo() {
  ativo = null;
}

export function dentroDoTerrenoSantuario(wx, wy) {
  if (!ativo) return false;
  return (
    wx >= ORIGEM_SANTUARIO_X - 8 &&
    wx < ORIGEM_SANTUARIO_X + SHRINE_INTERIOR_COLS + 8 &&
    wy >= ORIGEM_SANTUARIO_Y - 8 &&
    wy < ORIGEM_SANTUARIO_Y + SHRINE_INTERIOR_ROWS + 8
  );
}

/**
 * @param {object} enterable
 */
export function criarInteriorSantuario(enterable) {
  const element = enterable?.element ?? "normal";
  const cols = SHRINE_INTERIOR_COLS;
  const rows = SHRINE_INTERIOR_ROWS;
  const seed =
    enterable?.shrineId ??
    `${element}:${enterable?.outdoorX}:${enterable?.outdoorY}`;
  const gen = generateShrineDungeon(cols, rows, {
    seed: hashSeed(seed),
    roomCount: 8,
    corridorWidth: 3,
    roomGap: 14,
    roomWMin: 9,
    roomWSpan: 6,
    roomHMin: 8,
    roomHSpan: 5,
  });
  const decor = buildDecorFromDungeon(gen);
  const walkMask = gen.floorMask;
  const cleared = santuarioLimpo(enterable?.shrineId);

  ativo = {
    kind: "shrine",
    element,
    atlasCol: enterable?.atlasCol ?? 0,
    shrineId: enterable?.shrineId ?? null,
    speciesKey: enterable?.speciesKey ?? null,
    dex: enterable?.dex ?? 0,
    cols,
    rows,
    floorMask: gen.floorMask,
    walkMask,
    rooms: gen.rooms,
    pillars: decor.pillars,
    torches: decor.torches,
    totem: {
      x: ORIGEM_SANTUARIO_X + gen.totem.x,
      y: ORIGEM_SANTUARIO_Y + gen.totem.y,
      halfW: gen.totem.halfW,
      halfH: gen.totem.halfH,
      cleared,
    },
    spawn: {
      x: ORIGEM_SANTUARIO_X + gen.spawn.x,
      y: ORIGEM_SANTUARIO_Y + gen.spawn.y,
      z: ALTURA_PRACA,
    },
    outdoorX: enterable?.outdoorX ?? enterable?.x,
    outdoorY: enterable?.outdoorY ?? enterable?.y,
    outdoorZ: enterable?.outdoorZ ?? ALTURA_PRACA,
    doorCx: ORIGEM_SANTUARIO_X + gen.doorCx,
    doorHalf: gen.doorHalf,
    title: nomeTemplo(enterable?.shrineId, element),
    accent: SHRINE_MAP_COLORS[String(element).toLowerCase()] ?? "#e2e8f0",
    cleared,
  };
  return ativo;
}

export function spawnSantuario() {
  if (!ativo) {
    return {
      x: ORIGEM_SANTUARIO_X + SHRINE_INTERIOR_COLS * 0.5,
      y: ORIGEM_SANTUARIO_Y + SHRINE_INTERIOR_ROWS - 4,
      z: ALTURA_PRACA,
    };
  }
  return { ...ativo.spawn };
}

export function naSaidaSantuario(x, y) {
  if (!ativo) return false;
  const portaY = ORIGEM_SANTUARIO_Y + SHRINE_INTERIOR_ROWS - 0.5;
  if (y < portaY - 0.2) return false;
  const cx = ativo.doorCx;
  const half = (ativo.doorHalf ?? 2) + 0.5;
  return x >= cx - half && x <= cx + half;
}

export function totemPerto(x, y, reach = 1.5) {
  if (!ativo?.totem) return null;
  const t = ativo.totem;
  const d = Math.hypot(t.x - x, t.y - y);
  if (d > reach) return null;
  return t;
}

export function marcarTotemLimpo() {
  if (!ativo) return;
  ativo.cleared = true;
  if (ativo.totem) ativo.totem.cleared = true;
}

export function shrineElementDisplayName(element) {
  return nomeElemento(element);
}
