/**
 * Conta os lares do overworld sem gravar descoberta.
 * Mesma regra de resolverLarSlot — só agrega.
 */
import { CHUNK_XZ, POKEMON } from "../config.js";
import { chavesNoPool } from "./distribuicao/indice.js";
import { LADO_MUNDO } from "../mundo/bounds.js";
import { especie, listarEspecies } from "./dados.js";
import { ehLendario } from "./lendarios.js";
import { resolverLarSlot } from "./laresMapa.js";

const KINDS = ["land", "high", "surface", "undersea"];

function linhaVazia(esp, noPool) {
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
    nivelMin: esp.nivelMin | 0 || 1,
    noPool,
    situacao: ehLendario(esp.dex) ? "lendário" : noPool ? "no pool, sem ninho" : "fora dos biomas",
  };
}

function linhaNova(lar) {
  const esp = especie(lar.speciesKey);
  return {
    key: lar.speciesKey,
    nome: esp?.nome || lar.speciesKey,
    dex: lar.dex | 0,
    total: 0,
    shiny: 0,
    land: 0,
    high: 0,
    surface: 0,
    undersea: 0,
    nivelMin: esp?.nivelMin | 0 || 1,
    noPool: true,
    situacao: "com ninho",
  };
}

/** Inclui o catálogo inteiro. Quem não sorteou ninho fica com total 0. */
function completarCatalogo(porEspecie) {
  const noPool = chavesNoPool();
  const todas = listarEspecies();
  for (let i = 0; i < todas.length; i++) {
    const esp = todas[i];
    if (!esp?.key || !(esp.dex | 0)) continue;
    const row = porEspecie.get(esp.key);
    if (row) {
      row.nivelMin = esp.nivelMin | 0 || 1;
      row.noPool = noPool.has(esp.key);
      if (ehLendario(esp.dex)) row.situacao = "lendário";
      else if (row.total >= (POKEMON.PISO_NINHOS | 0 || 3)) row.situacao = "com ninho";
      else if (row.total) row.situacao = "abaixo do piso";
      else row.situacao = noPool.has(esp.key) ? "no pool, sem ninho" : "fora dos biomas";
      continue;
    }
    porEspecie.set(esp.key, linhaVazia(esp, noPool.has(esp.key)));
  }
}

function totaisNovos() {
  return { ninhos: 0, shiny: 0, land: 0, high: 0, surface: 0, undersea: 0 };
}

/**
 * @param {(p: { feitos: number, total: number, ninhos: number, pronto: boolean, linhas: object[], totais: object }) => void} aoProgresso
 */
export function varrerCensoNinhos(aoProgresso) {
  const lado = Math.ceil(LADO_MUNDO / CHUNK_XZ);
  const slots = Math.max(1, POKEMON.LARES_POR_CHUNK | 0);
  const total = lado * lado;
  const porEspecie = new Map();
  const totais = totaisNovos();
  let cx = 0;
  let cy = 0;
  let feitos = 0;
  let cancelado = false;

  const linhas = () => {
    completarCatalogo(porEspecie);
    const out = [];
    for (const row of porEspecie.values()) out.push(row);
    return out;
  };

  const passo = () => {
    if (cancelado) return;
    const t0 = performance.now();
    while (cy < lado && performance.now() - t0 < 6) {
      for (let i = 0; i < slots; i++) {
        const lar = resolverLarSlot(cx, cy, i);
        if (!lar) continue;
        totais.ninhos++;
        if (lar.shiny) totais.shiny++;
        const kind = KINDS.includes(lar.kind) ? lar.kind : "land";
        totais[kind]++;
        let row = porEspecie.get(lar.speciesKey);
        if (!row) {
          row = linhaNova(lar);
          porEspecie.set(lar.speciesKey, row);
        }
        row.total++;
        if (lar.shiny) row.shiny++;
        row[kind]++;
      }
      cx++;
      feitos++;
      if (cx >= lado) {
        cx = 0;
        cy++;
      }
    }
    const pronto = cy >= lado;
    aoProgresso({
      feitos,
      total,
      ninhos: totais.ninhos,
      pronto,
      linhas: pronto ? linhas() : [],
      totais,
    });
    if (!pronto) requestAnimationFrame(passo);
  };

  requestAnimationFrame(passo);
  return () => {
    cancelado = true;
  };
}
