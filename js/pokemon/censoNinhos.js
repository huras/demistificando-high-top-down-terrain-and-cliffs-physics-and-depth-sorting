/**
 * Censo lido do binário. Não varre o mundo.
 */
import { POKEMON } from "../config.js";
import { chavesNoPool } from "./distribuicao/indice.js";
import { especie, listarEspecies } from "./dados.js";
import { ehLendario } from "./lendarios.js";
import { listarCaverna, listarOverworld } from "./ninhosAssados.js";
import { linhaDaEspecie } from "./pack.js";

const KINDS = ["land", "high", "surface", "undersea"];

function linhaVazia(esp) {
  return {
    key: esp.key,
    nome: esp.nome || esp.key,
    dex: esp.dex | 0,
    total: 0,
    shiny: 0,
    land: 0,
    high: 0,
    surface: 0,
    undersea: 0,
    cave: 0,
    nivelMin: esp.nivelMin | 0 || 1,
    situacao: ehLendario(esp.dex) ? "lendário" : "sem ninho",
  };
}

function raizDe(chave, cache) {
  const hit = cache.get(chave);
  if (hit) return hit;
  const linha = linhaDaEspecie(chave);
  let raiz = chave;
  for (let i = 0; i < linha.length; i++) {
    const esp = especie(linha[i]);
    if (esp && !ehLendario(esp.dex)) {
      raiz = linha[i];
      break;
    }
  }
  for (let i = 0; i < linha.length; i++) cache.set(linha[i], raiz);
  cache.set(chave, raiz);
  return raiz;
}

export function montarCensoNinhos() {
  const piso = Math.max(1, POKEMON.PISO_NINHOS | 0);
  const porEspecie = new Map();
  const porLinha = new Map();
  const raizCache = new Map();
  const totais = { ninhos: 0, shiny: 0, land: 0, high: 0, surface: 0, undersea: 0, cave: 0 };
  const noPool = chavesNoPool();

  function somar(speciesKey, dex, kind, shiny) {
    const esp = especie(speciesKey);
    const key = esp?.key || speciesKey;
    if (!key) return;
    let row = porEspecie.get(key);
    if (!row) {
      row = linhaVazia(esp || { key, nome: key, dex, nivelMin: 1 });
      porEspecie.set(key, row);
    }
    row.total++;
    if (shiny) {
      row.shiny++;
      totais.shiny++;
    }
    if (kind === "cave") {
      row.cave++;
      totais.cave++;
    } else if (KINDS.includes(kind)) {
      row[kind]++;
      totais[kind]++;
    }
    totais.ninhos++;
    const raiz = raizDe(key, raizCache);
    porLinha.set(raiz, (porLinha.get(raiz) | 0) + 1);
  }

  const over = listarOverworld();
  for (let i = 0; i < over.length; i++) {
    const lar = over[i];
    somar(lar.speciesKey, lar.dex, lar.kind, lar.shiny);
  }
  const caves = listarCaverna();
  for (let i = 0; i < caves.length; i++) {
    const posto = caves[i];
    somar(posto.speciesKey, posto.dex, "cave", posto.shiny);
  }

  const todas = listarEspecies();
  const pegaveis = new Set();
  for (let i = 0; i < todas.length; i++) {
    const esp = todas[i];
    if (!esp?.key || !(esp.dex | 0)) continue;
    if (!ehLendario(esp.dex)) pegaveis.add(raizDe(esp.key, raizCache));
    const row = porEspecie.get(esp.key);
    if (!row) porEspecie.set(esp.key, linhaVazia(esp));
  }

  let cobertas = 0;
  let abaixo = 0;
  for (const raiz of pegaveis) {
    const n = porLinha.get(raiz) | 0;
    if (n >= 1) cobertas++;
    if (n < piso) abaixo++;
  }

  const linhas = [];
  for (const row of porEspecie.values()) {
    const esp = especie(row.key);
    if (esp) row.nivelMin = esp.nivelMin | 0 || 1;
    const raiz = raizDe(row.key, raizCache);
    const daLinha = porLinha.get(raiz) | 0;
    if (ehLendario(row.dex)) row.situacao = "lendário";
    else if (row.total > 0 && daLinha >= piso) row.situacao = "com ninho";
    else if (row.total > 0) row.situacao = "abaixo do piso";
    else if (daLinha > 0) row.situacao = "na linha";
    else if (noPool.has(row.key)) row.situacao = "no pool, sem ninho";
    else row.situacao = "fora dos biomas";
    linhas.push(row);
  }

  return {
    linhas,
    totais,
    linhasCobertas: cobertas,
    linhasPegaveis: pegaveis.size,
    abaixo,
  };
}
