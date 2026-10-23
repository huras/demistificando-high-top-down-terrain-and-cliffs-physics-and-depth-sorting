import { CHUNK_XZ, POKEMON, SEED_MUNDO } from "../config.js";
import { colunaAgua } from "../mundo/agua/fluxo.js";
import { alturaEm, dentroDoMapa } from "../mundo/altura.js";
import { vegetacaoNaArea } from "../mundo/bioma/propsBioma.js";
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
import { cancelarPath } from "../navegacao/filaPath.js";
import { criarAtor, reviverAtor } from "./ator.js";
import { especie } from "./dados.js";
import { nivelEm } from "./distribuicao/forca.js";
import { sortearEspecie } from "./distribuicao/sorteio.js";
import { aquecerGrito, tocarGrito } from "../jogo/som/gritos.js";
import {
  defensoresSantuario,
  tickDefensoresSantuario,
} from "../santuario/defensores.js";

const lares = new Map();
const ativos = [];
const grama = [];

let celulaGrama = "";
let cooldownGrama = 0;
let agora = 0;

function hash(a, b, c = 0) {
  let h = (SEED_MUNDO ^ Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

function unidade(h) {
  return (h >>> 0) / 4294967296;
}

/** A câmera do interior vê além da sala. Selvagem nessa faixa aparece no preto. */
const FOLGA_VAZIO = 56;

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

function pisoSeco(x, y) {
  if (!dentroDoMapa(x, y)) return 0;
  const z = alturaEm(x, y);
  if (z <= 0) return 0;
  const agua = colunaAgua(x, y);
  if (agua.superficie > 0 && agua.superficie >= z - 0.05) return 0;
  return z;
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
  // ~40% dos chunks têm lar (antes ~67% com 2 slots).
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

function longeDeAtivos(x, y, minDist) {
  const min2 = minDist * minDist;
  for (let i = 0; i < ativos.length; i++) {
    const a = ativos[i];
    if (a.morto || a.capturado) continue;
    const dx = a.x - x;
    const dy = a.y - y;
    if (dx * dx + dy * dy < min2) return false;
  }
  for (let i = 0; i < grama.length; i++) {
    const a = grama[i];
    if (a.morto || a.capturado) continue;
    const dx = a.x - x;
    const dy = a.y - y;
    if (dx * dx + dy * dy < min2) return false;
  }
  return true;
}

function garantirLar(cx, cy, indice) {
  const id = `${cx},${cy},${indice}`;
  if (lares.has(id)) return lares.get(id);
  const pos = posicaoCandidata(cx, cy, indice);
  if (!pos) {
    lares.set(id, null);
    return null;
  }
  const { x, y } = pos;
  if (
    zonaSemSelvagem(x, y) ||
    ehCidade(x, y) ||
    Math.hypot(x - SPAWN.x, y - SPAWN.y) < POKEMON.FOLGA_SPAWN
  ) {
    lares.set(id, null);
    return null;
  }
  if (!longeDeVizinhos(cx, cy, indice, x, y)) {
    lares.set(id, null);
    return null;
  }
  if (!dentroDoMapa(Math.floor(x), Math.floor(y))) return null;
  const z = pisoSeco(Math.floor(x), Math.floor(y));
  if (!z) {
    lares.set(id, null);
    return null;
  }
  const hBioma = hash(cx, cy, 35 + indice);
  const biomaId = biomaIdEm(x, y, hBioma);
  const chave = sortearEspecie(biomaId, hash(cx, cy, 40 + indice));
  const nivel = nivelEm(x, y);
  const esp = especie(chave) || especie("pidgey");
  if (!esp) {
    lares.set(id, null);
    return null;
  }
  const lar = {
    id,
    x,
    y,
    z,
    chave: esp.key,
    nivel,
    shiny: unidade(hash(cx, cy, 50 + indice)) < POKEMON.SHINY,
    hostil: unidade(hash(cx, cy, 60 + indice)) < POKEMON.HOSTIL,
    ator: null,
    sumidoAte: 0,
  };
  lares.set(id, lar);
  return lar;
}

function criarMorador(lar) {
  const esp = especie(lar.chave);
  if (!esp) return null;
  const ator = criarAtor({
    id: `lar-${lar.id}`,
    especie: esp,
    nivel: lar.nivel,
    shiny: lar.shiny,
    faccao: "selvagem",
    x: lar.poseX ?? lar.x,
    y: lar.poseY ?? lar.y,
    z: lar.poseZ ?? lar.z,
    casaX: lar.x,
    casaY: lar.y,
    casaZ: lar.z,
    hostil: lar.hostil,
    hp: lar.hpGuardado,
    dormindo: 1,
  });
  if (lar.mortoGuardado) {
    ator.morto = true;
    ator.mortoAte = lar.mortoAte || 0;
    ator.morreuEm = lar.morreuEm || 0;
    ator.hp = 0;
  }
  return ator;
}

function acordar(lar) {
  if (lar.ator) return;
  if (lar.sumidoAte > agora) return;
  const ator = criarMorador(lar);
  if (!ator) return;
  lar.ator = ator;
  ativos.push(ator);
}

function guardar(lar) {
  const ator = lar.ator;
  if (!ator) return;
  const i = ativos.indexOf(ator);
  if (i >= 0) ativos.splice(i, 1);
  cancelarPath(ator.id);
  if (ator.capturado) {
    lar.ator = null;
    lar.sumidoAte = agora + POKEMON.RESPAWN_CAPTURA;
    return;
  }
  lar.poseX = ator.x;
  lar.poseY = ator.y;
  lar.poseZ = ator.z;
  lar.hpGuardado = ator.hp;
  lar.mortoGuardado = ator.morto;
  lar.mortoAte = ator.mortoAte;
  lar.morreuEm = ator.morreuEm;
  lar.ator = null;
}

function d2De(lar, px, py) {
  const x = lar.ator ? lar.ator.x : lar.x;
  const y = lar.ator ? lar.ator.y : lar.y;
  const dx = x - px;
  const dy = y - py;
  return dx * dx + dy * dy;
}

function emCenaMorte(ator) {
  if (!ator) return false;
  if ((ator.desmaioEm || 0) > 0) return true;
  if ((ator.hp ?? 1) <= 0 && !ator.morto) return true;
  if (ator.morto && agora < (ator.mortoAte || 0)) return true;
  return false;
}

function emAgro(lar) {
  const a = lar.ator;
  if (!a) return false;
  if (a.modo === "agro") return true;
  // Corpo / Hurt: guarda no raio de agro pra não sumir no meio da queda.
  return emCenaMorte(a);
}

function limiteCull(lar) {
  if (emAgro(lar)) return POKEMON.RAIO_MANTER_AGRO;
  if (lar.ator) return POKEMON.RAIO_MANTER;
  return POKEMON.RAIO_SIM;
}

function sincronizarLares(px, py) {
  const alcance = POKEMON.RAIO_LARES;
  const alcance2 = alcance * alcance;
  const manter = new Set();
  let vagas = POKEMON.MAX_MORADORES;
  const perto = [];

  for (const lar of lares.values()) {
    if (!lar?.ator || !emAgro(lar) || lar.sumidoAte > agora) continue;
    const d2 = d2De(lar, px, py);
    if (d2 > POKEMON.RAIO_MANTER_AGRO * POKEMON.RAIO_MANTER_AGRO) continue;
    perto.push({ lar, d2, agro: true });
  }

  const c0x = Math.floor((px - alcance) / CHUNK_XZ);
  const c1x = Math.floor((px + alcance) / CHUNK_XZ);
  const c0y = Math.floor((py - alcance) / CHUNK_XZ);
  const c1y = Math.floor((py + alcance) / CHUNK_XZ);
  for (let cy = c0y; cy <= c1y; cy++) {
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let indice = 0; indice < slotsPorChunk(); indice++) {
        const lar = garantirLar(cx, cy, indice);
        if (!lar || lar.sumidoAte > agora) continue;
        if (zonaSemSelvagem(lar.x, lar.y)) {
          // Não some no meio do desmaio / cadáver.
          if (lar.ator && !emCenaMorte(lar.ator)) guardar(lar);
          continue;
        }
        if (emAgro(lar)) continue;
        const d2 = d2De(lar, px, py);
        if (d2 > alcance2) continue;
        perto.push({ lar, d2, agro: false });
      }
    }
  }

  perto.sort((a, b) => {
    if (a.agro !== b.agro) return a.agro ? -1 : 1;
    return a.d2 - b.d2;
  });

  for (let i = 0; i < perto.length && vagas > 0; i++) {
    const { lar, d2 } = perto[i];
    if (manter.has(lar.id)) continue;
    const limite = limiteCull(lar);
    if (d2 > limite * limite) continue;
    acordar(lar);
    if (lar.ator) {
      manter.add(lar.id);
      vagas--;
    }
  }

  for (const lar of lares.values()) {
    if (!lar?.ator) continue;
    if (manter.has(lar.id)) continue;
    guardar(lar);
  }
}

function tickMoradores() {
  for (let i = ativos.length - 1; i >= 0; i--) {
    const ator = ativos[i];
    if (ator.capturado) {
      const lar = lares.get(ator.id.slice(4));
      if (lar) {
        lar.ator = null;
        lar.sumidoAte = agora + POKEMON.RESPAWN_CAPTURA;
      }
      ativos.splice(i, 1);
      continue;
    }
    if (!ator.morto) continue;
    if (agora < ator.mortoAte) continue;
    reviverAtor(ator, ator.casaX, ator.casaY, ator.casaZ);
    const lar = lares.get(ator.id.slice(4));
    const shiny = Math.random() < POKEMON.SHINY;
    ator.shiny = shiny;
    if (lar) {
      lar.shiny = shiny;
      lar.mortoGuardado = false;
      lar.hpGuardado = ator.hpMax;
      lar.morreuEm = 0;
    }
  }
}

function pisouGrama(cx, cy) {
  const props = vegetacaoNaArea(cx, cy, cx + 1, cy + 1);
  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    if (p.tipo !== "grama") continue;
    if (Math.floor(p.x) === cx && Math.floor(p.y) === cy) return true;
  }
  return false;
}

function celulaDeGrama(px, py, raio) {
  const props = vegetacaoNaArea(px - raio, py - raio, px + raio, py + raio);
  const cx = Math.floor(px);
  const cy = Math.floor(py);
  let melhor = null;
  let melhorD = Infinity;
  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    if (p.tipo !== "grama") continue;
    const gx = Math.floor(p.x);
    const gy = Math.floor(p.y);
    if (gx === cx && gy === cy) continue;
    const dx = p.x - px;
    const dy = p.y - py;
    const d2 = dx * dx + dy * dy;
    if (d2 < melhorD) {
      melhorD = d2;
      melhor = p;
    }
  }
  return melhor;
}

function vivosGrama() {
  let n = 0;
  for (let i = 0; i < grama.length; i++) {
    if (!grama[i].morto && !grama[i].capturado) n++;
  }
  return n;
}

function tentarGrama(corpo) {
  const cx = Math.floor(corpo.x);
  const cy = Math.floor(corpo.y);
  const chave = `${cx},${cy}`;
  if (chave === celulaGrama) return;
  if (corpo.pulando || corpo.planando || corpo.escalando || corpo.voando) return;
  celulaGrama = chave;
  if (zonaSemSelvagem(cx, cy) || ehCidade(cx, cy)) return;
  if (!pisouGrama(cx, cy)) return;
  if (cooldownGrama > 0) return;
  if (Math.random() >= POKEMON.CHANCE_GRAMA) return;
  if (vivosGrama() >= POKEMON.MAX_GRAMA) return;
  const cel = celulaDeGrama(corpo.x, corpo.y, POKEMON.RAIO_AGRO * 0.75);
  const x = cel ? cel.x : corpo.x + (Math.random() < 0.5 ? -2.5 : 2.5);
  const y = cel ? cel.y : corpo.y + (Math.random() < 0.5 ? -1.5 : 1.5);
  if (zonaSemSelvagem(x, y) || ehCidade(x, y)) return;
  if (!longeDeAtivos(x, y, POKEMON.MIN_ESPACO_GRAMA)) return;
  const z = pisoSeco(Math.floor(x), Math.floor(y)) || (corpo.elevacao ?? corpo.z ?? 0);
  const biomaId = biomaIdEm(x, y, (Math.random() * 4294967296) >>> 0);
  const chaveEsp = sortearEspecie(biomaId, (Math.random() * 4294967296) >>> 0);
  const nivel = nivelEm(x, y);
  const esp = especie(chaveEsp) || especie("pidgey");
  if (!esp) return;
  const ator = criarAtor({
    id: `grama-${chave}-${Math.floor(agora * 1000)}`,
    especie: esp,
    nivel,
    shiny: Math.random() < POKEMON.SHINY,
    faccao: "selvagem",
    x,
    y,
    z,
    casaX: x,
    casaY: y,
    casaZ: z,
    hostil: true,
    efemero: true,
    agroPersistente: true,
    prefereParty: true,
    dormindo: 0,
    raioTerritorio: 18,
  });
  ator.modo = "agro";
  grama.push(ator);
  cooldownGrama = POKEMON.COOLDOWN_GRAMA;
  aquecerGrito(ator);
  tocarGrito(ator, { x: ator.x, y: ator.y, importante: true });
}

function tickGrama() {
  for (let i = grama.length - 1; i >= 0; i--) {
    const ator = grama[i];
    if (ator.capturado) {
      grama.splice(i, 1);
      continue;
    }
    // Zona vazia: só remove se não está caindo / cadáver na tela.
    if (zonaSemSelvagem(ator.x, ator.y) && !emCenaMorte(ator)) {
      grama.splice(i, 1);
      continue;
    }
    if (ator.morto && agora >= ator.mortoAte) grama.splice(i, 1);
  }
}

export function atualizarPopulacao(corpo, dt, relogio) {
  agora = relogio;
  if (cooldownGrama > 0) cooldownGrama = Math.max(0, cooldownGrama - dt);
  sincronizarLares(corpo.x, corpo.y);
  tickMoradores();
  tentarGrama(corpo);
  tickGrama();
  tickDefensoresSantuario();
}

export function selvagensAtivos() {
  return ativos.concat(grama).concat(defensoresSantuario());
}

export function marcarCaptura(ator) {
  ator.capturado = true;
}
