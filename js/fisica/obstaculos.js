import {
  RAIO_BASE_ARVORE,
  RAIO_BASE_PEDRA,
  RAIO_CORPO,
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

function chaveChunk(cx, cy) {
  return `${cx | 0},${cy | 0}`;
}

function chaveCelula(x, y) {
  return `${Math.floor(x)},${Math.floor(y)}`;
}

function raioBase(tipo) {
  if (tipo === "arvore") return RAIO_BASE_ARVORE;
  if (tipo === "pedra") return RAIO_BASE_PEDRA;
  if (tipo === "santuario") return RAIO_SANTUARIO;
  return 0;
}

export function indexarBases(cx, cy, lista) {
  limparBases(cx, cy);
  const meus = [];
  const itens = lista || [];
  for (let i = 0; i < itens.length; i++) {
    const p = itens[i];
    if (p.oculto || p.r < 0 || p.fase === "caindo" || p.fase === "removido") continue;
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
}

export function limparBases(cx, cy) {
  const meus = porChunk.get(chaveChunk(cx, cy));
  if (!meus) return;
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

/** Centro da célula dentro do disco, no piso da aresta. */
export function centroNaBase(cx, cy, z) {
  return discoQueInvade(cx + 0.5, cy + 0.5, z, 0) != null;
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
