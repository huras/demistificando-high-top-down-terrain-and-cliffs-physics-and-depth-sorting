/**
 * Alcateia pequena da caverna. Não usa os ninhos do overworld.
 */
import { criarAtor } from "../pokemon/ator.js";
import { especie } from "../pokemon/dados.js";
import { nivelEm } from "../pokemon/distribuicao/forca.js";
import { resolverEspecieNoNivel } from "../pokemon/pack.js";
import { PERFIL_A_PE } from "../navegacao/perfilMovimento.js";
import { hashSeed, mulberry32 } from "../santuario/dungeonGen.js";
import { conterNoInterior } from "../jogo/pisoInterior.js";
import { ALTURA_PRACA } from "../mundo/regiao/amostraKanto.js";
import { ORIGEM_CAVERNA_X, ORIGEM_CAVERNA_Y } from "../mundo/bounds.js";
import { CHAO, classeDaCelula } from "./interior/gerar.js";
import { layoutAtivo } from "./interior/sessao.js";

/** @type {object[]} */
const alcateia = [];

export function limparSelvagensCaverna() {
  alcateia.length = 0;
}

export function selvagensCaverna() {
  return alcateia;
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

export function spawnSelvagensCaverna(outdoorX, outdoorY) {
  limparSelvagensCaverna();
  const lay = layoutAtivo();
  if (!lay) return;
  const tabela = lay.encontros || ["zubat", "geodude"];
  const rng = mulberry32(hashSeed(`${lay.id}:wild`));
  const nivel = Math.max(4, nivelEm(outdoorX || 0, outdoorY || 0) | 0);
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
  if (!candidatos.length) return;
  let postos = 0;
  let guarda = 0;
  while (postos < querer && guarda < querer * 6) {
    guarda++;
    const fonte = postos % 2 === 0 && estreitos.length ? estreitos : candidatos;
    const i = Math.floor(rng() * (fonte.length / 2)) * 2;
    const tx = fonte[i];
    const ty = fonte[i + 1];
    const bruta = tabela[Math.floor(rng() * tabela.length)] || "zubat";
    const speciesKey = resolverEspecieNoNivel(bruta, nivel) || (especie(bruta) ? bruta : null);
    const esp = especie(speciesKey || "") || especie("zubat") || especie("pidgey");
    if (!esp) continue;
    const hostil = rng() < 0.2;
    const x = ORIGEM_CAVERNA_X + tx + 0.5;
    const y = ORIGEM_CAVERNA_Y + ty + 0.5;
    const ator = criarAtor({
      id: `cave-${lay.id}-${postos}`,
      especie: esp,
      nivel,
      faccao: "selvagem",
      x,
      y,
      z: ALTURA_PRACA,
      casaX: x,
      casaY: y,
      casaZ: ALTURA_PRACA,
      hostil,
      efemero: true,
      agroPersistente: hostil,
      prefereParty: true,
      dormindo: 0,
      raioTerritorio: 10,
    });
    ator.modo = hostil ? "agro" : "roam";
    ator.raioAgro = hostil ? 12 : 7;
    ator._caverna = true;
    ator.perfil = PERFIL_A_PE;
    alcateia.push(ator);
    postos++;
  }
}

export function tickSelvagensCaverna() {
  for (let i = alcateia.length - 1; i >= 0; i--) {
    const a = alcateia[i];
    if (a.capturado || (a.morto && a.mortoAte && performance.now() >= a.mortoAte)) {
      alcateia.splice(i, 1);
      continue;
    }
    conterNoInterior(a);
  }
}
