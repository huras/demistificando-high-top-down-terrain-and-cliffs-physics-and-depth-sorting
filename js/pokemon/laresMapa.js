/**
 * Enumeração determinística de lares (wild homes) para mapa — sem atores.
 * Kinds: land / high (FlapAround) / surface / undersea.
 */
import { CHUNK_XZ, POKEMON, SEED_MUNDO } from "../config.js";
import { dentroDoMapa } from "../mundo/altura.js";
import { areaLogicaNoMundo } from "../mundo/bioma/areasMundo.js";
import { biomaDominante } from "../mundo/bioma/catalogo.js";
import { SPAWN } from "../mundo/mapaDemo.js";
import {
  MIOL_X,
  MIOL_Y,
  ORIGEM_SALA_X,
  ORIGEM_SALA_Y,
  dentroDoTerrenoSala,
} from "../mundo/cidade/sala3d.js";
import {
  COLS_LAB,
  ORIGEM_LAB_X,
  ORIGEM_LAB_Y,
  ROWS_LAB,
  dentroDoTerrenoLaboratorio,
} from "../mundo/cidade/laboratorio.js";
import { faixasSemSelvagem } from "../mundo/cidade/plantaHub.js";
import { ehCidade } from "../mundo/regiao/grafoKanto.js";
import { amostraKanto, dentroDoKanto } from "../mundo/regiao/amostraKanto.js";
import { especie } from "./dados.js";
import { nivelEm } from "./distribuicao/forca.js";
import { sortearEspecie } from "./distribuicao/sorteio.js";
import {
  HABITAT,
  ehHabitatAquatico,
  infoTileHabitat,
  kindAguaDoTile,
  temFlapAround,
  zDoLarAquatico,
} from "./habitat/index.js";

const FOLGA_VAZIO = 56;

function hash(a, b, c = 0) {
  let h =
    (SEED_MUNDO ^
      Math.imul(a | 0, 374761393) ^
      Math.imul(b | 0, 668265263) ^
      Math.imul(c | 0, 1274126177)) >>>
    0;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

function unidade(h) {
  return (h >>> 0) / 4294967296;
}

function naFaixa(x, y, x0, y0, x1, y1, folga) {
  return x >= x0 - folga && x < x1 + folga && y >= y0 - folga && y < y1 + folga;
}

function zonaSemSelvagem(x, y) {
  if (dentroDoTerrenoSala(x, y) || dentroDoTerrenoLaboratorio(x, y)) return true;
  const faixas = faixasSemSelvagem();
  for (let i = 0; i < faixas.length; i++) {
    const f = faixas[i];
    if (naFaixa(x, y, f.x0, f.y0, f.x1, f.y1, FOLGA_VAZIO)) return true;
  }
  return (
    naFaixa(x, y, ORIGEM_LAB_X, ORIGEM_LAB_Y, ORIGEM_LAB_X + COLS_LAB, ORIGEM_LAB_Y + ROWS_LAB, FOLGA_VAZIO) ||
    naFaixa(x, y, ORIGEM_SALA_X, ORIGEM_SALA_Y, ORIGEM_SALA_X + MIOL_X + 2, ORIGEM_SALA_Y + MIOL_Y + 2, FOLGA_VAZIO)
  );
}

function biomaIdEm(x, y, hSorteio) {
  if (dentroDoKanto(x, y)) {
    const a = amostraKanto(x, y);
    if (!a?.bioma) return "light-grass";
    const idA = a.bioma.id || "light-grass";
    const idB = a.biomaB?.id;
    if (idB && idB !== idA && (a.dominio ?? 1) < 1) {
      return unidade(hSorteio) < 0.7 ? idA : idB;
    }
    return idA;
  }
  const area = areaLogicaNoMundo(x, y);
  if (area?.encontro) return area.encontro;
  return biomaDominante(x, y)?.id || "light-grass";
}

function slotsPorChunk() {
  return Math.max(1, POKEMON.LARES_POR_CHUNK | 0);
}

function posicaoCandidata(cx, cy, indice) {
  if (hash(cx, cy, 10 + indice) % 5 < 3) return null;
  const ox = 1 + (hash(cx, cy, 20 + indice) % (CHUNK_XZ - 2));
  const oy = 1 + (hash(cx, cy, 30 + indice) % (CHUNK_XZ - 2));
  return {
    x: cx * CHUNK_XZ + ox + 0.5,
    y: cy * CHUNK_XZ + oy + 0.5,
  };
}

function slotAnterior(nx, ny, ni, cx, cy, indice) {
  if (ny < cy) return true;
  if (ny > cy) return false;
  if (nx < cx) return true;
  if (nx > cx) return false;
  return ni < indice;
}

function longeDeVizinhos(cx, cy, indice, x, y) {
  const min2 = POKEMON.MIN_ESPACO_LARES * POKEMON.MIN_ESPACO_LARES;
  const alcance = Math.max(1, Math.ceil(POKEMON.MIN_ESPACO_LARES / CHUNK_XZ));
  const maxSlot = slotsPorChunk();
  for (let ny = cy - alcance; ny <= cy + alcance; ny++) {
    for (let nx = cx - alcance; nx <= cx + alcance; nx++) {
      for (let i = 0; i < maxSlot; i++) {
        if (!slotAnterior(nx, ny, i, cx, cy, indice)) continue;
        const p = posicaoCandidata(nx, ny, i);
        if (!p) continue;
        const dx = p.x - x;
        const dy = p.y - y;
        if (dx * dx + dy * dy < min2) return false;
      }
    }
  }
  return true;
}

/**
 * @param {number} cx
 * @param {number} cy
 * @param {number} indice
 * @returns {{
 *   id: string, x: number, y: number, z: number, kind: string,
 *   speciesKey: string, dex: number, shiny: boolean, nivel: number
 * } | null}
 */
export function resolverLarSlot(cx, cy, indice) {
  const id = `${cx},${cy},${indice}`;
  const pos = posicaoCandidata(cx, cy, indice);
  if (!pos) return null;
  const { x, y } = pos;
  if (
    zonaSemSelvagem(x, y) ||
    ehCidade(x, y) ||
    Math.hypot(x - SPAWN.x, y - SPAWN.y) < POKEMON.FOLGA_SPAWN
  ) {
    return null;
  }
  if (!longeDeVizinhos(cx, cy, indice, x, y)) return null;

  const tile = infoTileHabitat(x, y);
  const hBioma = hash(cx, cy, 35 + indice);
  const biomaId = biomaIdEm(x, y, hBioma);
  const nivel = nivelEm(x, y);
  const shiny = unidade(hash(cx, cy, 50 + indice)) < POKEMON.SHINY;

  if (tile.molhado && !tile.caindo && tile.profundidade >= 1) {
    const kind = kindAguaDoTile(tile, hash(cx, cy, 55 + indice));
    if (!kind) return null;
    const chave = sortearEspecie(biomaId, hash(cx, cy, 40 + indice), nivel, {
      habitat: kind,
    });
    const esp = especie(chave) || especie("magikarp") || especie("tentacool");
    if (!esp) return null;
    return {
      id,
      x,
      y,
      z: zDoLarAquatico(kind, tile),
      kind,
      speciesKey: esp.key,
      dex: esp.dex | 0,
      shiny,
      nivel,
    };
  }

  if (tile.zSeco <= 0) return null;
  // Preferir chunk carregado pra terraço HIGH; relevo ainda lista o pin.
  if (!dentroDoMapa(Math.floor(x), Math.floor(y)) && tile.zSeco <= 0) return null;

  const chave = sortearEspecie(biomaId, hash(cx, cy, 40 + indice), nivel, {
    habitat: HABITAT.LAND,
  });
  const esp = especie(chave) || especie("pidgey");
  if (!esp) return null;
  const kind = temFlapAround(esp) ? HABITAT.HIGH : HABITAT.LAND;
  return {
    id,
    x,
    y,
    z: tile.zSeco,
    kind,
    speciesKey: esp.key,
    dex: esp.dex | 0,
    shiny,
    nivel,
  };
}

/**
 * @param {string} larId "cx,cy,i"
 */
export function resolverLarPorId(larId) {
  const m = String(larId || "").match(/^(-?\d+),(-?\d+),(\d+)$/);
  if (!m) return null;
  return resolverLarSlot(Number(m[1]), Number(m[2]), Number(m[3]));
}

/**
 * Lares válidos num raio (para discovery sem ator acordado).
 * @param {number} px
 * @param {number} py
 * @param {number} raio
 * @param {{ soTerrestre?: boolean }} [opts]
 */
export function listarLaresProximos(px, py, raio = 10, opts = null) {
  const r = Math.max(1, raio);
  const r2 = r * r;
  const soTerrestre = !!opts?.soTerrestre;
  const cx0 = Math.floor((px - r) / CHUNK_XZ);
  const cy0 = Math.floor((py - r) / CHUNK_XZ);
  const cx1 = Math.floor((px + r) / CHUNK_XZ);
  const cy1 = Math.floor((py + r) / CHUNK_XZ);
  const maxSlot = slotsPorChunk();
  /** @type {ReturnType<typeof resolverLarSlot>[]} */
  const out = [];
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let i = 0; i < maxSlot; i++) {
        const lar = resolverLarSlot(cx, cy, i);
        if (!lar) continue;
        if (soTerrestre && ehHabitatAquatico(lar.kind)) continue;
        const dx = lar.x - px;
        const dy = lar.y - py;
        if (dx * dx + dy * dy > r2) continue;
        out.push(lar);
      }
    }
  }
  return out;
}

/**
 * Lares na AABB (para mapa mundo — só use com AABB pequena / discovered resolve).
 */
export function listarLaresNaAabb(x0, y0, x1, y1) {
  const cx0 = Math.floor(x0 / CHUNK_XZ);
  const cy0 = Math.floor(y0 / CHUNK_XZ);
  const cx1 = Math.floor(x1 / CHUNK_XZ);
  const cy1 = Math.floor(y1 / CHUNK_XZ);
  const maxSlot = slotsPorChunk();
  const out = [];
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let i = 0; i < maxSlot; i++) {
        const lar = resolverLarSlot(cx, cy, i);
        if (!lar) continue;
        if (lar.x < x0 || lar.x > x1 || lar.y < y0 || lar.y > y1) continue;
        out.push(lar);
      }
    }
  }
  return out;
}
