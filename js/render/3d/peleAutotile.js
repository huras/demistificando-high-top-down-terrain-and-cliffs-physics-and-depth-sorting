/**
 * Folha de splat 3×4 (16 px), os mesmos papéis do chão do Pokémon AI.
 * Cada quadrante fica com o tile de centro, borda ou quina que a máscara pede.
 */
import { kitDoRelevo } from "../../mundo/bioma/catalogo.js";
import { cruSplat, nomePele } from "../../mundo/bioma/detalhe.js";
import { ehCaminhoKanto } from "../../mundo/regiao/amostraKanto.js";

const COLS = 3;
const ROWS = 4;
const PAPEL = {
  PACK_OUT: 0,
  CENTER: 1,
  PACK_IN: 2,
  OUT_NW: 3,
  EDGE_N: 4,
  OUT_NE: 5,
  EDGE_W: 6,
  EDGE_E: 8,
  OUT_SW: 9,
  EDGE_S: 10,
  OUT_SE: 11,
};
const SUB = {
  NW: [0, 0, 0.5, 0.5],
  NE: [0.5, 0, 1, 0.5],
  SW: [0, 0.5, 0.5, 1],
  SE: [0.5, 0.5, 1, 1],
};
const ORDEM = ["NW", "NE", "SW", "SE"];
const CAIXA = {
  NW: { x0: 0, z0: 0, x1: 0.5, z1: 0.5, bu0: 0, bv0: 0.5, bu1: 0.5, bv1: 1 },
  NE: { x0: 0.5, z0: 0, x1: 1, z1: 0.5, bu0: 0.5, bv0: 0.5, bu1: 1, bv1: 1 },
  SW: { x0: 0, z0: 0.5, x1: 0.5, z1: 1, bu0: 0, bv0: 0, bu1: 0.5, bv1: 0.5 },
  SE: { x0: 0.5, z0: 0.5, x1: 1, z1: 1, bu0: 0.5, bv0: 0, bu1: 1, bv1: 0.5 },
};

const cacheKit = new Map();
const cachePeso = new Map();

function guardar(mapa, chave, valor) {
  if (mapa.size > 200000) mapa.clear();
  mapa.set(chave, valor);
  return valor;
}

function kitEm(x, y) {
  const chave = `${x},${y}`;
  if (cacheKit.has(chave)) return cacheKit.get(chave);
  return guardar(cacheKit, chave, kitDoRelevo(x, y) || "");
}

function cruEm(x, y) {
  return cruSplat(x, y, kitEm(x, y));
}

/** 1 se a célula entra na mancha e tem um vizinho cardeal na mesma mancha. */
export function pesoSplat(wx, wy) {
  const x = wx | 0;
  const y = wy | 0;
  const chave = `${x},${y}`;
  if (cachePeso.has(chave)) return cachePeso.get(chave);
  const cru = ehCaminhoKanto(x, y) || cruEm(x, y);
  const vizinho = (nx, ny) => ehCaminhoKanto(nx, ny) || cruEm(nx, ny);
  const peso = cru && (vizinho(x - 1, y) || vizinho(x + 1, y) || vizinho(x, y - 1) || vizinho(x, y + 1)) ? 1 : 0;
  return guardar(cachePeso, chave, peso);
}

function cardinais(n, s, w, e) {
  return (n ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0) + (e ? 1 : 0);
}

function ehFilamento(n, s, w, e, nw, ne, sw, se) {
  const nCard = cardinais(n, s, w, e);
  if (nCard === 0) return !(nw || ne || sw || se);
  return false;
}

function resolverAros(n, s, w, e, nw, ne, sw, se) {
  const aros = [];
  const nCard = cardinais(n, s, w, e);
  if (ehFilamento(n, s, w, e, nw, ne, sw, se)) {
    aros.push({ pack: "PACK_OUT", q: "NW" }, { pack: "PACK_OUT", q: "NE" }, { pack: "PACK_OUT", q: "SW" }, { pack: "PACK_OUT", q: "SE" });
    return aros;
  }
  let pulaBorda = false;
  if (nCard === 2) {
    if (n && e && !s && !w) { aros.push({ full: "OUT_SW" }); pulaBorda = true; }
    else if (n && w && !s && !e) { aros.push({ full: "OUT_SE" }); pulaBorda = true; }
    else if (s && w && !n && !e) { aros.push({ full: "OUT_NE" }); pulaBorda = true; }
    else if (s && e && !n && !w) { aros.push({ full: "OUT_NW" }); pulaBorda = true; }
  }
  const coberto = { NW: false, NE: false, SW: false, SE: false };
  const marca = (q, aro) => {
    aros.push(aro);
    coberto[q] = true;
  };
  if (n && w && !nw) marca("NW", { pack: "PACK_IN", q: "NW" });
  if (n && e && !ne) marca("NE", { pack: "PACK_IN", q: "NE" });
  if (s && w && !sw) marca("SW", { pack: "PACK_IN", q: "SW" });
  if (s && e && !se) marca("SE", { pack: "PACK_IN", q: "SE" });
  if (pulaBorda) return aros;
  if (!n && !w) marca("NW", { pack: "PACK_OUT", q: "NW" });
  if (!n && !e) marca("NE", { pack: "PACK_OUT", q: "NE" });
  if (!s && !w) marca("SW", { pack: "PACK_OUT", q: "SW" });
  if (!s && !e) marca("SE", { pack: "PACK_OUT", q: "SE" });
  if (!n) {
    if (!coberto.NW) aros.push({ edge: "EDGE_N", q: "NW" });
    if (!coberto.NE) aros.push({ edge: "EDGE_N", q: "NE" });
  }
  if (!s) {
    if (!coberto.SW) aros.push({ edge: "EDGE_S", q: "SW" });
    if (!coberto.SE) aros.push({ edge: "EDGE_S", q: "SE" });
  }
  if (!w) {
    if (!coberto.NW) aros.push({ edge: "EDGE_W", q: "NW" });
    if (!coberto.SW) aros.push({ edge: "EDGE_W", q: "SW" });
  }
  if (!e) {
    if (!coberto.NE) aros.push({ edge: "EDGE_E", q: "NE" });
    if (!coberto.SE) aros.push({ edge: "EDGE_E", q: "SE" });
  }
  return aros;
}

function uvTile(tileId, sub) {
  const col = tileId % COLS;
  const row = (tileId / COLS) | 0;
  const su0 = sub ? sub[0] : 0;
  const sv0 = sub ? sub[1] : 0;
  const su1 = sub ? sub[2] : 1;
  const sv1 = sub ? sub[3] : 1;
  let u0 = (col + su0) / COLS;
  let u1 = (col + su1) / COLS;
  let vTopo = 1 - (row + sv0) / ROWS;
  let vBase = 1 - (row + sv1) / ROWS;
  const iu = 0.5 / (COLS * 16);
  const iv = 0.5 / (ROWS * 16);
  if (su0 === 0) u0 += iu;
  if (su1 === 1) u1 -= iu;
  if (sv0 === 0) vTopo -= iv;
  if (sv1 === 1) vBase += iv;
  return [u0, vBase, u1, vTopo];
}

function pecaDe(q, uv) {
  const caixa = CAIXA[q];
  return {
    x0: caixa.x0,
    z0: caixa.z0,
    x1: caixa.x1,
    z1: caixa.z1,
    bu0: caixa.bu0,
    bv0: caixa.bv0,
    bu1: caixa.bu1,
    bv1: caixa.bv1,
    pu0: uv[0],
    pv0: uv[1],
    pu1: uv[2],
    pv1: uv[3],
  };
}

/** Quatro quadrantes, ou um quad inteiro quando a pele não é folha. */
export function pecasDaMascara(n, s, w, e, nw, ne, sw, se, folha) {
  if (!folha) {
    return [{
      x0: 0, z0: 0, x1: 1, z1: 1,
      bu0: 0, bv0: 0, bu1: 1, bv1: 1,
      pu0: 0, pv0: 0, pu1: 1, pv1: 1,
    }];
  }
  const slot = { NW: null, NE: null, SW: null, SE: null };
  const slotTile = { NW: -1, NE: -1, SW: -1, SE: -1 };
  const pinta = (q, tile, sub) => {
    slot[q] = uvTile(tile, sub);
    slotTile[q] = tile;
  };
  const pintaCheio = (tile) => {
    for (let i = 0; i < ORDEM.length; i++) pinta(ORDEM[i], tile, SUB[ORDEM[i]]);
  };
  const aros = resolverAros(n, s, w, e, nw, ne, sw, se);
  if (!ehFilamento(n, s, w, e, nw, ne, sw, se)) {
    let cheio = false;
    const coberto = { NW: false, NE: false, SW: false, SE: false };
    for (let i = 0; i < aros.length; i++) {
      const aro = aros[i];
      if (aro.full) {
        cheio = true;
        break;
      }
      if (aro.q) coberto[aro.q] = true;
    }
    if (!cheio) {
      const faltam = [];
      for (let i = 0; i < ORDEM.length; i++) {
        if (!coberto[ORDEM[i]]) faltam.push(ORDEM[i]);
      }
      if (faltam.length === 4) pintaCheio(PAPEL.CENTER);
      else for (let i = 0; i < faltam.length; i++) pinta(faltam[i], PAPEL.CENTER, SUB[faltam[i]]);
    }
  }
  for (let i = 0; i < aros.length; i++) {
    const aro = aros[i];
    const tile = PAPEL[aro.full || aro.pack || aro.edge] ?? PAPEL.CENTER;
    if (aro.full) pintaCheio(tile);
    else if (aro.q) pinta(aro.q, tile, SUB[aro.q]);
  }
  const tileCheio = slotTile.NW;
  if (tileCheio >= 0 && ORDEM.every((q) => slotTile[q] === tileCheio)) {
    const uv = uvTile(tileCheio);
    return [{
      x0: 0, z0: 0, x1: 1, z1: 1,
      bu0: 0, bv0: 0, bu1: 1, bv1: 1,
      pu0: uv[0], pv0: uv[1], pu1: uv[2], pv1: uv[3],
    }];
  }
  const pecas = [];
  for (let i = 0; i < ORDEM.length; i++) {
    const uv = slot[ORDEM[i]];
    if (uv) pecas.push(pecaDe(ORDEM[i], uv));
  }
  return pecas;
}

function mesmaPele(x, y, nome) {
  return !!nome && pesoSplat(x, y) === 1 && nomePele(kitEm(x, y)) === nome;
}

/** Pedaços do topo em espaço 0..1 da célula. Null se esta célula não mancha. */
export function pecasNoMundo(wx, wy) {
  const x = wx | 0;
  const y = wy | 0;
  if (pesoSplat(x, y) !== 1) return null;
  const nome = nomePele(kitEm(x, y));
  if (!nome) return null;
  const mesma = (nx, ny) => mesmaPele(nx, ny, nome);
  return pecasDaMascara(
    mesma(x, y - 1),
    mesma(x, y + 1),
    mesma(x - 1, y),
    mesma(x + 1, y),
    mesma(x - 1, y - 1),
    mesma(x + 1, y - 1),
    mesma(x - 1, y + 1),
    mesma(x + 1, y + 1),
    nome !== "floor-1",
  );
}
