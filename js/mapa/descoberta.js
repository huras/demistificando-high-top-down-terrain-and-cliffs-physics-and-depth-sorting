/**
 * Discovery de berries e wild homes para pins de mapa.
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
  if (!id || wilds.has(id)) return false;
  wilds.set(id, {
    x: info.x,
    y: info.y,
    speciesKey: info.speciesKey,
    dex: info.dex | 0,
    shiny: !!info.shiny,
  });
  bump();
  return true;
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
    const larId = a.id.slice(4);
    if (wilds.has(larId)) continue;
    const hx = a.casaX ?? a.x;
    const hy = a.casaY ?? a.y;
    const dx = hx - px;
    const dy = hy - py;
    if (dx * dx + dy * dy > r * r) continue;
    descobrirWild(larId, {
      x: hx,
      y: hy,
      speciesKey: a.especie?.key || "pidgey",
      dex: a.especie?.dex | 0,
      shiny: !!a.shiny,
    });
  }

  const candidatos = listarLaresProximos(px, py, r);
  for (let i = 0; i < candidatos.length; i++) {
    const lar = candidatos[i];
    if (!lar || wilds.has(lar.id)) continue;
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
  bump();
}

/** Resolve snapshot se só tivermos id (save antigo). */
export function completarWildSePreciso(larId) {
  if (wilds.has(larId)) return wilds.get(larId);
  const lar = resolverLarPorId(larId);
  if (!lar) return null;
  descobrirWild(lar.id, lar);
  return wilds.get(larId);
}
