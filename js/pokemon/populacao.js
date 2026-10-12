import { CHUNK_XZ, POKEMON, SEED_MUNDO } from "../config.js";
import { colunaAgua } from "../mundo/agua/fluxo.js";
import { alturaEm, dentroDoMapa } from "../mundo/altura.js";
import { vegetacaoNaArea } from "../mundo/bioma/propsBioma.js";
import { SPAWN } from "../mundo/mapaDemo.js";
import { cancelarPath } from "../navegacao/filaPath.js";
import { criarAtor, reviverAtor } from "./ator.js";
import { especie } from "./dados.js";

const POOL = [
  "pidgey",
  "rattata",
  "caterpie",
  "weedle",
  "spearow",
  "oddish",
  "bellsprout",
  "paras",
  "geodude",
  "sandshrew",
  "mankey",
  "meowth",
  "growlithe",
  "poliwag",
  "zubat",
  "diglett",
  "pikachu",
  "abra",
  "machop",
  "ekans",
  "nidoranF",
  "nidoranM",
  "venonat",
];

const EVOLUCAO = {
  pidgey: [[18, "pidgeotto"], [36, "pidgeot"]],
  rattata: [[20, "raticate"]],
  caterpie: [[7, "metapod"], [10, "butterfree"]],
  weedle: [[7, "kakuna"], [10, "beedrill"]],
  spearow: [[20, "fearow"]],
  oddish: [[21, "gloom"]],
  bellsprout: [[21, "weepinbell"]],
  paras: [[24, "parasect"]],
  geodude: [[25, "graveler"]],
  sandshrew: [[22, "sandslash"]],
  mankey: [[28, "primeape"]],
  meowth: [[28, "persian"]],
  growlithe: [[0, "growlithe"]],
  poliwag: [[25, "poliwhirl"]],
  zubat: [[22, "golbat"]],
  diglett: [[26, "dugtrio"]],
  pikachu: [[0, "pikachu"]],
  abra: [[16, "kadabra"]],
  machop: [[28, "machoke"]],
  ekans: [[22, "arbok"]],
  nidoranF: [[16, "nidorina"]],
  nidoranM: [[16, "nidorino"]],
  venonat: [[31, "venomoth"]],
};

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

function estagio(chave, nivel) {
  const linha = EVOLUCAO[chave];
  if (!linha) return chave;
  let atual = chave;
  for (let i = 0; i < linha.length; i++) {
    const [lv, prox] = linha[i];
    if (nivel >= lv && especie(prox)) atual = prox;
  }
  return atual;
}

function nivelNoPonto(x, y) {
  const dx = x - SPAWN.x;
  const dy = y - SPAWN.y;
  const dist = Math.hypot(dx, dy);
  return Math.max(2, Math.min(28, 3 + Math.floor(dist / 26)));
}

function pisoSeco(x, y) {
  if (!dentroDoMapa(x, y)) return 0;
  const z = alturaEm(x, y);
  if (z <= 0) return 0;
  const agua = colunaAgua(x, y);
  if (agua.superficie > 0 && agua.superficie >= z - 0.05) return 0;
  return z;
}

function garantirLar(cx, cy, indice) {
  const id = `${cx},${cy},${indice}`;
  if (lares.has(id)) return lares.get(id);
  if (hash(cx, cy, 10 + indice) % 3 === 0) {
    lares.set(id, null);
    return null;
  }
  const ox = 1 + (hash(cx, cy, 20 + indice) % (CHUNK_XZ - 2));
  const oy = 1 + (hash(cx, cy, 30 + indice) % (CHUNK_XZ - 2));
  const x = cx * CHUNK_XZ + ox + 0.5;
  const y = cy * CHUNK_XZ + oy + 0.5;
  if (Math.hypot(x - SPAWN.x, y - SPAWN.y) < POKEMON.FOLGA_SPAWN) {
    lares.set(id, null);
    return null;
  }
  if (!dentroDoMapa(Math.floor(x), Math.floor(y))) return null;
  const z = pisoSeco(Math.floor(x), Math.floor(y));
  if (!z) {
    lares.set(id, null);
    return null;
  }
  const base = POOL[hash(cx, cy, 40 + indice) % POOL.length];
  const nivel = nivelNoPonto(x, y);
  const chave = estagio(base, nivel);
  const esp = especie(chave) || especie(base) || especie("pidgey");
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

function sincronizarLares(px, py) {
  const alcance = POKEMON.RAIO_LARES;
  const c0x = Math.floor((px - alcance) / CHUNK_XZ);
  const c1x = Math.floor((px + alcance) / CHUNK_XZ);
  const c0y = Math.floor((py - alcance) / CHUNK_XZ);
  const c1y = Math.floor((py + alcance) / CHUNK_XZ);
  const perto = [];
  for (let cy = c0y; cy <= c1y; cy++) {
    for (let cx = c0x; cx <= c1x; cx++) {
    for (let indice = 0; indice < 2; indice++) {
      const lar = garantirLar(cx, cy, indice);
      if (!lar || lar.sumidoAte > agora) continue;
      const dx = lar.x - px;
      const dy = lar.y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 > alcance * alcance) continue;
      perto.push({ lar, d2 });
      }
    }
  }
  perto.sort((a, b) => a.d2 - b.d2);
  const manter = new Set();
  let vagas = POKEMON.MAX_MORADORES;
  for (let i = 0; i < perto.length && vagas > 0; i++) {
    const { lar, d2 } = perto[i];
    const limite = lar.ator ? POKEMON.RAIO_MANTER : POKEMON.RAIO_SIM;
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
  if (!pisouGrama(cx, cy)) return;
  if (cooldownGrama > 0) return;
  if (Math.random() >= POKEMON.CHANCE_GRAMA) return;
  if (vivosGrama() >= POKEMON.MAX_GRAMA) return;
  const cel = celulaDeGrama(corpo.x, corpo.y, POKEMON.RAIO_AGRO * 0.75);
  const x = cel ? cel.x : corpo.x + (Math.random() < 0.5 ? -2.5 : 2.5);
  const y = cel ? cel.y : corpo.y + (Math.random() < 0.5 ? -1.5 : 1.5);
  const z = pisoSeco(Math.floor(x), Math.floor(y)) || (corpo.elevacao ?? corpo.z ?? 0);
  const base = POOL[Math.floor(Math.random() * POOL.length)];
  const nivel = nivelNoPonto(x, y);
  const esp = especie(estagio(base, nivel)) || especie("pidgey");
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
}

function tickGrama() {
  for (let i = grama.length - 1; i >= 0; i--) {
    const ator = grama[i];
    if (ator.capturado) {
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
}

export function selvagensAtivos() {
  return ativos.concat(grama);
}

export function marcarCaptura(ator) {
  ator.capturado = true;
}
