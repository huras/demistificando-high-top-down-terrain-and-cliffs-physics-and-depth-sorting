/**
 * Boca no lábio do cliff, ou um afloramento se a área não tem queda.
 * O GLB não colide: o vão entalhado no voxel é o chão e o teto.
 */
import { AREA_KANTO } from "../mundo/regiao/grafoKanto.js";
import { deLocalKanto, paraLocalKanto, dentroDoKanto } from "../mundo/bounds.js";
import { alturaDoRelevo, nivelMarBlocos } from "../mundo/bioma/catalogo.js";
import { amostraKanto } from "../mundo/regiao/amostraKanto.js";
import { SPAWN_PALLET } from "../mundo/regiao/spawnKanto.js";
import { CHUNK_XZ, CHUNK_Y } from "../config.js";
import { definirLocal, obterLocal } from "../mundo/voxel/chunk.js";
import { BLOCO, ehSolido } from "../mundo/voxel/tiposBloco.js";
import {
  CAVERNAS_KANTO,
  FACE,
  defProcedural,
} from "./catalogo.js";
import { areaAceitaProcedural } from "./procedural.js";

const PASSO = 3;
const QUEDA_MIN = 3;
const PROF = 4;
const MEIA_LARGURA = 1;

/** @type {Map<string, object[]>} */
const porArea = new Map();

function perp(out) {
  return { x: out.y, y: -out.x };
}

function longeDoSpawn(x, y) {
  const dx = x - SPAWN_PALLET.x;
  const dy = y - SPAWN_PALLET.y;
  return dx * dx + dy * dy > 18 * 18;
}

function celulaRuim(x, y, permitirRota) {
  if (!longeDoSpawn(x, y)) return true;
  const a = amostraKanto(x, y);
  if (!a) return false;
  if (a.predio) return true;
  if (!permitirRota && (a.rua || a.ponte)) return true;
  return false;
}

function melhorQueda(ax, ay, facing, permitirRota) {
  const origem = deLocalKanto(ax * AREA_KANTO, ay * AREA_KANTO);
  const out = FACE[facing];
  const nivel = nivelMarBlocos();
  let melhor = null;
  let melhorNota = -Infinity;

  function avaliar(lx, ly) {
    if (lx < 6 || ly < 6 || lx >= AREA_KANTO - 6 || ly >= AREA_KANTO - 6) return;
    const x = origem.x + lx;
    const y = origem.y + ly;
    if (celulaRuim(x, y, permitirRota)) return;
    const h = alturaDoRelevo(x, y);
    const hOut = alturaDoRelevo(x + out.x, y + out.y);
    const queda = h - hOut;
    if (h < nivel || queda < QUEDA_MIN) return;
    if (hOut < 1) return;
    const dist = Math.abs(lx - 64) + Math.abs(ly - 64);
    const nota = queda * 24 - dist * 0.2;
    if (nota > melhorNota) {
      melhorNota = nota;
      melhor = { x, y, h, hOut, queda };
    }
  }

  for (let ly = 8; ly < AREA_KANTO - 8; ly += PASSO) {
    for (let lx = 8; lx < AREA_KANTO - 8; lx += PASSO) avaliar(lx, ly);
  }
  if (!melhor) return null;
  const lx0 = melhor.x - origem.x;
  const ly0 = melhor.y - origem.y;
  for (let ly = ly0 - 3; ly <= ly0 + 3; ly++) {
    for (let lx = lx0 - 3; lx <= lx0 + 3; lx++) avaliar(lx, ly);
  }
  return melhor;
}

function pontoAlto(ax, ay, permitirRota) {
  const origem = deLocalKanto(ax * AREA_KANTO, ay * AREA_KANTO);
  const nivel = nivelMarBlocos();
  let melhor = null;
  let hMax = -1;
  for (let ly = 16; ly < AREA_KANTO - 16; ly += 4) {
    for (let lx = 16; lx < AREA_KANTO - 16; lx += 4) {
      const x = origem.x + lx;
      const y = origem.y + ly;
      if (celulaRuim(x, y, permitirRota)) continue;
      const h = alturaDoRelevo(x, y);
      if (h < nivel || h < hMax) continue;
      hMax = h;
      melhor = { x, y, h, hOut: h, queda: 0 };
    }
  }
  return melhor;
}

function montarGeometria(lip, facing) {
  const out = FACE[facing];
  const inn = { x: -out.x, y: -out.y };
  const lado = perp(out);
  const piso = Math.max(2, lip.hOut | 0);
  const buracos = [];
  const fachada = [];
  for (let t = 0; t < PROF; t++) {
    for (let s = -MEIA_LARGURA; s <= MEIA_LARGURA; s++) {
      buracos.push({
        x: lip.x + inn.x * t + lado.x * s,
        y: lip.y + inn.y * t + lado.y * s,
        piso,
      });
    }
  }
  for (let t = 0; t < PROF; t++) {
    for (const s of [-2, 2]) {
      const x = lip.x + inn.x * t + lado.x * s;
      const y = lip.y + inn.y * t + lado.y * s;
      if (alturaDoRelevo(x, y) < piso + 4) fachada.push({ x, y, topo: piso + 5 });
    }
  }
  for (let s = -1; s <= 1; s++) {
    const x = lip.x + inn.x * PROF + lado.x * s;
    const y = lip.y + inn.y * PROF + lado.y * s;
    if (alturaDoRelevo(x, y) < piso + 4) fachada.push({ x, y, topo: piso + 5 });
  }
  const gatilho = buracos[2 * 3 + 1];
  const standX = lip.x + out.x * 2;
  const standY = lip.y + out.y * 2;
  const standZ = Math.max(1, alturaDoRelevo(standX, standY));
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const marcar = (x, y) => {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  };
  for (let i = 0; i < buracos.length; i++) marcar(buracos[i].x, buracos[i].y);
  for (let t = 1; t <= 3; t++) {
    for (let s = -2; s <= 2; s++) {
      marcar(lip.x + out.x * t + lado.x * s, lip.y + out.y * t + lado.y * s);
    }
  }
  return {
    piso,
    buracos,
    fachada,
    gatilho: { x: gatilho.x + 0.5, y: gatilho.y + 0.5, z: piso },
    stand: { x: standX + 0.5, y: standY + 0.5, z: standZ > 1 ? standZ : piso },
    plaza: { x0, y0, x1: x1 + 1, y1: y1 + 1 },
    yaw: out.yaw,
    dirX: out.x,
    dirY: out.y,
  };
}

function escolherFacing(ax, ay, preferida) {
  const lados = ["south", "north", "west", "east"];
  for (let passagem = 0; passagem < 2; passagem++) {
    const permitirRota = passagem === 1;
    if (preferida && FACE[preferida]) {
      const queda = melhorQueda(ax, ay, preferida, permitirRota);
      if (queda) return { facing: preferida, lip: queda };
    }
    let melhor = null;
    let facing = preferida && FACE[preferida] ? preferida : "south";
    for (let i = 0; i < lados.length; i++) {
      const q = melhorQueda(ax, ay, lados[i], permitirRota);
      if (!q) continue;
      if (!melhor || q.queda > melhor.queda) {
        melhor = q;
        facing = lados[i];
      }
    }
    if (melhor) return { facing, lip: melhor };
    const alto = pontoAlto(ax, ay, permitirRota);
    if (alto) {
      return { facing: preferida && FACE[preferida] ? preferida : "south", lip: alto };
    }
  }
  return null;
}

function resolverBoca(cave, mouth) {
  const escolha = escolherFacing(mouth.ax, mouth.ay, mouth.facing);
  if (!escolha) return null;
  const geo = montarGeometria(escolha.lip, escolha.facing);
  return {
    id: mouth.id,
    caveId: cave.id,
    nome: cave.nome,
    ax: mouth.ax,
    ay: mouth.ay,
    portal: mouth.portal,
    facing: escolha.facing,
    rota: mouth.rota || "",
    procedural: !!cave.procedural,
    x: escolha.lip.x + 0.5,
    y: escolha.lip.y + 0.5,
    z: geo.piso,
    ...geo,
  };
}

export function peekBocasDaArea(ax, ay) {
  return porArea.get(`${ax | 0},${ay | 0}`) || null;
}

export function bocasDaArea(ax, ay) {
  const chave = `${ax | 0},${ay | 0}`;
  const pronta = porArea.get(chave);
  if (pronta) return pronta;
  const lista = [];
  for (let i = 0; i < CAVERNAS_KANTO.length; i++) {
    const cave = CAVERNAS_KANTO[i];
    for (let j = 0; j < cave.mouths.length; j++) {
      const mouth = cave.mouths[j];
      if ((mouth.ax | 0) !== (ax | 0) || (mouth.ay | 0) !== (ay | 0)) continue;
      const boca = resolverBoca(cave, mouth);
      if (boca) lista.push(boca);
    }
  }
  if (!lista.length && areaAceitaProcedural(ax, ay)) {
    const def = defProcedural(ax, ay);
    const boca = resolverBoca(def, def.mouths[0]);
    if (boca) lista.push(boca);
  }
  porArea.set(chave, lista);
  return lista;
}

export function bocaPorId(id) {
  for (let i = 0; i < CAVERNAS_KANTO.length; i++) {
    const cave = CAVERNAS_KANTO[i];
    for (let j = 0; j < cave.mouths.length; j++) {
      if (cave.mouths[j].id !== id) continue;
      const lista = bocasDaArea(cave.mouths[j].ax, cave.mouths[j].ay);
      for (let k = 0; k < lista.length; k++) {
        if (lista[k].id === id) return lista[k];
      }
    }
  }
  const proc = /^proc-(-?\d+)-(-?\d+)-mouth$/.exec(String(id || ""));
  if (!proc) return null;
  const lista = bocasDaArea(Number(proc[1]), Number(proc[2]));
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].id === id) return lista[i];
  }
  return null;
}

export function bocasPerto(px, py, raioAreas = 1) {
  if (!dentroDoKanto(px, py)) return [];
  const local = paraLocalKanto(px, py);
  const ax = Math.floor(local.x / AREA_KANTO);
  const ay = Math.floor(local.y / AREA_KANTO);
  const saida = [];
  for (let dy = -raioAreas; dy <= raioAreas; dy++) {
    for (let dx = -raioAreas; dx <= raioAreas; dx++) {
      const lista = bocasDaArea(ax + dx, ay + dy);
      for (let i = 0; i < lista.length; i++) saida.push(lista[i]);
    }
  }
  return saida;
}

export function gatilhoSobPe(x, y, z) {
  const lista = bocasPerto(x, y, 1);
  for (let i = 0; i < lista.length; i++) {
    const g = lista[i].gatilho;
    const dx = x - g.x;
    const dy = y - g.y;
    if (dx * dx + dy * dy > 1.3 * 1.3) continue;
    if (Number.isFinite(z) && Math.abs(z - g.z) > 2.2) continue;
    return lista[i];
  }
  return null;
}

export function celulaBocaLimpa(wx, wy) {
  if (!dentroDoKanto(wx, wy)) return false;
  const local = paraLocalKanto(wx, wy);
  const ax = Math.floor(local.x / AREA_KANTO);
  const ay = Math.floor(local.y / AREA_KANTO);
  const lista = bocasDaArea(ax, ay);
  const x = wx | 0;
  const y = wy | 0;
  for (let i = 0; i < lista.length; i++) {
    const p = lista[i].plaza;
    if (x >= p.x0 && x < p.x1 && y >= p.y0 && y < p.y1) return true;
  }
  return false;
}

/**
 * Entalha o vão e, se o terreno for baixo, empilha a fachada.
 * Chamar depois da água, senão o corpo reenche o buraco.
 */
export function aplicarBocasNoChunk(chunk) {
  const baseX = chunk.cx * CHUNK_XZ;
  const baseY = chunk.cy * CHUNK_XZ;
  if (!dentroDoKanto(baseX, baseY) && !dentroDoKanto(baseX + CHUNK_XZ, baseY + CHUNK_XZ)) {
    return false;
  }
  const local = paraLocalKanto(baseX, baseY);
  const ax = Math.floor(local.x / AREA_KANTO);
  const ay = Math.floor(local.y / AREA_KANTO);
  let mudou = false;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const lista = bocasDaArea(ax + dx, ay + dy);
      for (let i = 0; i < lista.length; i++) {
        if (aplicarUma(chunk, baseX, baseY, lista[i])) mudou = true;
      }
    }
  }
  return mudou;
}

function aplicarUma(chunk, baseX, baseY, boca) {
  let mudou = false;
  const fachada = boca.fachada;
  for (let i = 0; i < fachada.length; i++) {
    const c = fachada[i];
    const lx = c.x - baseX;
    const ly = c.y - baseY;
    if (lx < 0 || ly < 0 || lx >= CHUNK_XZ || ly >= CHUNK_XZ) continue;
    empilhar(chunk, lx, ly, c.topo);
    mudou = true;
  }
  const buracos = boca.buracos;
  for (let i = 0; i < buracos.length; i++) {
    const c = buracos[i];
    const lx = c.x - baseX;
    const ly = c.y - baseY;
    if (lx < 0 || ly < 0 || lx >= CHUNK_XZ || ly >= CHUNK_XZ) continue;
    abrirBuraco(chunk, lx, ly, c.piso);
    mudou = true;
  }
  return mudou;
}

function empilhar(chunk, lx, ly, topo) {
  const z = Math.min(CHUNK_Y, topo | 0);
  for (let lz = 0; lz < z; lz++) definirLocal(chunk, lx, ly, lz, BLOCO.PEDRA);
}

function abrirBuraco(chunk, lx, ly, piso) {
  const pisoI = piso | 0;
  if (pisoI < 2) return;
  definirLocal(chunk, lx, ly, pisoI - 1, BLOCO.PEDRA);
  for (let z = pisoI; z < pisoI + 3 && z < CHUNK_Y; z++) {
    definirLocal(chunk, lx, ly, z, BLOCO.AR);
  }
  const teto = pisoI + 3;
  if (teto < CHUNK_Y && !ehSolido(obterLocal(chunk, lx, ly, teto))) {
    definirLocal(chunk, lx, ly, teto, BLOCO.PEDRA);
  }
}
