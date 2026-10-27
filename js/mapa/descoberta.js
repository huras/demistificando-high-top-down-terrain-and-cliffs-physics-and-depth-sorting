/**
 * Discovery de berries e wild homes para pins de mapa.
 * Espécie só muda com snapshot canônico (resolver do lar); evita flicker
 * quando o terreno ainda não streamou ou o ator diverge do sorteio.
 */
import { vegetacaoNaArea } from "../mundo/bioma/propsBioma.js";
import { selvagensAtivos } from "../pokemon/populacao.js";
import { resolverLarPorId, listarLaresProximos } from "../pokemon/laresMapa.js";

const RAIO_DISCOVER = 10;

/** @type {Map<string, { x: number, y: number, berryKey: string }>} */
const berries = new Map();
/** @type {Map<string, { x: number, y: number, speciesKey: string, dex: number, shiny: boolean }>} */
const wilds = new Map();

let versao = 0;

export function versaoDescobertaMapa() {
  return versao;
}

function bump() {
  versao++;
}

export function resetDescobertaMapa() {
  berries.clear();
  wilds.clear();
  bump();
}

export function berriesDescobertos() {
  return berries;
}

export function wildsDescobertos() {
  return wilds;
}

/** Extrai "cx,cy,i" de id de ator (`lar-1,2,0` ou `lar-1,2,0-1`). */
function larIdDeAtor(atorId) {
  const raw = String(atorId || "");
  if (!raw.startsWith("lar-")) return "";
  const m = raw.slice(4).match(/^(-?\d+),(-?\d+),(\d+)/);
  return m ? `${m[1]},${m[2]},${m[3]}` : "";
}

/**
 * @param {string} larId
 * @param {{ x?: number, y?: number, speciesKey?: string, dex?: number, shiny?: boolean } | null} [info]
 * @returns {{ canonico: boolean, x: number, y: number, speciesKey: string, dex: number, shiny: boolean }}
 */
function snapshotDoLar(larId, info = null) {
  const lar = resolverLarPorId(larId);
  if (lar) {
    return {
      canonico: true,
      x: lar.x,
      y: lar.y,
      speciesKey: lar.speciesKey,
      dex: lar.dex | 0,
      shiny: info?.shiny != null ? !!info.shiny : !!lar.shiny,
      kind: lar.kind || "land",
    };
  }
  return {
    canonico: false,
    x: Number(info?.x) || 0,
    y: Number(info?.y) || 0,
    speciesKey: String(info?.speciesKey || "pidgey"),
    dex: info?.dex | 0,
    shiny: !!info?.shiny,
    kind: info?.kind || "land",
  };
}

/**
 * @param {string} id
 * @param {ReturnType<typeof snapshotDoLar>} snap
 */
function aplicarSnap(id, snap) {
  const prev = wilds.get(id);
  if (!prev) {
    wilds.set(id, {
      x: snap.x,
      y: snap.y,
      speciesKey: snap.speciesKey,
      dex: snap.dex | 0,
      shiny: !!snap.shiny,
      kind: snap.kind || "land",
    });
    bump();
    return true;
  }

  let mudou = false;
  // Posição só do resolver (estável); fallback não empurra coords.
  if (snap.canonico) {
    if (prev.x !== snap.x || prev.y !== snap.y) {
      prev.x = snap.x;
      prev.y = snap.y;
      mudou = true;
    }
    if (prev.speciesKey !== snap.speciesKey) {
      prev.speciesKey = snap.speciesKey;
      mudou = true;
    }
    if ((prev.dex | 0) !== (snap.dex | 0)) {
      prev.dex = snap.dex | 0;
      mudou = true;
    }
    if (snap.kind && prev.kind !== snap.kind) {
      prev.kind = snap.kind;
      mudou = true;
    }
  }
  if (snap.shiny && !prev.shiny) {
    prev.shiny = true;
    mudou = true;
  }
  if (mudou) bump();
  return mudou;
}

/**
 * @param {number} wx
 * @param {number} wy
 * @param {string} berryKey
 */
export function descobrirBerry(wx, wy, berryKey) {
  const id = `${wx | 0},${wy | 0}`;
  if (berries.has(id)) return false;
  berries.set(id, {
    x: (wx | 0) + 0.5,
    y: (wy | 0) + 0.5,
    berryKey: String(berryKey || "oran"),
  });
  bump();
  return true;
}

/**
 * @param {string} larId
 * @param {{ x: number, y: number, speciesKey: string, dex?: number, shiny?: boolean }} info
 */
export function descobrirWild(larId, info) {
  const id = String(larId || "");
  if (!id) return false;
  return aplicarSnap(id, snapshotDoLar(id, info));
}

/** Reaplica portões de nível quando o resolver consegue (save / hotfix). */
export function reconciliarWildsDescobertos() {
  let mudou = false;
  for (const id of wilds.keys()) {
    if (aplicarSnap(id, snapshotDoLar(id, wilds.get(id)))) mudou = true;
  }
  return mudou;
}

/**
 * Proximidade outdoor: berries carregados + lares acordados / resolvidos.
 * @param {{ x: number, y: number } | null} corpo
 * @param {{ interior?: boolean }} [opts]
 */
export function tickDescobertaMapa(corpo, opts = {}) {
  if (!corpo || opts.interior) return;
  const px = corpo.x;
  const py = corpo.y;
  const r = RAIO_DISCOVER;
  const props = vegetacaoNaArea(px - r, py - r, px + r, py + r);
  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    if (p?.tipo !== "berry" || p.oculto) continue;
    const dx = p.x - px;
    const dy = p.y - py;
    if (dx * dx + dy * dy > r * r) continue;
    descobrirBerry(Math.floor(p.x), Math.floor(p.y), p.berryKey || "oran");
  }

  const ativos = selvagensAtivos();
  for (let i = 0; i < ativos.length; i++) {
    const a = ativos[i];
    if (!a?.id?.startsWith("lar-") || a.capturado) continue;
    const larId = larIdDeAtor(a.id);
    if (!larId) continue;
    const hx = a.casaX ?? a.x;
    const hy = a.casaY ?? a.y;
    const dx = hx - px;
    const dy = hy - py;
    if (dx * dx + dy * dy > r * r) continue;
    // Já conhecido: só reconcilia via resolver (candidatos / snapshot canônico).
    if (wilds.has(larId)) {
      const lar = resolverLarPorId(larId);
      if (lar) {
        aplicarSnap(larId, {
          canonico: true,
          x: lar.x,
          y: lar.y,
          speciesKey: lar.speciesKey,
          dex: lar.dex | 0,
          shiny: !!a.shiny || !!lar.shiny,
          kind: lar.kind || a.habitatKind || "land",
        });
      }
      continue;
    }
    descobrirWild(larId, {
      x: hx,
      y: hy,
      speciesKey: a.especie?.key || "pidgey",
      dex: a.especie?.dex | 0,
      shiny: !!a.shiny,
      kind: a.habitatKind || "land",
    });
  }

  const candidatos = listarLaresProximos(px, py, r);
  for (let i = 0; i < candidatos.length; i++) {
    const lar = candidatos[i];
    if (!lar) continue;
    descobrirWild(lar.id, {
      x: lar.x,
      y: lar.y,
      speciesKey: lar.speciesKey,
      dex: lar.dex,
      shiny: lar.shiny,
    });
  }
}

export function serializarDescobertaMapa() {
  return {
    berries: Object.fromEntries(berries),
    wilds: Object.fromEntries(wilds),
  };
}

export function hidratarDescobertaMapa(bruto) {
  berries.clear();
  wilds.clear();
  if (bruto && typeof bruto === "object") {
    const b = bruto.berries || {};
    for (const id of Object.keys(b)) {
      const v = b[id];
      if (!v) continue;
      berries.set(id, {
        x: Number(v.x) || 0,
        y: Number(v.y) || 0,
        berryKey: String(v.berryKey || "oran"),
      });
    }
    const w = bruto.wilds || {};
    for (const id of Object.keys(w)) {
      const v = w[id];
      if (!v) continue;
      wilds.set(id, {
        x: Number(v.x) || 0,
        y: Number(v.y) || 0,
        speciesKey: String(v.speciesKey || "pidgey"),
        dex: v.dex | 0,
        shiny: !!v.shiny,
      });
    }
  }
  reconciliarWildsDescobertos();
  bump();
}

/** Resolve snapshot se só tivermos id (save antigo). */
export function completarWildSePreciso(larId) {
  const id = String(larId || "");
  if (!id) return null;
  descobrirWild(id, wilds.get(id) || { x: 0, y: 0, speciesKey: "pidgey" });
  return wilds.get(id) || null;
}
