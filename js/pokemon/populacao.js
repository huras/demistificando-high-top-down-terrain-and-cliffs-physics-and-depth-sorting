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
import { larTocaEstrada } from "./laresEstrada.js";
import { larTocaPoi } from "./laresPoi.js";
import { cancelarPath } from "../navegacao/filaPath.js";
import { criarAtor, reviverAtor } from "./ator.js";
import { especie } from "./dados.js";
import { nivelEm } from "./distribuicao/forca.js";
import { sortearEspecie } from "./distribuicao/sorteio.js";
import {
  HABITAT,
  ehHabitatAquatico,
  infoTileHabitat,
  kindAguaDoTile,
  perfilDoHabitat,
  skyPassersAtivos,
  temFlapAround,
  tickPatrolAguaLar,
  tickPatrolVooLar,
  tickSkyPassers,
  zDoLarAquatico,
} from "./habitat/index.js";
import {
  amarrarPack,
  cfgPack,
  escolherMate,
  planPackDoLar,
  pontoMembro,
  reempilharLideranca,
  resolverEspecieNoNivel,
  vivoPack,
} from "./pack.js";
import { aquecerGrito, tocarGrito } from "../jogo/som/gritos.js";
import {
  defensoresSantuario,
  tickDefensoresSantuario,
} from "../santuario/defensores.js";
import {
  ORIGEM_SANTUARIO_X,
  ORIGEM_SANTUARIO_Y,
  SHRINE_INTERIOR_COLS,
  SHRINE_INTERIOR_ROWS,
  dentroDoTerrenoSantuario,
} from "../santuario/interior.js";

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
    Math.hypot(x - SPAWN.x, y - SPAWN.y) < POKEMON.FOLGA_SPAWN ||
    larTocaEstrada(x, y) ||
    larTocaPoi(x, y)
  ) {
    lares.set(id, null);
    return null;
  }
  if (!longeDeVizinhos(cx, cy, indice, x, y)) {
    lares.set(id, null);
    return null;
  }
  if (!dentroDoMapa(Math.floor(x), Math.floor(y))) return null;

  const tile = infoTileHabitat(x, y);
  const hBioma = hash(cx, cy, 35 + indice);
  const biomaId = biomaIdEm(x, y, hBioma);
  const nivel = nivelEm(x, y);

  /** @type {string} */
  let kind;
  /** @type {number} */
  let z;
  /** @type {string} */
  let chaveEsp;

  if (tile.molhado && !tile.caindo && tile.profundidade >= 1) {
    kind = kindAguaDoTile(tile, hash(cx, cy, 55 + indice));
    if (!kind) {
      lares.set(id, null);
      return null;
    }
    chaveEsp = sortearEspecie(biomaId, hash(cx, cy, 40 + indice), nivel, {
      habitat: kind,
    });
    z = zDoLarAquatico(kind, tile);
  } else {
    z = pisoSeco(Math.floor(x), Math.floor(y));
    if (!z) {
      lares.set(id, null);
      return null;
    }
    chaveEsp = sortearEspecie(biomaId, hash(cx, cy, 40 + indice), nivel, {
      habitat: HABITAT.LAND,
    });
    const espProbe = especie(chaveEsp);
    kind = temFlapAround(espProbe) ? HABITAT.HIGH : HABITAT.LAND;
  }

  const esp =
    especie(chaveEsp) ||
    (kind === HABITAT.SURFACE || kind === HABITAT.UNDERSEA
      ? especie("magikarp") || especie("tentacool")
      : especie("pidgey"));
  if (!esp) {
    lares.set(id, null);
    return null;
  }
  const hostil = unidade(hash(cx, cy, 60 + indice)) < POKEMON.HOSTIL;
  const packSize = planPackDoLar(
    unidade(hash(cx, cy, 70 + indice)),
    hash(cx, cy, 71 + indice),
    cfgPack(),
  );
  const membros = [
    {
      slot: 0,
      chave: esp.key,
      nivel,
      shiny: unidade(hash(cx, cy, 50 + indice)) < POKEMON.SHINY,
    },
  ];
  for (let s = 1; s < packSize; s++) {
    let sal = 80 + s * 10;
    const mate = escolherMate(
      { chave: esp.key, nivel },
      () => {
        const u = unidade(hash(cx, cy, sal));
        sal += 1;
        return u;
      },
    );
    membros.push({
      slot: s,
      chave: mate.chave,
      nivel: mate.nivel,
      shiny: unidade(hash(cx, cy, 50 + indice + s * 17)) < POKEMON.SHINY,
    });
  }
  const lar = {
    id,
    x,
    y,
    z,
    kind,
    chave: esp.key,
    nivel,
    shiny: membros[0].shiny,
    hostil,
    packSize,
    membros,
    atores: [],
    sumidoAte: 0,
  };
  lares.set(id, lar);
  return lar;
}

function rngDe(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function criarMoradorSlot(lar, mem) {
  const nivel = Math.max(1, mem.nivel | 0 || lar.nivel | 0 || 1);
  const chaveBruta = mem.chave || lar.chave;
  const chave =
    resolverEspecieNoNivel(chaveBruta, nivel) || chaveBruta;
  if (chave !== mem.chave) mem.chave = chave;
  const esp = especie(chave) || especie(lar.chave);
  if (!esp) return null;
  const ator = criarAtor({
    id: mem.slot === 0 ? `lar-${lar.id}` : `lar-${lar.id}-${mem.slot}`,
    especie: esp,
    nivel,
    shiny: mem.shiny,
    faccao: "selvagem",
    x: mem.poseX ?? lar.x,
    y: mem.poseY ?? lar.y,
    z: mem.poseZ ?? lar.z,
    casaX: lar.x,
    casaY: lar.y,
    casaZ: lar.z,
    hostil: lar.hostil,
    hp: mem.hpGuardado,
    dormindo: 1,
  });
  ator.larId = lar.id;
  ator.packSlot = mem.slot;
  ator.habitatKind = lar.kind || HABITAT.LAND;
  ator.perfil = perfilDoHabitat(ator.habitatKind, ator);
  if (ator.habitatKind === HABITAT.HIGH) {
    ator.elevacao = lar.z;
    ator.hopLift = 0;
  } else if (ator.habitatKind === HABITAT.SURFACE || ator.habitatKind === HABITAT.UNDERSEA) {
    ator.elevacao = lar.z;
    ator.nadando = true;
    ator.hopLift = Math.max(0, lar.z - (ator.z || 0));
  }
  if (mem.mortoGuardado) {
    ator.morto = true;
    ator.mortoAte = mem.mortoAte || 0;
    ator.morreuEm = mem.morreuEm || 0;
    ator.hp = 0;
  }
  return ator;
}

function acordar(lar) {
  if (lar.atores?.length) return;
  if (lar.sumidoAte > agora) return;
  const membros = lar.membros || [];
  if (!membros.length) return;

  const criados = [];
  const liderMem = membros[0];
  const lider = criarMoradorSlot(lar, liderMem);
  if (!lider) return;
  criados.push(lider);

  const rng = rngDe(hash(Math.floor(lar.x), Math.floor(lar.y), 99));
  const longeSpawn = (x, y, min) => {
    if (!longeDeAtivos(x, y, min)) return false;
    const min2 = min * min;
    for (let j = 0; j < criados.length; j++) {
      const a = criados[j];
      const dx = a.x - x;
      const dy = a.y - y;
      if (dx * dx + dy * dy < min2) return false;
    }
    return true;
  };
  const pisoLar = (lx, ly) => {
    if (ehHabitatAquatico(lar.kind)) {
      const t = infoTileHabitat(lx, ly);
      if (!t.molhado || t.caindo) return 0;
      return zDoLarAquatico(lar.kind, t) || lar.z || 0;
    }
    return pisoSeco(lx, ly);
  };
  for (let i = 1; i < membros.length; i++) {
    const mem = membros[i];
    if (mem.sumido) continue;
    let px = mem.poseX;
    let py = mem.poseY;
    let pz = mem.poseZ;
    if (px == null || py == null) {
      const pt = pontoMembro(
        { x: lider.x, y: lider.y, z: lider.z },
        pisoLar,
        longeSpawn,
        rng,
      );
      px = pt.x;
      py = pt.y;
      pz = pt.z;
      mem.poseX = px;
      mem.poseY = py;
      mem.poseZ = pz;
    }
    const ator = criarMoradorSlot(lar, {
      ...mem,
      poseX: px,
      poseY: py,
      poseZ: pz ?? lar.z,
    });
    if (ator) criados.push(ator);
  }

  if (criados.length >= 2) {
    amarrarPack(criados, lar.id);
  } else if (criados.length === 1) {
    criados[0].packId = null;
    criados[0].packRole = null;
    criados[0].packSlot = 0;
  }

  lar.atores = criados;
  for (let i = 0; i < criados.length; i++) ativos.push(criados[i]);
}

function guardar(lar) {
  const lista = lar.atores;
  if (!lista?.length) return;

  let algumCapturado = false;
  let vivosRestantes = 0;
  for (let i = 0; i < lista.length; i++) {
    const ator = lista[i];
    const idx = ativos.indexOf(ator);
    if (idx >= 0) ativos.splice(idx, 1);
    cancelarPath(ator.id);
    const mem = lar.membros[ator.packSlot ?? i] || lar.membros[i];
    if (ator.capturado) {
      algumCapturado = true;
      if (mem) mem.sumido = true;
      continue;
    }
    if (mem) {
      mem.poseX = ator.x;
      mem.poseY = ator.y;
      mem.poseZ = ator.z;
      mem.hpGuardado = ator.hp;
      mem.mortoGuardado = ator.morto;
      mem.mortoAte = ator.mortoAte;
      mem.morreuEm = ator.morreuEm;
      vivosRestantes++;
    }
  }
  lar.atores = [];
  if (algumCapturado && vivosRestantes === 0) {
    lar.sumidoAte = agora + POKEMON.RESPAWN_CAPTURA;
    for (let i = 0; i < lar.membros.length; i++) {
      lar.membros[i].sumido = false;
      lar.membros[i].poseX = null;
      lar.membros[i].poseY = null;
      lar.membros[i].poseZ = null;
    }
  }
}

function d2De(lar, px, py) {
  const lista = lar.atores;
  if (lista?.length) {
    let best = Infinity;
    for (let i = 0; i < lista.length; i++) {
      const a = lista[i];
      if (a.capturado) continue;
      const dx = a.x - px;
      const dy = a.y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) best = d2;
    }
    if (best < Infinity) return best;
  }
  const dx = lar.x - px;
  const dy = lar.y - py;
  return dx * dx + dy * dy;
}

function emCenaMorte(ator) {
  if (!ator) return false;
  if ((ator.desmaioEm || 0) > 0) return true;
  if ((ator.hp ?? 1) <= 0 && !ator.morto) return true;
  if (ator.morto && agora < (ator.mortoAte || 0)) return true;
  return false;
}

function larTemAtores(lar) {
  return !!(lar.atores && lar.atores.length);
}

function emCenaMorteLar(lar) {
  const lista = lar.atores;
  if (!lista) return false;
  for (let i = 0; i < lista.length; i++) {
    if (emCenaMorte(lista[i])) return true;
  }
  return false;
}

function emAgro(lar) {
  const lista = lar.atores;
  if (!lista?.length) return false;
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    if (a.capturado) continue;
    if (a.modo === "agro") return true;
    if (emCenaMorte(a)) return true;
  }
  return false;
}

function limiteCull(lar) {
  if (emAgro(lar)) return POKEMON.RAIO_MANTER_AGRO;
  if (larTemAtores(lar)) return POKEMON.RAIO_MANTER;
  return POKEMON.RAIO_SIM;
}

function sincronizarLares(px, py) {
  const alcance = POKEMON.RAIO_LARES;
  const alcance2 = alcance * alcance;
  const manter = new Set();
  let vagas = POKEMON.MAX_MORADORES;
  const perto = [];

  for (const lar of lares.values()) {
    if (!lar || !larTemAtores(lar) || !emAgro(lar) || lar.sumidoAte > agora) continue;
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
          if (larTemAtores(lar) && !emCenaMorteLar(lar)) guardar(lar);
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
    if (larTemAtores(lar)) {
      manter.add(lar.id);
      vagas--;
    }
  }

  for (const lar of lares.values()) {
    if (!lar || !larTemAtores(lar)) continue;
    if (manter.has(lar.id)) continue;
    guardar(lar);
  }
}

function larDeAtor(ator) {
  if (ator?.larId != null && lares.has(ator.larId)) return lares.get(ator.larId);
  const id = ator?.id;
  if (!id || !id.startsWith("lar-")) return null;
  const resto = id.slice(4);
  if (lares.has(resto)) return lares.get(resto);
  const corte = resto.lastIndexOf("-");
  if (corte > 0) {
    const base = resto.slice(0, corte);
    if (lares.has(base)) return lares.get(base);
  }
  return null;
}

function removerAtorDoLar(lar, ator) {
  if (!lar?.atores) return;
  const i = lar.atores.indexOf(ator);
  if (i >= 0) lar.atores.splice(i, 1);
  const mem = lar.membros[ator.packSlot | 0];
  if (mem) mem.sumido = true;
}

function tickMoradores() {
  for (let i = ativos.length - 1; i >= 0; i--) {
    const ator = ativos[i];
    if (ator.capturado) {
      const lar = larDeAtor(ator);
      ativos.splice(i, 1);
      if (lar) {
        removerAtorDoLar(lar, ator);
        cancelarPath(ator.id);
        const vivos = lar.atores.filter((a) => !a.capturado);
        if (!vivos.length) {
          lar.sumidoAte = agora + POKEMON.RESPAWN_CAPTURA;
          for (let m = 0; m < lar.membros.length; m++) {
            lar.membros[m].sumido = false;
            lar.membros[m].poseX = null;
            lar.membros[m].poseY = null;
            lar.membros[m].poseZ = null;
          }
        } else if (vivos.length >= 2) {
          reempilharLideranca(vivos, lar.id);
        } else {
          vivos[0].packId = null;
          vivos[0].packRole = null;
          vivos[0].packSlot = 0;
        }
      }
      continue;
    }
    if (!ator.morto) continue;
    if (agora < ator.mortoAte) continue;
    reviverAtor(ator, ator.casaX, ator.casaY, ator.casaZ);
    const lar = larDeAtor(ator);
    const shiny = Math.random() < POKEMON.SHINY;
    ator.shiny = shiny;
    if (lar) {
      const mem = lar.membros[ator.packSlot | 0];
      if (mem) {
        mem.shiny = shiny;
        mem.mortoGuardado = false;
        mem.hpGuardado = ator.hpMax;
        mem.morreuEm = 0;
      }
      if (ator.packId != null) reempilharLideranca(lar.atores, lar.id);
    }
  }

  // Sem líder vivo: promove o mate mais próximo.
  const vistos = new Set();
  for (let i = 0; i < ativos.length; i++) {
    const ator = ativos[i];
    if (ator.packId == null || vistos.has(ator.packId)) continue;
    vistos.add(ator.packId);
    let temLider = false;
    for (let j = 0; j < ativos.length; j++) {
      const a = ativos[j];
      if (a.packId === ator.packId && a.packRole === "leader" && vivoPack(a)) {
        temLider = true;
        break;
      }
    }
    if (!temLider) reempilharLideranca(ativos, ator.packId);
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
  const nivel = nivelEm(x, y);
  const chaveEsp =
    resolverEspecieNoNivel(
      sortearEspecie(biomaId, (Math.random() * 4294967296) >>> 0, nivel),
      nivel,
    ) || "pidgey";
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
  for (let i = 0; i < ativos.length; i++) {
    const a = ativos[i];
    tickPatrolVooLar(a, dt, agora);
    tickPatrolAguaLar(a, dt, agora);
  }
  tickSkyPassers(corpo.x, corpo.y, dt, agora, {
    indoor: zonaSemSelvagem(corpo.x, corpo.y),
  });
  tentarGrama(corpo);
  tickGrama();
  tickDefensoresSantuario();
}

export function selvagensAtivos() {
  return ativos.concat(grama).concat(defensoresSantuario()).concat(skyPassersAtivos());
}

export function marcarCaptura(ator) {
  ator.capturado = true;
}
