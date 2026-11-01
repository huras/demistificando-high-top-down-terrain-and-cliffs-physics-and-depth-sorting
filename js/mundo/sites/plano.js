/**
 * Plano mundial de sítios outdoor: 1 por área rota/mato elegível.
 * Cache por área; farthest-template por bioma; âncora longe da estrada/cidade.
 */
import { CHUNK_XZ } from "../../config.js";
import { deLocalKanto, paraLocalKanto } from "../bounds.js";
import { alturaDoRelevo, nivelMarBlocos } from "../bioma/catalogo.js";
import {
  AREA_KANTO,
  CENTRO_AREA,
  LADO_KANTO,
  ehCidade,
  zonaEm,
} from "../regiao/grafoKanto.js";
import { MEIA_LARGURA_ESTRADA } from "../regiao/linhasEstrada.js";
import { getWorldShrinePlan } from "../../santuario/colocacao.js";
import { getWorldLetterPuzzlePlan } from "../../letras/plano.js";
import { biomaDaZona, zonaAceitaSite } from "./bioma.js";
import { expandirTemplate } from "./expandir.js";
import { hash3 } from "./hash.js";
import { TEMPLATES_SITE, templatesDoBioma } from "./templates.js";
import { TIPO_SITE } from "./catalogo.js";
import {
  amostrarPlazaNatural,
  aventalDoTipo,
  desnivelMaxDoTipo,
  plazaBoundsDoSite,
} from "./plaza.js";
import { carimbarPlanoSite, limparRelevoSites } from "./relevo.js";

/** @type {Map<string, object|null>} */
const cacheArea = new Map();
/** @type {Map<string, object[]>} */
const byChunk = new Map();
/** @type {object[]|null} */
let todosSites = null;

const FOLGA_SPAWN = 14;
const MEIO_RUA = MEIA_LARGURA_ESTRADA;

function chaveArea(ax, ay) {
  return `${ax},${ay}`;
}

function chaveChunk(cx, cy) {
  return `${cx},${cy}`;
}

function padFootprint(template) {
  const veg = template?.limpaVeg ?? 1;
  return Math.max(2, veg + 2);
}

function pertoDaEstrada(lx, ly) {
  return Math.abs(lx - CENTRO_AREA) <= MEIO_RUA + 1.5 || Math.abs(ly - CENTRO_AREA) <= MEIO_RUA + 1.5;
}

function longeDeMarcas(wx, wy, raio) {
  const r2 = raio * raio;
  const shrines = getWorldShrinePlan()?.slots || [];
  for (let i = 0; i < shrines.length; i++) {
    const s = shrines[i];
    const dx = s.x - wx;
    const dy = s.y - wy;
    if (dx * dx + dy * dy < r2) return false;
  }
  const slotsLetra = getWorldLetterPuzzlePlan()?.slots || [];
  for (let i = 0; i < slotsLetra.length; i++) {
    const s = slotsLetra[i];
    const dx = (s.x ?? s.wx) - wx;
    const dy = (s.y ?? s.wy) - wy;
    if (dx * dx + dy * dy < r2) return false;
  }
  return true;
}

function tileOk(ax, ay, lx, ly, bioma) {
  if (lx < 2 || ly < 2 || lx >= AREA_KANTO - 2 || ly >= AREA_KANTO - 2) return false;
  if (pertoDaEstrada(lx, ly)) return false;
  const origem = deLocalKanto(ax * AREA_KANTO + lx, ay * AREA_KANTO + ly);
  if (ehCidade(origem.x, origem.y)) return false;
  const h = alturaDoRelevo(origem.x, origem.y);
  const mar = nivelMarBlocos();
  if (bioma === "agua") {
    // Doca: aceita terra ou beira (não fundo aberto).
    return Number.isFinite(h);
  }
  if (!(h >= mar)) return false;
  if (bioma === "montanha" && h < mar + 8) return false;
  return longeDeMarcas(origem.x + 0.5, origem.y + 0.5, FOLGA_SPAWN);
}

function footprintLivre(ax, ay, x0, y0, w, h, bioma, pad) {
  for (let y = y0 - pad; y < y0 + h + pad; y++) {
    for (let x = x0 - pad; x < x0 + w + pad; x++) {
      const naBorda =
        x < x0 || y < y0 || x >= x0 + w || y >= y0 + h;
      if (naBorda) {
        if (x < 0 || y < 0 || x >= AREA_KANTO || y >= AREA_KANTO) continue;
        if (pertoDaEstrada(x, y)) return false;
        continue;
      }
      if (!tileOk(ax, ay, x, y, bioma)) return false;
    }
  }
  return true;
}

/**
 * Valida desnível natural do pad mundial; devolve hPad se ok.
 * @returns {{ x:number, y:number, hPad:number }|null}
 */
function ancoraComTerraço(ax, ay, template, bioma, x0, y0) {
  const pad = padFootprint(template);
  if (!footprintLivre(ax, ay, x0, y0, template.largura, template.altura, bioma, pad)) {
    return null;
  }
  const origem = deLocalKanto(ax * AREA_KANTO, ay * AREA_KANTO);
  const wx0 = Math.floor(origem.x + x0) - pad;
  const wy0 = Math.floor(origem.y + y0) - pad;
  const wx1 = Math.ceil(origem.x + x0 + template.largura) + pad;
  const wy1 = Math.ceil(origem.y + y0 + template.altura) + pad;
  const amostra = amostrarPlazaNatural(wx0, wy0, wx1, wy1, {
    desnivelMax: desnivelMaxDoTipo(template.tipo),
    exigeSeco: bioma !== "agua" && template.tipo !== TIPO_SITE.DOCA,
    minSecas: template.tipo === TIPO_SITE.DOCA ? 2 : 4,
  });
  if (!amostra?.ok) return null;
  return { x: x0, y: y0, hPad: amostra.hPad };
}

function acharAncora(ax, ay, template, bioma) {
  const w = template.largura;
  const h = template.altura;
  const base = hash3(ax, ay, 991);
  const xSpan = Math.max(1, AREA_KANTO - 8 - w);
  const ySpan = Math.max(1, AREA_KANTO - 8 - h);

  for (let i = 0; i < 96; i++) {
    const r = hash3(base, i, 4049);
    const x0 = 4 + (r % xSpan);
    const y0 = 4 + (hash3(r, i, 7717) % ySpan);
    const ok = ancoraComTerraço(ax, ay, template, bioma, x0, y0);
    if (ok) return ok;
  }

  const sx = CENTRO_AREA;
  const sy = CENTRO_AREA;
  const candidatos = [
    { x: sx - w - 10, y: sy - h - 10 },
    { x: sx + 10, y: sy - h - 10 },
    { x: sx - w - 10, y: sy + 10 },
    { x: sx + 10, y: sy + 10 },
  ];
  for (const c of candidatos) {
    const x0 = Math.max(4, Math.min(AREA_KANTO - 4 - w, c.x));
    const y0 = Math.max(4, Math.min(AREA_KANTO - 4 - h, c.y));
    const ok = ancoraComTerraço(ax, ay, template, bioma, x0, y0);
    if (ok) return ok;
  }

  const step = w >= 20 || h >= 16 ? 3 : 4;
  for (let y0 = 4; y0 <= AREA_KANTO - 4 - h; y0 += step) {
    for (let x0 = 4; x0 <= AREA_KANTO - 4 - w; x0 += step) {
      const ok = ancoraComTerraço(ax, ay, template, bioma, x0, y0);
      if (ok) return ok;
    }
  }
  return null;
}

function escolherTemplate(ax, ay, zona, bioma) {
  if (bioma === "montanha") return TEMPLATES_SITE.mirante;
  let lista = templatesDoBioma(bioma);
  if (!lista.length && bioma === "floresta") lista = templatesDoBioma("terra");
  if (!lista.length) lista = [TEMPLATES_SITE.posto];
  // Mirante só sobe em montanha.
  lista = lista.filter((t) => t.tipo !== TIPO_SITE.MIRANTE || bioma === "montanha");
  if (!lista.length) lista = [TEMPLATES_SITE.posto];
  const h = hash3(ax, ay, (zona?.tipo === "mato" ? 91 : 0) + lista.length * 17);
  return lista[h % lista.length];
}

function indexarSite(site) {
  if (!site) return;
  const anel = site.plaza?.anel ?? aventalDoTipo(site.tipo);
  const x0 = (site.plaza?.x0 ?? Math.floor(site.x0)) - anel;
  const y0 = (site.plaza?.y0 ?? Math.floor(site.y0)) - anel;
  const x1 = (site.plaza?.x1 ?? Math.ceil(site.x1)) + anel;
  const y1 = (site.plaza?.y1 ?? Math.ceil(site.y1)) + anel;
  const cx0 = Math.floor(x0 / CHUNK_XZ);
  const cy0 = Math.floor(y0 / CHUNK_XZ);
  const cx1 = Math.floor((x1 - 1) / CHUNK_XZ);
  const cy1 = Math.floor((y1 - 1) / CHUNK_XZ);
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const ck = chaveChunk(cx, cy);
      let lista = byChunk.get(ck);
      if (!lista) {
        lista = [];
        byChunk.set(ck, lista);
      }
      if (!lista.includes(site)) lista.push(site);
    }
  }
}

/**
 * Resolve (e cacheia) o sítio da área.
 * @returns {object|null}
 */
export function resolverSiteDaArea(ax, ay) {
  const key = chaveArea(ax, ay);
  if (cacheArea.has(key)) return cacheArea.get(key);

  const zona = zonaEm(ax, ay);
  if (!zonaAceitaSite(zona)) {
    cacheArea.set(key, null);
    return null;
  }

  const bioma = biomaDaZona(zona);
  const preferido = escolherTemplate(ax, ay, zona, bioma);
  let lista = templatesDoBioma(bioma);
  if (!lista.length) lista = templatesDoBioma("terra");
  const ordenados = [preferido, ...lista.filter((t) => t.id !== preferido.id)];

  let template = preferido;
  let ancora = null;
  for (const cand of ordenados) {
    const b = cand.biomas.includes(bioma) ? bioma : cand.biomas[0];
    ancora = acharAncora(ax, ay, cand, b);
    if (ancora) {
      template = cand;
      break;
    }
  }
  if (!ancora) {
    cacheArea.set(key, null);
    return null;
  }

  const origem = deLocalKanto(ax * AREA_KANTO, ay * AREA_KANTO);
  const siteId = `site-${ax}-${ay}-${template.id}`;
  const siteBase = expandirTemplate(
    template,
    ax,
    ay,
    ancora.x,
    ancora.y,
    siteId,
    origem
  );

  const plaza = plazaBoundsDoSite(siteBase);
  const anel = aventalDoTipo(template.tipo);
  const hPad = ancora.hPad | 0;
  if (plaza) {
    carimbarPlanoSite(plaza.x0, plaza.y0, plaza.x1, plaza.y1, hPad, anel);
  }

  const site = Object.freeze({
    ...siteBase,
    hPad,
    plaza: plaza
      ? Object.freeze({
          x0: plaza.x0,
          y0: plaza.y0,
          x1: plaza.x1,
          y1: plaza.y1,
          anel,
        })
      : null,
  });

  cacheArea.set(key, site);
  indexarSite(site);
  return site;
}

/** Garante o plano das áreas ao redor (stream). */
export function garantirSitesVizinhos(ax, ay, raio = 1) {
  for (let dy = -raio; dy <= raio; dy++) {
    for (let dx = -raio; dx <= raio; dx++) {
      const x = ax + dx;
      const y = ay + dy;
      if (x < 0 || y < 0 || x >= LADO_KANTO || y >= LADO_KANTO) continue;
      resolverSiteDaArea(x, y);
    }
  }
}

export function sitesDoChunk(cx, cy) {
  // Garante áreas Kanto que tocam este chunk (coords mundiais → locais).
  const wx0 = cx * CHUNK_XZ;
  const wy0 = cy * CHUNK_XZ;
  const a0 = paraLocalKanto(wx0, wy0);
  const a1 = paraLocalKanto(wx0 + CHUNK_XZ - 1, wy0 + CHUNK_XZ - 1);
  const ax0 = Math.floor(a0.x / AREA_KANTO);
  const ay0 = Math.floor(a0.y / AREA_KANTO);
  const ax1 = Math.floor(a1.x / AREA_KANTO);
  const ay1 = Math.floor(a1.y / AREA_KANTO);
  for (let ay = ay0; ay <= ay1; ay++) {
    for (let ax = ax0; ax <= ax1; ax++) {
      if (ax < 0 || ay < 0 || ax >= LADO_KANTO || ay >= LADO_KANTO) continue;
      resolverSiteDaArea(ax, ay);
    }
  }
  return byChunk.get(chaveChunk(cx, cy)) || [];
}

export function siteEm(wx, wy) {
  const local = paraLocalKanto(wx, wy);
  const ax = Math.floor(local.x / AREA_KANTO);
  const ay = Math.floor(local.y / AREA_KANTO);
  if (ax < 0 || ay < 0 || ax >= LADO_KANTO || ay >= LADO_KANTO) return null;
  const site = resolverSiteDaArea(ax, ay);
  if (!site) return null;
  if (wx < site.x0 || wy < site.y0 || wx >= site.x1 || wy >= site.y1) return null;
  return site;
}

export function limparCacheSites() {
  cacheArea.clear();
  byChunk.clear();
  todosSites = null;
  limparRelevoSites();
}

export function listarSites() {
  if (todosSites) return todosSites;
  const lista = [];
  for (let ay = 0; ay < LADO_KANTO; ay++) {
    for (let ax = 0; ax < LADO_KANTO; ax++) {
      const s = resolverSiteDaArea(ax, ay);
      if (s) lista.push(s);
    }
  }
  todosSites = lista;
  return lista;
}

export function peekSiteDaArea(ax, ay) {
  return cacheArea.get(chaveArea(ax, ay));
}
