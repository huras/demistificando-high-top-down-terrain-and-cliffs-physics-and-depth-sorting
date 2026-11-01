/**
 * Terraço + decoração dos lares: carimbo de altura (núcleo + avental) e props
 * (pedras, árvores, detalhes) injetados no chunk — padrão letras/santuário.
 */
import {
  CHUNK_XZ,
  POKEMON,
  RAIO_BASE_ARVORE,
  RAIO_BASE_PEDRA,
  SEED_MUNDO,
} from "../config.js";
import { temPlanoLetra } from "../letras/relevo.js";
import { temPlanoSite } from "../mundo/sites/relevo.js";
import { areaLogicaNoMundo } from "../mundo/bioma/areasMundo.js";
import {
  alturaDoRelevo,
  alturaDoRelevoNatural,
  biomaDominante,
  nivelMarBlocos,
} from "../mundo/bioma/catalogo.js";
import { obterKit, sortearSprite } from "../mundo/bioma/kits.js";
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
import { amostraKanto, dentroDoKanto } from "../mundo/regiao/amostraKanto.js";
import { ehCidade } from "../mundo/regiao/grafoKanto.js";
import { larTocaEstrada } from "./laresEstrada.js";
import { larTocaPoi } from "./laresPoi.js";
import {
  ORIGEM_SANTUARIO_X,
  ORIGEM_SANTUARIO_Y,
  SHRINE_INTERIOR_COLS,
  SHRINE_INTERIOR_ROWS,
  dentroDoTerrenoSantuario,
} from "../santuario/interior.js";
import { dadosProntos, especie } from "./dados.js";
import { nivelEm } from "./distribuicao/forca.js";
import { sortearEspecie } from "./distribuicao/sorteio.js";
import { HABITAT, temFlapAround } from "./habitat/index.js";
import { infoTileHabitat } from "./habitat/tile.js";
import {
  carimbarPlanoLar,
  ehNucleoPlanoLar,
  temPlanoLar,
} from "./laresRelevo.js";

/** Raio Chebyshev do núcleo plano em terra (2 → 5×5). */
export const LAR_NUCLEO_RAIO = 2;
/** Núcleo dos ninhos altos FlapAround (1 → 3×3). */
export const LAR_NUCLEO_RAIO_VOADOR = 1;
/** Anéis de avental (degraus) ao redor do núcleo. */
export const LAR_AVENTAL = 2;
/** Offset do terraço vs. natural (0 = achata no chão local). */
export const LAR_ELEVACAO = 0;
/** Lares FlapAround: mesa alta acima do chão local. */
export const LAR_ELEVACAO_VOADOR_MIN = 10;
export const LAR_ELEVACAO_VOADOR_MAX = 15;
/** Desnível máximo no núcleo pra aceitar o carimbo. */
export const LAR_DESNIVEL_MAX = 3;
/** Vão de entrada/saída na borda de pedras (células de largura). */
export const LAR_ABERTURA_LARGURA = 2;

const FOLGA_VAZIO = 56;
const FALLBACK_PEDRA = "stone-rock-a";
const FALLBACK_ARVORE = "tall-tree-light-green";
const FALLBACK_GRAMA = "tuft";

/** @type {Set<string>} */
const carimbados = new Set();
/** @type {Set<string>} */
const rejeitados = new Set();
/**
 * @type {Map<string, {
 *   id: string, tx: number, ty: number, x0: number, y0: number, x1: number, y1: number,
 *   h: number, cx: number, cy: number, indice: number
 * }>}
 */
const sitios = new Map();

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
  if (
    dentroDoTerrenoSala(x, y) ||
    dentroDoTerrenoLaboratorio(x, y) ||
    dentroDoTerrenoSantuario(x, y)
  ) {
    return true;
  }
  const faixas = faixasSemSelvagem();
  for (let i = 0; i < faixas.length; i++) {
    const f = faixas[i];
    if (naFaixa(x, y, f.x0, f.y0, f.x1, f.y1, FOLGA_VAZIO)) return true;
  }
  return (
    naFaixa(x, y, ORIGEM_LAB_X, ORIGEM_LAB_Y, ORIGEM_LAB_X + COLS_LAB, ORIGEM_LAB_Y + ROWS_LAB, FOLGA_VAZIO) ||
    naFaixa(x, y, ORIGEM_SALA_X, ORIGEM_SALA_Y, ORIGEM_SALA_X + MIOL_X + 2, ORIGEM_SALA_Y + MIOL_Y + 2, FOLGA_VAZIO) ||
    naFaixa(
      x,
      y,
      ORIGEM_SANTUARIO_X,
      ORIGEM_SANTUARIO_Y,
      ORIGEM_SANTUARIO_X + SHRINE_INTERIOR_COLS,
      ORIGEM_SANTUARIO_Y + SHRINE_INTERIOR_ROWS,
      FOLGA_VAZIO,
    )
  );
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
    tx: cx * CHUNK_XZ + ox,
    ty: cy * CHUNK_XZ + oy,
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

/** Mesma espécie do lar terrestre (hash alinhado com laresMapa / populacao). */
function especieDoLar(cx, cy, indice, x, y) {
  if (!dadosProntos()) return null;
  // Água: sem carimbo de terraço (lares aquáticos não passam daqui).
  const tile = infoTileHabitat(x, y);
  if (tile.molhado && tile.profundidade >= 1) return null;
  const biomaId = biomaIdEm(x, y, hash(cx, cy, 35 + indice));
  const nivel = nivelEm(x, y);
  const chave = sortearEspecie(biomaId, hash(cx, cy, 40 + indice), nivel, {
    habitat: HABITAT.LAND,
  });
  return especie(chave) || especie("pidgey");
}

/** Elevação determinística: FlapAround 10..15, senão LAR_ELEVACAO. */
function elevacaoDoLar(cx, cy, indice, esp) {
  if (!temFlapAround(esp)) return LAR_ELEVACAO | 0;
  const min = Math.max(0, LAR_ELEVACAO_VOADOR_MIN | 0);
  const max = Math.max(min, LAR_ELEVACAO_VOADOR_MAX | 0);
  return min + (hash(cx, cy, 60 + indice) % (max - min + 1));
}

function kitDoPonto(wx, wy) {
  const bioma = biomaDominante(wx, wy);
  return obterKit(bioma?.kit) || null;
}

function spriteDoKit(kit, chave, u, fallback) {
  const lista = kit?.[chave];
  if (lista?.length) {
    const id = sortearSprite(lista, u);
    if (id) return id;
  }
  return fallback;
}

/**
 * Garante carimbo de terraço para um slot (idempotente).
 * @returns {boolean}
 */
export function garantirSitioLar(cx, cy, indice) {
  const id = `${cx},${cy},${indice}`;
  if (carimbados.has(id) || rejeitados.has(id)) return carimbados.has(id);

  const pos = posicaoCandidata(cx, cy, indice);
  if (!pos) {
    rejeitados.add(id);
    return false;
  }
  const { x, y, tx, ty } = pos;
  if (
    zonaSemSelvagem(x, y) ||
    ehCidade(x, y) ||
    Math.hypot(x - SPAWN.x, y - SPAWN.y) < POKEMON.FOLGA_SPAWN ||
    !longeDeVizinhos(cx, cy, indice, x, y) ||
    temPlanoLetra(tx, ty) ||
    temPlanoSite(tx, ty) ||
    larTocaEstrada(x, y) ||
    larTocaPoi(x, y)
  ) {
    rejeitados.add(id);
    return false;
  }

  const esp = especieDoLar(cx, cy, indice, x, y);
  if (!esp) {
    rejeitados.add(id);
    return false;
  }
  const elev = elevacaoDoLar(cx, cy, indice, esp);
  const voador = elev >= LAR_ELEVACAO_VOADOR_MIN;
  // Flying nest: só 3×3; terra continua 5×5.
  const raio = Math.max(
    0,
    voador ? LAR_NUCLEO_RAIO_VOADOR | 0 : LAR_NUCLEO_RAIO | 0,
  );
  const x0 = tx - raio;
  const y0 = ty - raio;
  const x1 = tx + raio + 1;
  const y1 = ty + raio + 1;
  const nivel = nivelMarBlocos();
  let minH = Infinity;
  let maxH = -Infinity;
  for (let wy = y0; wy < y1; wy++) {
    for (let wx = x0; wx < x1; wx++) {
      if (temPlanoLetra(wx, wy) || temPlanoSite(wx, wy)) {
        rejeitados.add(id);
        return false;
      }
      const hn = alturaDoRelevoNatural(wx, wy) | 0;
      if (hn < minH) minH = hn;
      if (hn > maxH) maxH = hn;
    }
  }
  if (!Number.isFinite(minH) || minH <= nivel) {
    rejeitados.add(id);
    return false;
  }
  if (maxH - minH > LAR_DESNIVEL_MAX) {
    rejeitados.add(id);
    return false;
  }

  const h = Math.max(nivel + 1, minH + elev);
  carimbarPlanoLar(x0, y0, x1, y1, h, LAR_AVENTAL);
  carimbados.add(id);
  const kind = voador ? HABITAT.HIGH : HABITAT.LAND;
  sitios.set(id, {
    id,
    tx,
    ty,
    x0,
    y0,
    x1,
    y1,
    h,
    cx,
    cy,
    indice,
    kind,
    elev,
    nucleoRaio: raio,
  });
  return true;
}

/** @returns {{ kind: string, elev: number, h: number } | null} */
export function sitioLarPorId(larId) {
  return sitios.get(String(larId || "")) || null;
}

/** Carimba lares cujo núcleo/avental toca este chunk (vizinhos inclusos). */
export function garantirLaresNoChunk(cx, cy) {
  const nucleoMax = Math.max(LAR_NUCLEO_RAIO | 0, LAR_NUCLEO_RAIO_VOADOR | 0);
  const pad = Math.max(0, nucleoMax + (LAR_AVENTAL | 0));
  const alcance = Math.max(1, Math.ceil(pad / CHUNK_XZ) + 1);
  const maxSlot = slotsPorChunk();
  for (let ny = cy - alcance; ny <= cy + alcance; ny++) {
    for (let nx = cx - alcance; nx <= cx + alcance; nx++) {
      for (let i = 0; i < maxSlot; i++) garantirSitioLar(nx, ny, i);
    }
  }
}

/**
 * Células do sítio (núcleo + avental) neste chunk — limpa veg genérica.
 * @returns {Set<string> | null}
 */
export function celulasSitioLarChunk(cx, cy) {
  garantirLaresNoChunk(cx, cy);
  const set = new Set();
  const baseX = cx * CHUNK_XZ;
  const baseY = cy * CHUNK_XZ;
  const nucleoMax = Math.max(LAR_NUCLEO_RAIO | 0, LAR_NUCLEO_RAIO_VOADOR | 0);
  const pad = Math.max(0, nucleoMax + (LAR_AVENTAL | 0));
  for (const sitio of sitios.values()) {
    const xa = sitio.x0 - pad;
    const ya = sitio.y0 - pad;
    const xb = sitio.x1 + pad;
    const yb = sitio.y1 + pad;
    if (xb <= baseX || xa >= baseX + CHUNK_XZ || yb <= baseY || ya >= baseY + CHUNK_XZ) {
      continue;
    }
    for (let wy = ya; wy < yb; wy++) {
      for (let wx = xa; wx < xb; wx++) {
        if (wx < baseX || wy < baseY || wx >= baseX + CHUNK_XZ || wy >= baseY + CHUNK_XZ) {
          continue;
        }
        if (temPlanoLar(wx, wy)) set.add(`${wx},${wy}`);
      }
    }
  }
  return set.size ? set : null;
}

/**
 * Só o núcleo plano (palha / sem árvore no miolo).
 * @returns {Set<string> | null}
 */
export function celulasNucleoLarChunk(cx, cy) {
  garantirLaresNoChunk(cx, cy);
  const set = new Set();
  const baseX = cx * CHUNK_XZ;
  const baseY = cy * CHUNK_XZ;
  for (const sitio of sitios.values()) {
    for (let wy = sitio.y0; wy < sitio.y1; wy++) {
      for (let wx = sitio.x0; wx < sitio.x1; wx++) {
        if (wx < baseX || wy < baseY || wx >= baseX + CHUNK_XZ || wy >= baseY + CHUNK_XZ) {
          continue;
        }
        if (ehNucleoPlanoLar(wx, wy)) set.add(`${wx},${wy}`);
      }
    }
  }
  return set.size ? set : null;
}

function propBase(id, x, y, tipo, sprite, r, extra) {
  return {
    id,
    x,
    y,
    z: alturaDoRelevo(x, y),
    r,
    tipo,
    sprite,
    porte: 0,
    larDecor: true,
    ...extra,
  };
}

/**
 * Face da abertura (0=N,1=E,2=S,3=W) + intervalo [a,b) no eixo da face.
 * Largura = LAR_ABERTURA_LARGURA (2 tiles).
 * @param {{ id: string, x0: number, y0: number, x1: number, y1: number, cx?: number, cy?: number, indice?: number }} sitio
 */
function specAberturaLar(sitio) {
  const w = Math.max(1, (sitio.x1 | 0) - (sitio.x0 | 0));
  const h = Math.max(1, (sitio.y1 | 0) - (sitio.y0 | 0));
  const largura = Math.min(
    Math.max(1, LAR_ABERTURA_LARGURA | 0),
    Math.max(1, Math.min(w, h)),
  );
  const face = hash(sitio.cx | 0, sitio.cy | 0, 0x414245 + (sitio.indice | 0)) % 4;
  if (face === 0 || face === 2) {
    // Norte / Sul: vão em X
    const maxStart = Math.max(0, w - largura);
    const start = maxStart
      ? hash(sitio.x0, sitio.y0, 0x4f5045 + face) % (maxStart + 1)
      : 0;
    return {
      face,
      a: (sitio.x0 | 0) + start,
      b: (sitio.x0 | 0) + start + largura,
    };
  }
  // Leste / Oeste: vão em Y
  const maxStart = Math.max(0, h - largura);
  const start = maxStart
    ? hash(sitio.x0, sitio.y0, 0x4f5045 + face) % (maxStart + 1)
    : 0;
  return {
    face,
    a: (sitio.y0 | 0) + start,
    b: (sitio.y0 | 0) + start + largura,
  };
}

/**
 * Célula no corredor de entrada (borda do núcleo + avental na face).
 * @param {object} sitio
 * @param {number} wx
 * @param {number} wy
 * @param {number} ring
 * @param {{ face: number, a: number, b: number }} [spec]
 */
function ehAberturaLar(sitio, wx, wy, ring, spec) {
  const s = spec || specAberturaLar(sitio);
  const pad = Math.max(0, LAR_AVENTAL | 0);
  // Espessura radial: núcleo (ring 0) + avental inteiro — vão atravessável.
  if (ring > pad) return false;
  if (s.face === 0) {
    // Norte: y na borda norte + avental pra fora
    if (wy > (sitio.y0 | 0) || wy < (sitio.y0 | 0) - pad) return false;
    return wx >= s.a && wx < s.b;
  }
  if (s.face === 2) {
    if (wy < (sitio.y1 | 0) - 1 || wy > (sitio.y1 | 0) - 1 + pad) return false;
    return wx >= s.a && wx < s.b;
  }
  if (s.face === 1) {
    if (wx < (sitio.x1 | 0) - 1 || wx > (sitio.x1 | 0) - 1 + pad) return false;
    return wy >= s.a && wy < s.b;
  }
  // Oeste
  if (wx > (sitio.x0 | 0) || wx < (sitio.x0 | 0) - pad) return false;
  return wy >= s.a && wy < s.b;
}

/**
 * Pedras na borda do núcleo, árvores no avental, tufts de detalhe.
 * @returns {object[]}
 */
export function propsLarChunk(cx, cy) {
  garantirLaresNoChunk(cx, cy);
  const baseX = cx * CHUNK_XZ;
  const baseY = cy * CHUNK_XZ;
  const out = [];

  for (const sitio of sitios.values()) {
    const pad = LAR_AVENTAL | 0;
    const xa = sitio.x0 - pad;
    const ya = sitio.y0 - pad;
    const xb = sitio.x1 + pad;
    const yb = sitio.y1 + pad;
    if (xb <= baseX || xa >= baseX + CHUNK_XZ || yb <= baseY || ya >= baseY + CHUNK_XZ) {
      continue;
    }

    const kit = kitDoPonto(sitio.tx, sitio.ty);
    const abertura = specAberturaLar(sitio);
    let nPedra = 0;
    let nArvore = 0;
    let nDetalhe = 0;

    for (let wy = ya; wy < yb; wy++) {
      for (let wx = xa; wx < xb; wx++) {
        if (wx < baseX || wy < baseY || wx >= baseX + CHUNK_XZ || wy >= baseY + CHUNK_XZ) {
          continue;
        }
        if (!temPlanoLar(wx, wy)) continue;

        const dx = wx < sitio.x0 ? sitio.x0 - wx : wx >= sitio.x1 ? wx - (sitio.x1 - 1) : 0;
        const dy = wy < sitio.y0 ? sitio.y0 - wy : wy >= sitio.y1 ? wy - (sitio.y1 - 1) : 0;
        const ring = Math.max(dx, dy);
        const cxCel = wx + 0.5;
        const cyCel = wy + 0.5;
        const u = unidade(hash(wx, wy, 0x4c4152));

        // Miolo: só a palha — sem prop.
        if (ring === 0 && wx === sitio.tx && wy === sitio.ty) continue;

        // Corredor de entrada/saída (2 tiles): sem pedra/árvore.
        if (ehAberturaLar(sitio, wx, wy, ring, abertura)) continue;

        // Borda do núcleo: pedras de demarcação.
        if (ring === 0) {
          const naBorda =
            wx === sitio.x0 || wx === sitio.x1 - 1 || wy === sitio.y0 || wy === sitio.y1 - 1;
          if (!naBorda) continue;
          if (u > 0.62) continue;
          const sprite = spriteDoKit(kit, "pedra", u, FALLBACK_PEDRA);
          out.push(
            propBase(`lar:${sitio.id}:pedra:${nPedra++}`, cxCel, cyCel, "pedra", sprite, RAIO_BASE_PEDRA, {
              larId: sitio.id,
            }),
          );
          continue;
        }

        // Avental interno (ring 1): pedras soltas + tufts.
        if (ring === 1) {
          if (u < 0.28) {
            const sprite = spriteDoKit(kit, "pedra", unidade(hash(wx, wy, 0x504544)), FALLBACK_PEDRA);
            out.push(
              propBase(`lar:${sitio.id}:pedra:${nPedra++}`, cxCel, cyCel, "pedra", sprite, RAIO_BASE_PEDRA, {
                larId: sitio.id,
              }),
            );
          } else if (u > 0.72) {
            const sprite = spriteDoKit(kit, "grama", unidade(hash(wx, wy, 0x47524d)), FALLBACK_GRAMA);
            out.push(
              propBase(`lar:${sitio.id}:det:${nDetalhe++}`, cxCel, cyCel, "grama", sprite, 0.2, {
                larId: sitio.id,
              }),
            );
          }
          continue;
        }

        // Avental externo: árvores + detalhes esparsos.
        if (ring >= 2) {
          const u2 = unidade(hash(wx, wy, 0x545245));
          if (u2 < 0.18 && nArvore < 4) {
            const sprite = spriteDoKit(kit, "arvore", u2, FALLBACK_ARVORE);
            out.push(
              propBase(`lar:${sitio.id}:arv:${nArvore++}`, cxCel, cyCel, "arvore", sprite, RAIO_BASE_ARVORE, {
                larId: sitio.id,
              }),
            );
          } else if (u2 > 0.82) {
            const sprite = spriteDoKit(kit, "grama", unidade(hash(wx, wy, 0x47524d)), FALLBACK_GRAMA);
            out.push(
              propBase(`lar:${sitio.id}:det:${nDetalhe++}`, cxCel, cyCel, "grama", sprite, 0.2, {
                larId: sitio.id,
              }),
            );
          }
        }
      }
    }
  }
  return out;
}
