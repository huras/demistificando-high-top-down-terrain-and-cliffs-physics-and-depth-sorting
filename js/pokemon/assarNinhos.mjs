/**
 * Assa os ninhos do overworld e das cavernas.
 * O jogo só lê assets/ninhos/ninhos.bin.
 *
 * npm run ninhos:assar
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHUNK_XZ, POKEMON } from "../config.js";
import { LADO_MUNDO } from "../mundo/bounds.js";
import { LADO_KANTO } from "../mundo/regiao/grafoKanto.js";
import { hashSeed, mulberry32 } from "../santuario/dungeonGen.js";
import { CAVERNAS_KANTO, defProcedural } from "../caverna/catalogo.js";
import { areaAceitaProcedural } from "../caverna/procedural.js";
import { bocasDaArea } from "../caverna/bocas.js";
import { CHAO, classeDaCelula, gerarInterior } from "../caverna/interior/gerar.js";
import { especie, instalarCatalogo, listarEspecies } from "./dados.js";
import { extrairCatalogo } from "./extrairCatalogo.mjs";
import { extrairDistribuicao } from "./extrairDistribuicao.mjs";
import { chavesNoPool, instalarDistribuicao } from "./distribuicao/indice.js";
import { nivelEm } from "./distribuicao/forca.js";
import { sortearEspecie } from "./distribuicao/sorteio.js";
import { ehAquatico, temFlapAround } from "./habitat/gates.js";
import { ehLendario } from "./lendarios.js";
import { biomaNoPonto, resolverLarNatural } from "./laresMapa.js";
import { gravarNinhos } from "./ninhosFormato.js";
import { completarLinhasNivel, instalarLinhasEvo, linhaDaEspecie, resolverEspecieNoNivel } from "./pack.js";
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const raizRef = process.env.RAIZ_REF
  ? path.resolve(process.env.RAIZ_REF)
  : path.resolve(raiz, "..", "Pokemon AI");
const pasta = path.join(raiz, "assets", "ninhos");
const piso = Math.max(1, POKEMON.PISO_NINHOS | 0);

const raizCache = new Map();

function raizDe(chave) {
  const hit = raizCache.get(chave);
  if (hit) return hit;
  const linha = linhaDaEspecie(chave);
  let raizLinha = chave;
  for (let i = 0; i < linha.length; i++) {
    const esp = especie(linha[i]);
    if (esp && !ehLendario(esp.dex)) {
      raizLinha = linha[i];
      break;
    }
  }
  for (let i = 0; i < linha.length; i++) raizCache.set(linha[i], raizLinha);
  raizCache.set(chave, raizLinha);
  return raizLinha;
}

function aplicarEspecie(lar, esp) {
  lar.speciesKey = esp.key;
  lar.dex = esp.dex | 0;
  if (lar.kind === "land" || lar.kind === "high") {
    lar.kind = temFlapAround(esp) ? "high" : "land";
  }
}

function cabeNoLar(lar, esp, ignorarNivel) {
  const min = esp.nivelMin | 0 || 1;
  if (!ignorarNivel && (lar.nivel | 0) < min) return false;
  const agua = lar.kind === "surface" || lar.kind === "undersea";
  return agua ? ehAquatico(esp) : !ehAquatico(esp);
}

function trocarLendario(lar) {
  if (!ehLendario(lar.dex)) return;
  const habitat = lar.kind === "high" ? "land" : lar.kind;
  for (let s = 1; s <= 16; s++) {
    const h = (Math.imul((lar.cx | 0) + s * 17, 374761393) ^ Math.imul(lar.cy | 0, 668265263)) >>> 0;
    const chave = sortearEspecie(biomaNoPonto(lar.x, lar.y, h), h, lar.nivel, { habitat });
    const esp = especie(chave);
    if (!esp || ehLendario(esp.dex)) continue;
    aplicarEspecie(lar, esp);
    return;
  }
  const fb = habitat === "surface" || habitat === "undersea" ? "magikarp" : "pidgey";
  const esp = especie(fb);
  if (esp) aplicarEspecie(lar, esp);
}

function registroDe(lar) {
  const partes = String(lar.id).split(",");
  return {
    cx: Number(partes[0]),
    cy: Number(partes[1]),
    indice: Number(partes[2]),
    x: lar.x,
    y: lar.y,
    dex: lar.dex | 0,
    kind: lar.kind,
    shiny: !!lar.shiny,
    nivel: lar.nivel | 0 || 1,
    speciesKey: lar.speciesKey,
  };
}

function varrerOverworld() {
  const lado = Math.ceil(LADO_MUNDO / CHUNK_XZ);
  const slots = Math.max(1, POKEMON.LARES_POR_CHUNK | 0);
  const over = [];
  const t0 = Date.now();
  for (let cy = 0; cy < lado; cy++) {
    if ((cy & 31) === 0) {
      console.log(`overworld ${cy}/${lado} · ${over.length} ninhos · ${((Date.now() - t0) / 1000) | 0}s`);
    }
    for (let cx = 0; cx < lado; cx++) {
      for (let i = 0; i < slots; i++) {
        const lar = resolverLarNatural(cx, cy, i);
        if (!lar) continue;
        const rec = registroDe(lar);
        trocarLendario(rec);
        over.push(rec);
      }
    }
  }
  console.log(`overworld ${lado}/${lado} · ${over.length} ninhos · ${((Date.now() - t0) / 1000) | 0}s`);
  return over;
}

function pertoDePortal(layout, tx, ty) {
  const portals = layout.portals || [];
  for (let i = 0; i < portals.length; i++) {
    const p = portals[i];
    if (Math.abs(tx - p.x) + Math.abs(ty - p.y) < 8) return true;
  }
  return false;
}

function dentroDeSala(sala, tx, ty) {
  if (!sala) return false;
  if (sala.premio) {
    const r = sala.premio;
    if (tx >= r.x0 && tx < r.x1 && ty >= r.y0 && ty < r.y1) return true;
  }
  return tx >= sala.x0 && ty >= sala.y0 && tx < sala.x0 + sala.w && ty < sala.y0 + sala.h;
}

function bloqueada(layout, tx, ty) {
  if (pertoDePortal(layout, tx, ty)) return true;
  const salas = layout.puzzles || [];
  for (let i = 0; i < salas.length; i++) {
    if (dentroDeSala(salas[i], tx, ty)) return true;
  }
  return false;
}

function corredor(layout, tx, ty) {
  let vizinhos = 0;
  if (classeDaCelula(layout, tx - 1, ty) === CHAO) vizinhos++;
  if (classeDaCelula(layout, tx + 1, ty) === CHAO) vizinhos++;
  if (classeDaCelula(layout, tx, ty - 1) === CHAO) vizinhos++;
  if (classeDaCelula(layout, tx, ty + 1) === CHAO) vizinhos++;
  return vizinhos > 0 && vizinhos <= 2;
}

function nivelDaCaverna(cave) {
  const mouth = cave.mouths?.[0];
  if (!mouth) return 4;
  const lista = bocasDaArea(mouth.ax, mouth.ay);
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].caveId !== cave.id) continue;
    return Math.max(4, nivelEm(lista[i].x, lista[i].y) | 0);
  }
  return 4;
}

function especieDaTabela(tabela, bruta, nivel, salt) {
  const tentar = (k) => {
    const chave = resolverEspecieNoNivel(k, nivel) || k;
    const esp = especie(chave);
    if (!esp || ehLendario(esp.dex)) return null;
    return esp;
  };
  const direto = tentar(bruta);
  if (direto) return direto;
  for (let i = 0; i < tabela.length; i++) {
    const esp = tentar(tabela[(salt + i) % tabela.length]);
    if (esp) return esp;
  }
  return especie("zubat") || especie("geodude");
}

function assarCaverna(cave) {
  const lay = gerarInterior(cave);
  const nivel = nivelDaCaverna(cave);
  const rng = mulberry32(hashSeed(`${lay.id}:wild`));
  const tabela = lay.encontros || ["zubat", "geodude"];
  const querer = Math.max(3, Math.min(8, lay.wilds | 0));
  const candidatos = [];
  const estreitos = [];
  const passo = lay.cols > 160 ? 2 : 1;
  for (let ty = 2; ty < lay.rows - 2; ty += passo) {
    for (let tx = 2; tx < lay.cols - 2; tx += passo) {
      if (classeDaCelula(lay, tx, ty) !== CHAO) continue;
      if (bloqueada(lay, tx, ty)) continue;
      candidatos.push(tx, ty);
      if (corredor(lay, tx, ty)) estreitos.push(tx, ty);
    }
  }
  const posts = [];
  const usados = new Set();
  if (candidatos.length) {
    let guard = 0;
    while (posts.length < querer && guard < querer * 6) {
      guard++;
      const fonte = posts.length % 2 === 0 && estreitos.length ? estreitos : candidatos;
      const i = Math.floor(rng() * (fonte.length / 2)) * 2;
      const tx = fonte[i];
      const ty = fonte[i + 1];
      const bruta = tabela[Math.floor(rng() * tabela.length)] || "zubat";
      const esp = especieDaTabela(tabela, bruta, nivel, posts.length);
      if (!esp) continue;
      const hostil = rng() < 0.2;
      const marca = `${tx},${ty}`;
      if (usados.has(marca)) continue;
      usados.add(marca);
      posts.push({
        caveId: cave.id,
        posto: posts.length,
        tx,
        ty,
        dex: esp.dex | 0,
        nivel,
        shiny: false,
        hostil,
        speciesKey: esp.key,
      });
    }
  }
  const spares = [];
  const fontes = estreitos.length ? [estreitos, candidatos] : [candidatos];
  for (let f = 0; f < fontes.length && spares.length < 48; f++) {
    const fonte = fontes[f];
    for (let i = 0; i < fonte.length && spares.length < 48; i += 2) {
      const tx = fonte[i];
      const ty = fonte[i + 1];
      const marca = `${tx},${ty}`;
      if (usados.has(marca)) continue;
      usados.add(marca);
      spares.push({ tx, ty });
    }
  }
  return { caveId: cave.id, nivel, posts, spares, proximo: posts.length };
}

function linhaNoPool(raiz, noPool) {
  const linha = linhaDaEspecie(raiz);
  for (let i = 0; i < linha.length; i++) {
    if (noPool.has(linha[i])) return true;
  }
  return noPool.has(raiz);
}

function garantirPiso(over, caves, pacotes, noPool) {
  const contagem = new Map();
  const somar = (chave, delta) => {
    const r = raizDe(chave);
    contagem.set(r, (contagem.get(r) | 0) + delta);
  };
  for (let i = 0; i < over.length; i++) somar(over[i].speciesKey, 1);
  for (let i = 0; i < caves.length; i++) somar(caves[i].speciesKey, 1);

  const cavernasCom = new Map();
  for (let i = 0; i < pacotes.length; i++) {
    const pac = pacotes[i];
    const tabela = pac.encontros || [];
    for (let j = 0; j < tabela.length; j++) {
      const r = raizDe(tabela[j]);
      let lista = cavernasCom.get(r);
      if (!lista) {
        lista = [];
        cavernasCom.set(r, lista);
      }
      if (!lista.some((p) => p.caveId === pac.caveId)) lista.push(pac);
    }
  }

  const pegaveis = [];
  const vistas = new Set();
  const todas = listarEspecies();
  for (let i = 0; i < todas.length; i++) {
    const esp = todas[i];
    if (!esp?.key || !(esp.dex | 0) || ehLendario(esp.dex)) continue;
    const r = raizDe(esp.key);
    if (vistas.has(r)) continue;
    vistas.add(r);
    pegaveis.push(r);
  }

  let cursor = 0;
  function roubar(raiz, esp, ignorarNivel) {
    if (!over.length) return false;
    for (let n = 0; n < over.length; n++) {
      const lar = over[cursor];
      cursor = (cursor + 1) % over.length;
      const donor = raizDe(lar.speciesKey);
      if (donor === raiz) continue;
      if ((contagem.get(donor) | 0) <= piso) continue;
      if (!cabeNoLar(lar, esp, ignorarNivel)) continue;
      contagem.set(donor, contagem.get(donor) - 1);
      aplicarEspecie(lar, esp);
      contagem.set(raiz, (contagem.get(raiz) | 0) + 1);
      return true;
    }
    return false;
  }

  function adicionarCaverna(raiz) {
    const lista = cavernasCom.get(raiz);
    if (!lista) return false;
    for (let i = 0; i < lista.length; i++) {
      const pac = lista[i];
      if (!pac.spares.length) continue;
      const tile = pac.spares.pop();
      const chave = resolverEspecieNoNivel(raiz, pac.nivel) || raiz;
      const esp = especie(chave);
      if (!esp || ehLendario(esp.dex) || (pac.nivel | 0) < (esp.nivelMin | 0 || 1)) {
        pac.spares.push(tile);
        continue;
      }
      caves.push({
        caveId: pac.caveId,
        posto: pac.proximo++,
        tx: tile.tx,
        ty: tile.ty,
        dex: esp.dex | 0,
        nivel: pac.nivel,
        shiny: false,
        hostil: false,
        speciesKey: esp.key,
      });
      contagem.set(raiz, (contagem.get(raiz) | 0) + 1);
      return true;
    }
    return false;
  }

  const faltando = [];
  for (let i = 0; i < pegaveis.length; i++) {
    const raiz = pegaveis[i];
    const esp = especie(raiz);
    if (!esp) continue;
    const soCaverna = !linhaNoPool(raiz, noPool) && cavernasCom.has(raiz);
    let guard = 0;
    while ((contagem.get(raiz) | 0) < piso && guard < piso + 2) {
      guard++;
      const ok = soCaverna
        ? adicionarCaverna(raiz)
        : roubar(raiz, esp, false) || roubar(raiz, esp, true);
      if (!ok) break;
    }
    if ((contagem.get(raiz) | 0) < piso) faltando.push(`${raiz} (${contagem.get(raiz) | 0})`);
  }
  return { faltando, pegaveis: pegaveis.length, contagem };
}

function contarLendarios(over, caves) {
  let n = 0;
  for (let i = 0; i < over.length; i++) if (ehLendario(over[i].dex)) n++;
  for (let i = 0; i < caves.length; i++) if (ehLendario(caves[i].dex)) n++;
  return n;
}

async function main() {
  console.log(`catálogo em ${raizRef}`);
  const cat = await extrairCatalogo(raizRef);
  const dist = await extrairDistribuicao(raizRef);
  instalarCatalogo(cat.especies);
  instalarDistribuicao(dist);
  const evoPath = path.join(raizRef, "src", "data", "pokemon", "evolution-lines.json");
  instalarLinhasEvo(JSON.parse(fs.readFileSync(evoPath, "utf8")), cat.especies);
  completarLinhasNivel();

  const over = varrerOverworld();
  const caves = [];
  const pacotes = [];
  const defs = CAVERNAS_KANTO.slice();
  for (let ay = 0; ay < LADO_KANTO; ay++) {
    for (let ax = 0; ax < LADO_KANTO; ax++) {
      if (!areaAceitaProcedural(ax, ay)) continue;
      defs.push(defProcedural(ax, ay));
    }
  }
  console.log(`cavernas ${defs.length}`);
  for (let i = 0; i < defs.length; i++) {
    const cave = defs[i];
    const pac = assarCaverna(cave);
    pac.encontros = cave.encontros;
    pacotes.push(pac);
    for (let j = 0; j < pac.posts.length; j++) caves.push(pac.posts[j]);
  }

  const pisoInfo = garantirPiso(over, caves, pacotes, chavesNoPool());
  const lendarios = contarLendarios(over, caves);

  fs.mkdirSync(pasta, { recursive: true });
  const ajustes = path.join(pasta, "ajustes.json");
  if (!fs.existsSync(ajustes)) {
    fs.writeFileSync(ajustes, '{ "moves": [] }\n');
  }
  fs.writeFileSync(path.join(pasta, "ninhos.bin"), gravarNinhos(over, caves));

  console.log(`overworld ${over.length}`);
  console.log(`caverna ${caves.length}`);
  console.log(`linhas pegáveis ${pisoInfo.pegaveis}`);
  console.log(`linhas abaixo de ${piso}: ${pisoInfo.faltando.length}`);
  if (pisoInfo.faltando.length) console.log(pisoInfo.faltando.join(", "));
  console.log(`lendários no arquivo: ${lendarios}`);
  if (pisoInfo.faltando.length || lendarios) process.exitCode = 1;
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
