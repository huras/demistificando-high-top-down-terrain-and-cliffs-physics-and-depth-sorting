/**
 * Plano mundial: 493 pedras (gens 1–4) espalhadas no overworld 8192².
 */
import { SEED_MUNDO, CHUNK_XZ } from "../config.js";
import {
  LADO_MUNDO,
  dentroDoKanto,
  ORIGEM_KANTO_X,
  ORIGEM_KANTO_Y,
} from "../mundo/bounds.js";
import { AREA_KANTO, ehCidade, zonaNoMundo } from "../mundo/regiao/grafoKanto.js";
import { alturaDoRelevo, nivelMarBlocos } from "../mundo/bioma/catalogo.js";
import {
  RAIO_SANTUARIO,
  SHRINE_FOOTPRINT_ROWS,
  SHRINE_VEG_CLEARANCE,
  shrineDefByElement,
  shrineDefByIndex,
  shrineMapColor,
} from "./catalogo.js";
import { mapaPorDex, shrineQuotaTotal, shrineSpeciesAll } from "./cota.js";
import { entradaAberta, santuarioLimpo } from "./estadoSantuario.js";

/** Célula de planejamento (= área Kanto). */
export const AREA_SHRINE = AREA_KANTO;
const LADO_AREAS = (LADO_MUNDO / AREA_SHRINE) | 0;

/** @type {{ byChunk: Map<string, object[]>, slots: object[], bySpecies: Map<string, object> } | null} */
let worldPlan = null;

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

function hashStr(value) {
  const s = String(value ?? "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffleDet(list, seedA, seedB) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = hash2(seedA + i * 7919, seedB) % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function manhattan(a, b) {
  return Math.abs(a.ax - b.ax) + Math.abs(a.ay - b.ay);
}

function areaKey(ax, ay) {
  return `${ax},${ay}`;
}

function chunkKey(cx, cy) {
  return `${cx | 0},${cy | 0}`;
}

export function shrineMarkerId(ax, ay, tx, ty) {
  return `shrine:${ax},${ay}:${tx},${ty}`;
}

function zonaElegivel(ax, ay) {
  const wx = ax * AREA_SHRINE + AREA_SHRINE * 0.5;
  const wy = ay * AREA_SHRINE + AREA_SHRINE * 0.5;
  if (ehCidade(wx, wy)) return false;
  if (dentroDoKanto(wx, wy)) {
    const z = zonaNoMundo(wx, wy);
    if (!z) return false;
    if (z.tipo === "cidade") return false;
    if (z.agua && !z.tipo) return false;
    if (z.generation?.ocean || z.generation?.water) return false;
  }
  return true;
}

function pickSpreadCells(candidates, count) {
  const n = Math.max(0, Math.min(count | 0, candidates.length));
  if (!n) return [];
  const picked = [];
  let first = candidates[0];
  let bestH = hash2(first.ax ^ 0x534852, first.ay ^ 0x494e45);
  for (const c of candidates) {
    const h = hash2(c.ax ^ 0x534852, c.ay ^ 0x494e45);
    if (h < bestH) {
      bestH = h;
      first = c;
    }
  }
  picked.push(first);
  while (picked.length < n) {
    let best = null;
    let bestScore = -1;
    for (const c of candidates) {
      if (picked.some((p) => p.ax === c.ax && p.ay === c.ay)) continue;
      const score = Math.min(...picked.map((p) => manhattan(c, p)));
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (!best) break;
    picked.push(best);
  }
  return picked;
}

function spreadSlots(candidates, count) {
  const n = Math.max(0, count | 0);
  if (!n || !candidates.length) return [];
  if (n <= candidates.length) return pickSpreadCells(candidates, n);
  const base = Math.floor(n / candidates.length);
  const extra = n % candidates.length;
  const extraSet = new Set();
  if (extra > 0) {
    for (const c of pickSpreadCells(candidates, extra)) {
      extraSet.add(areaKey(c.ax, c.ay));
    }
  }
  const ordered = candidates.slice().sort((a, b) =>
    a.ay !== b.ay ? a.ay - b.ay : a.ax - b.ax
  );
  const slots = [];
  for (const c of ordered) {
    const copies = base + (extraSet.has(areaKey(c.ax, c.ay)) ? 1 : 0);
    for (let i = 0; i < copies; i++) slots.push({ ax: c.ax, ay: c.ay });
  }
  return slots;
}

function tentarAncora(ax, ay, slotIndex) {
  const cols = AREA_SHRINE;
  const rows = AREA_SHRINE;
  const areaSeed = hash2(ax * 104729 + SEED_MUNDO, ay * 7919 + slotIndex);
  const nivel = nivelMarBlocos();
  for (let attempt = 0; attempt < 48; attempt++) {
    const h = hash2(areaSeed + attempt * 104729, attempt * 7919);
    const tx = 4 + (h % Math.max(1, cols - 8));
    const ty = 5 + ((h >>> 10) % Math.max(1, rows - 10));
    const wx = ax * AREA_SHRINE + tx + 0.5;
    const wy = ay * AREA_SHRINE + ty + 0.5;
    if (ehCidade(wx, wy)) continue;
    const hz = alturaDoRelevo(wx, wy);
    if (!(hz >= nivel)) continue;
    // Evita spawn Pallet (origem Kanto + centro aproximado)
    const dx = wx - (ORIGEM_KANTO_X + 4 * AREA_KANTO + 64);
    const dy = wy - (ORIGEM_KANTO_Y + 27 * AREA_KANTO + 64);
    if (dx * dx + dy * dy < 40 * 40) continue;
    return { tx, ty, wx, wy, z: hz };
  }
  return null;
}

/**
 * Constrói (e cacheia) o plano mundial.
 */
export function getWorldShrinePlan() {
  if (worldPlan) return worldPlan;
  // Espera o catálogo (493 spp) — senão o plano fica com chaves stub.
  if (mapaPorDex().size < 400) {
    return { byChunk: new Map(), slots: [], bySpecies: new Map() };
  }

  const candidates = [];
  for (let ay = 0; ay < LADO_AREAS; ay++) {
    for (let ax = 0; ax < LADO_AREAS; ax++) {
      if (zonaElegivel(ax, ay)) candidates.push({ ax, ay });
    }
  }

  const quota = shrineQuotaTotal();
  const species = shrineSpeciesAll();
  const locations = spreadSlots(candidates, quota);
  const assigned = shuffleDet(species.slice(0, locations.length), hashStr("world-shrines"), SEED_MUNDO);

  /** @type {object[]} */
  const slots = [];
  /** @type {Map<string, object[]>} */
  const byChunk = new Map();
  /** @type {Map<string, object>} */
  const bySpecies = new Map();

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    const sp = assigned[i] ?? species[i % Math.max(1, species.length)];
    const def = shrineDefByElement(sp?.element) ?? shrineDefByIndex(i);
    const ancora = tentarAncora(loc.ax, loc.ay, i);
    if (!ancora) continue;

    const id = shrineMarkerId(loc.ax, loc.ay, ancora.tx, ancora.ty);
    const marker = {
      id,
      ax: loc.ax,
      ay: loc.ay,
      tx: ancora.tx,
      ty: ancora.ty,
      x: ancora.wx,
      y: ancora.wy,
      z: ancora.z,
      dex: sp?.dex ?? 0,
      speciesKey: sp?.speciesKey ?? null,
      element: def?.element ?? "normal",
      atlasCol: def?.atlasCol ?? 0,
    };
    slots.push(marker);
    if (marker.speciesKey) bySpecies.set(marker.speciesKey, marker);

    const cx = Math.floor(ancora.wx / CHUNK_XZ);
    const cy = Math.floor(ancora.wy / CHUNK_XZ);
    const ck = chunkKey(cx, cy);
    let lista = byChunk.get(ck);
    if (!lista) {
      lista = [];
      byChunk.set(ck, lista);
    }
    lista.push(marker);
  }

  worldPlan = { byChunk, slots, bySpecies };
  return worldPlan;
}

export function limparCacheSantuario() {
  worldPlan = null;
}

export function findShrineSlotForSpecies(speciesKey) {
  const key = String(speciesKey ?? "").trim();
  if (!key) return null;
  return getWorldShrinePlan().bySpecies.get(key) ?? null;
}

export function findShrineSlotById(shrineId) {
  if (!shrineId) return null;
  return getWorldShrinePlan().slots.find((s) => s.id === shrineId) ?? null;
}

export function santuariosNoChunk(cx, cy) {
  return getWorldShrinePlan().byChunk.get(chunkKey(cx, cy)) ?? [];
}

/** Células (floor) ocupadas por santuário neste chunk — para limpar vegetação. */
export function celulasSantuarioChunk(cx, cy) {
  const markers = santuariosNoChunk(cx, cy);
  if (!markers.length) return null;
  const set = new Set();
  const baseX = cx * CHUNK_XZ;
  const baseY = cy * CHUNK_XZ;
  for (const m of markers) {
    const fx = Math.floor(m.x);
    const fy = Math.floor(m.y);
    for (let dy = -SHRINE_VEG_CLEARANCE; dy <= SHRINE_VEG_CLEARANCE; dy++) {
      for (let dx = -SHRINE_VEG_CLEARANCE; dx <= SHRINE_VEG_CLEARANCE; dx++) {
        const wx = fx + dx;
        const wy = fy + dy;
        if (wx < baseX || wy < baseY || wx >= baseX + CHUNK_XZ || wy >= baseY + CHUNK_XZ) {
          continue;
        }
        set.add(`${wx},${wy}`);
      }
    }
  }
  return set;
}

/**
 * Props de chunk tipados como santuario.
 * @returns {object[]}
 */
export function propsSantuarioChunk(cx, cy) {
  const markers = santuariosNoChunk(cx, cy);
  const out = [];
  for (const m of markers) {
    const z = alturaDoRelevo(m.x, m.y);
    out.push({
      id: m.id,
      x: m.x,
      y: m.y,
      z,
      r: RAIO_SANTUARIO,
      tipo: "santuario",
      sprite: `santuario:${m.atlasCol}`,
      shrineId: m.id,
      element: m.element,
      atlasCol: m.atlasCol,
      speciesKey: m.speciesKey,
      dex: m.dex,
      entranceOpen: entradaAberta(m.id),
      cleared: santuarioLimpo(m.id),
      halfH: SHRINE_FOOTPRINT_ROWS * 0.55,
    });
  }
  return out;
}

export function shrineOutdoorStand(marker) {
  const halfH = SHRINE_FOOTPRINT_ROWS * 0.55;
  return {
    x: marker.x,
    y: marker.y + halfH + 0.9,
  };
}

/**
 * @param {{ x: number, y: number }} player
 * @param {object[]} props
 * @param {number} [reach]
 */
export function findNearbyShrine(player, props, reach = 1.6) {
  if (!player || !props?.length) return null;
  let best = null;
  let bestDist = reach;
  for (let i = 0; i < props.length; i++) {
    const o = props[i];
    if (o?.tipo !== "santuario" || o.oculto) continue;
    const footY = (o.y ?? 0) + (o.halfH ?? 0.5) * 0.15;
    const d = Math.hypot(o.x - player.x, footY - player.y);
    if (d <= bestDist) {
      bestDist = d;
      best = o;
    }
  }
  return best;
}

export { shrineMapColor };
