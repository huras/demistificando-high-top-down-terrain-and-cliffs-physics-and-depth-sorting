import {
  CHUNK_XZ,
  NAV_FOLGA_DISCO,
  RAIO_BASE_ARVORE,
  RAIO_BASE_PEDRA,
  RAIO_CORPO,
  RAIO_POKEMON,
} from "../config.js";
import { ALTURAS, PROPS } from "../mundo/mapaDemo.js";
import { RAIO_SANTUARIO } from "../santuario/catalogo.js";

/** Mesmo piso: um degrau ainda encosta; voo alto passa. */
const FOLGA_PISO = 1.05;

/** @type {Map<string, object[]>} */
const porCelula = new Map();
/** @type {Map<string, object[]>} */
const porChunk = new Map();

const corposFixos = [];
const corposAtores = [];

/** @type {((aabb: { x0: number, y0: number, x1: number, y1: number } | null) => void) | null} */
let onBasesDirty = null;

/** Registra listener (navGrade) pra sujar path quando discos mudam. */
export function aoBasesDirty(fn) {
  onBasesDirty = fn;
}

function chaveChunk(cx, cy) {
  return `${cx | 0},${cy | 0}`;
}

function chaveCelula(x, y) {
  return `${Math.floor(x)},${Math.floor(y)}`;
}

function raioBase(tipo) {
  if (tipo === "arvore") return RAIO_BASE_ARVORE;
  if (tipo === "pedra" || tipo === "site") return RAIO_BASE_PEDRA;
  if (tipo === "siteCasa" || tipo === "baseCasa") return 2.2;
  if (tipo === "baseMovel") return 0.4;
  if (tipo === "baseCerca") return 0.35;
  if (tipo === "santuario") return RAIO_SANTUARIO;
  return 0;
}

function aabbDeDiscos(discos, cx, cy) {
  if (discos?.length) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < discos.length; i++) {
      const d = discos[i];
      const r = d.r > 0 ? d.r : 0.5;
      if (d.x - r < x0) x0 = d.x - r;
      if (d.y - r < y0) y0 = d.y - r;
      if (d.x + r > x1) x1 = d.x + r;
      if (d.y + r > y1) y1 = d.y + r;
    }
    if (Number.isFinite(x0)) {
      return {
        x0: Math.floor(x0),
        y0: Math.floor(y0),
        x1: Math.ceil(x1),
        y1: Math.ceil(y1),
      };
    }
  }
  const cxi = cx | 0;
  const cyi = cy | 0;
  if (cxi <= -9000 || cyi <= -9000) return null;
  return {
    x0: cxi * CHUNK_XZ,
    y0: cyi * CHUNK_XZ,
    x1: cxi * CHUNK_XZ + CHUNK_XZ - 1,
    y1: cyi * CHUNK_XZ + CHUNK_XZ - 1,
  };
}

function emitirDirty(aabbAntes, aabbDepois) {
  if (!onBasesDirty) return;
  if (!aabbAntes && !aabbDepois) {
    onBasesDirty(null);
    return;
  }
  if (!aabbAntes) {
    onBasesDirty(aabbDepois);
    return;
  }
  if (!aabbDepois) {
    onBasesDirty(aabbAntes);
    return;
  }
  onBasesDirty({
    x0: Math.min(aabbAntes.x0, aabbDepois.x0),
    y0: Math.min(aabbAntes.y0, aabbDepois.y0),
    x1: Math.max(aabbAntes.x1, aabbDepois.x1),
    y1: Math.max(aabbAntes.y1, aabbDepois.y1),
  });
}

export function indexarBases(cx, cy, lista) {
  const antes = porChunk.get(chaveChunk(cx, cy));
  const aabbAntes = aabbDeDiscos(antes, cx, cy);
  limparBases(cx, cy, true);
  const meus = [];
  const itens = lista || [];
  for (let i = 0; i < itens.length; i++) {
    const p = itens[i];
    if (p.oculto || p.forcaCarregado || p.r < 0 || p.fase === "caindo" || p.fase === "removido") continue;
    // Chapéu de meio cliff: piso em trampolim.js, não disco que bloqueia o pé.
    if (String(p.sprite || "").includes("mushroom")) continue;
    const r = p.r > 0 ? p.r : raioBase(p.tipo);
    if (!(r > 0) || p.z == null) continue;
    const disco = { x: p.x, y: p.y, z: p.z, r };
    meus.push(disco);
    const k = chaveCelula(p.x, p.y);
    let balde = porCelula.get(k);
    if (!balde) {
      balde = [];
      porCelula.set(k, balde);
    }
    balde.push(disco);
  }
  if (meus.length) porChunk.set(chaveChunk(cx, cy), meus);
  emitirDirty(aabbAntes, aabbDeDiscos(meus, cx, cy));
}

/**
 * @param {number} cx
 * @param {number} cy
 * @param {boolean} [silencioso] se true, não emite dirty (indexarBases já emite)
 */
export function limparBases(cx, cy, silencioso = false) {
  const meus = porChunk.get(chaveChunk(cx, cy));
  if (!meus) return;
  const aabb = silencioso ? null : aabbDeDiscos(meus, cx, cy);
  for (let i = 0; i < meus.length; i++) {
    const disco = meus[i];
    const k = chaveCelula(disco.x, disco.y);
    const balde = porCelula.get(k);
    if (!balde) continue;
    const idx = balde.indexOf(disco);
    if (idx >= 0) balde.splice(idx, 1);
    if (!balde.length) porCelula.delete(k);
  }
  porChunk.delete(chaveChunk(cx, cy));
  if (!silencioso) emitirDirty(aabb, null);
}

function discoQueInvade(x, y, elev, alcance) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  for (let iy = -1; iy <= 1; iy++) {
    for (let ix = -1; ix <= 1; ix++) {
      const balde = porCelula.get(`${cx + ix},${cy + iy}`);
      if (!balde) continue;
      for (let i = 0; i < balde.length; i++) {
        const d = balde[i];
        if (Math.abs(elev - d.z) > FOLGA_PISO) continue;
        const dx = x - d.x;
        const dy = y - d.y;
        const min = alcance + d.r;
        if (dx * dx + dy * dy < min * min) return d;
      }
    }
  }
  return null;
}

export function invadeDisco(x, y, elev, raio) {
  return discoQueInvade(x, y, elev, raio) != null;
}

export function discoInvasor(x, y, elev, raio) {
  return discoQueInvade(x, y, elev, raio);
}

/** Folga padrão do path = corpo do mon + margem (pedra 0.44 precisa disso). */
export function folgaNavDisco() {
  return RAIO_POKEMON + NAV_FOLGA_DISCO;
}

/**
 * Célula intransitável pro path: centro + folga do corpo (como Pokemon AI
 * inflate). Sem isso o A* entra em célula “livre” e a física gruda na base.
 */
export function centroNaBase(cx, cy, z, folga = folgaNavDisco()) {
  const pad = folga > 0 ? folga : folgaNavDisco();
  return discoQueInvade(cx + 0.5, cy + 0.5, z, pad) != null;
}

/** Aresta walk corta disco? (centro destino + meio do segmento). */
export function arestaCortaBase(ax, ay, bx, by, z, folga = folgaNavDisco()) {
  const pad = folga > 0 ? folga : folgaNavDisco();
  if (discoQueInvade(bx + 0.5, by + 0.5, z, pad)) return true;
  const mx = (ax + bx) * 0.5 + 0.5;
  const my = (ay + by) * 0.5 + 0.5;
  return discoQueInvade(mx, my, z, pad) != null;
}

/** Empurra o corpo pra fora do disco (escape quando já penetrou). */
export function empurrarForaDoDisco(corpo) {
  if (!corpo) return false;
  const elev = corpo.elevacao ?? corpo.z ?? 0;
  const r = corpo.raioCorpo > 0 ? corpo.raioCorpo : RAIO_CORPO;
  const disco = discoQueInvade(corpo.x, corpo.y, elev, r);
  if (!disco) return false;
  let dx = corpo.x - disco.x;
  let dy = corpo.y - disco.y;
  let d = Math.hypot(dx, dy);
  const falta = r + disco.r - d + 0.06;
  if (!(falta > 0)) return false;
  if (d < 1e-4) {
    dx = 0;
    dy = 1;
    d = 1;
  }
  corpo.x += (dx / d) * falta;
  corpo.y += (dy / d) * falta;
  return true;
}

/**
 * Garante posição livre de disco (spawn / stuck em poste).
 * Empurra e, se ainda invade, busca em espiral.
 */
export function resolverForaDeObstaculo(corpo) {
  if (!corpo) return false;
  const elev = corpo.elevacao ?? corpo.z ?? 0;
  const r = (corpo.raioCorpo > 0 ? corpo.raioCorpo : RAIO_CORPO) + 0.04;
  empurrarForaDoDisco(corpo);
  if (!discoQueInvade(corpo.x, corpo.y, elev, r)) return true;
  const ox = corpo.x;
  const oy = corpo.y;
  for (let ring = 1; ring <= 8; ring++) {
    const dist = ring * 0.4;
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2 + ring * 0.2;
      const nx = ox + Math.cos(ang) * dist;
      const ny = oy + Math.sin(ang) * dist;
      if (discoQueInvade(nx, ny, elev, r)) continue;
      corpo.x = nx;
      corpo.y = ny;
      return true;
    }
  }
  return false;
}

/** @type {Map<string, { assinatura: string, discos: { x: number, y: number, z: number, r: number }[] }>} */
const gruposLivres = new Map();

function soltarDiscos(discos) {
  for (let i = 0; i < discos.length; i++) {
    const disco = discos[i];
    const k = chaveCelula(disco.x, disco.y);
    const balde = porCelula.get(k);
    if (!balde) continue;
    const idx = balde.indexOf(disco);
    if (idx >= 0) balde.splice(idx, 1);
    if (!balde.length) porCelula.delete(k);
  }
}

/**
 * Discos soltos (colmeia etc.) fora do índice por chunk.
 * Não reindexa se id/posição/raio não mudaram.
 * @param {string} tag
 * @param {{ id?: string, x: number, y: number, z: number, r: number }[] | null} discos
 */
export function sincronizarGrupoDiscos(tag, discos) {
  const lista = discos || [];
  let assinatura = "";
  for (let i = 0; i < lista.length; i++) {
    const d = lista[i];
    assinatura += (d.id || i) + "@" + d.x + "," + d.y + "," + d.z + "," + d.r + ";";
  }
  const atual = gruposLivres.get(tag);
  if (atual && atual.assinatura === assinatura) return;
  const antes = atual ? atual.discos : null;
  const aabbAntes = antes && antes.length ? aabbDeDiscos(antes, 0, 0) : null;
  if (antes) soltarDiscos(antes);
  const meus = [];
  for (let i = 0; i < lista.length; i++) {
    const d = lista[i];
    if (!(d.r > 0) || d.z == null || !Number.isFinite(d.x) || !Number.isFinite(d.y)) continue;
    const disco = { x: d.x, y: d.y, z: d.z, r: d.r };
    meus.push(disco);
    const k = chaveCelula(disco.x, disco.y);
    let balde = porCelula.get(k);
    if (!balde) {
      balde = [];
      porCelula.set(k, balde);
    }
    balde.push(disco);
  }
  gruposLivres.set(tag, { assinatura, discos: meus });
  emitirDirty(aabbAntes, meus.length ? aabbDeDiscos(meus, 0, 0) : null);
}

const CAP_DISCOS = 48;

/** Discos do piso, x,y,z,r. `destino` tem pelo menos 192 floats. Sem alocação. */
export function encherDiscos(x, y, alcance, elev, destino) {
  let n = 0;
  const r = Math.ceil(alcance);
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  for (let iy = -r; iy <= r; iy++) {
    for (let ix = -r; ix <= r; ix++) {
      const balde = porCelula.get(`${cx + ix},${cy + iy}`);
      if (!balde) continue;
      for (let i = 0; i < balde.length; i++) {
        const d = balde[i];
        if (Math.abs(elev - d.z) > FOLGA_PISO) continue;
        if (n >= CAP_DISCOS) return n;
        const o = n * 4;
        destino[o] = d.x;
        destino[o + 1] = d.y;
        destino[o + 2] = d.z;
        destino[o + 3] = d.r;
        n++;
      }
    }
  }
  return n;
}

function indexarAutorais() {
  const lista = [];
  for (let i = 0; i < PROPS.length; i++) {
    const p = PROPS[i];
    if (p.tipo !== "arvore" && p.tipo !== "pedra") continue;
    const cx = Math.floor(p.x);
    const cy = Math.floor(p.y);
    const linha = ALTURAS[cy];
    const z = linha ? linha[cx] | 0 : 1;
    lista.push({ tipo: p.tipo, x: p.x, y: p.y, z });
  }
  indexarBases(-9999, -9999, lista);
}

indexarAutorais();

export function raioDoCorpo(corpo) {
  return corpo.raioCorpo > 0 ? corpo.raioCorpo : RAIO_CORPO;
}

function invadeLista(lista, x, y, elev, raio, ignorar) {
  for (let i = 0; i < lista.length; i++) {
    const b = lista[i];
    if (b === ignorar || b.morto || b.capturado) continue;
    const eb = b.elevacao ?? b.z ?? 0;
    if (Math.abs(elev - eb) > FOLGA_PISO) continue;
    const dx = x - b.x;
    const dy = y - b.y;
    const min = raio + raioDoCorpo(b);
    if (dx * dx + dy * dy < min * min) return true;
  }
  return false;
}

export function invadeCorpo(x, y, elev, raio, ignorar) {
  return (
    invadeLista(corposFixos, x, y, elev, raio, ignorar) ||
    invadeLista(corposAtores, x, y, elev, raio, ignorar)
  );
}

export function ocupado(x, y, elev, raio, ignorar) {
  return invadeDisco(x, y, elev, raio) || invadeCorpo(x, y, elev, raio, ignorar);
}

export function definirCorposFixos(lista) {
  corposFixos.length = 0;
  for (let i = 0; i < lista.length; i++) {
    if (lista[i]) corposFixos.push(lista[i]);
  }
}

export function definirCorposAtores(lista) {
  corposAtores.length = 0;
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    if (a && !a.morto && !a.capturado) corposAtores.push(a);
  }
}

export function corposSolidos() {
  const saida = [];
  for (let i = 0; i < corposFixos.length; i++) saida.push(corposFixos[i]);
  for (let i = 0; i < corposAtores.length; i++) saida.push(corposAtores[i]);
  return saida;
}

/** Jogador, companheiro e Pokémon que a física trata como sólidos. */
export function visitarCorposSolidos(fn) {
  for (let i = 0; i < corposFixos.length; i++) {
    const corpo = corposFixos[i];
    if (!corpo || corpo.morto || corpo.capturado) continue;
    fn(corpo);
  }
  for (let i = 0; i < corposAtores.length; i++) {
    const corpo = corposAtores[i];
    if (!corpo || corpo.morto || corpo.capturado) continue;
    fn(corpo);
  }
}
