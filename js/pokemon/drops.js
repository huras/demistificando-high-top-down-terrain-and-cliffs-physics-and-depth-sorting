import { POKEMON } from "../config.js";
import { alturaSobPes } from "../fisica/colisao.js";
import { definirEmocao, EMOCAO } from "./emocoes.js";
import { dropsDaEspecie, fallbackDoTipo } from "./dados.js";
import { nomeDoItem } from "../jogo/nomeItem.js";
import { tocarItemDrop } from "../jogo/som/mundoSfx.js";
import { guardarItem, pokemonDeployado } from "./party.js";

const itens = [];
let seq = 1;
const avisado = new Set();

function rolarLista(entradas, saida) {
  if (!entradas) return;
  for (let i = 0; i < entradas.length; i++) {
    const e = entradas[i];
    const chance = e.chance == null ? 1 : e.chance;
    if (Math.random() > chance) continue;
    const min = e.min ?? 1;
    const max = e.max ?? min;
    const n = min + Math.floor(Math.random() * (max - min + 1));
    for (let k = 0; k < n; k++) saida.push(e.key);
  }
}

export function soltarDrop(ator) {
  const tabela = dropsDaEspecie(ator.especie.key);
  const chaves = [];
  rolarLista(tabela.berries, chaves);
  rolarLista(tabela.materials, chaves);
  if (!chaves.length) rolarLista(fallbackDoTipo(ator.tipos?.[0]), chaves);
  if (chaves.length) tocarItemDrop(ator);
  for (let i = 0; i < chaves.length; i++) {
    if (itens.length >= POKEMON.DROPS_MAX) itens.shift();
    const jx = (Math.random() - 0.5) * 0.7;
    const jy = (Math.random() - 0.5) * 0.7;
    const x = ator.x + jx;
    const y = ator.y + jy;
    const z = alturaSobPes(x, y, ator.z + 0.5) || ator.z;
    itens.push({
      id: seq++,
      chave: chaves[i],
      x,
      y,
      z,
      idade: 0,
    });
  }
}

function pegar(item, quem) {
  guardarItem(item.chave);
  if (quem?.faccao === "party") definirEmocao(quem, EMOCAO.EXCLAMACAO, { duracao: 1 });
  return item.chave;
}

export function atualizarDrops(corpo, dt, flutuar) {
  const mon = pokemonDeployado();
  const r2 = POKEMON.RAIO_PICKUP * POKEMON.RAIO_PICKUP;
  for (let i = itens.length - 1; i >= 0; i--) {
    const item = itens[i];
    item.idade += dt;
    if (item.idade > 90) {
      itens.splice(i, 1);
      continue;
    }
    let quem = null;
    const dx = corpo.x - item.x;
    const dy = corpo.y - item.y;
    if (dx * dx + dy * dy <= r2) quem = corpo;
    if (!quem && mon && !mon.morto) {
      const mx = mon.x - item.x;
      const my = mon.y - item.y;
      if (mx * mx + my * my <= r2) quem = mon;
    }
    if (!quem) {
      if (mon && !avisado.has(item.id)) {
        const mx = mon.x - item.x;
        const my = mon.y - item.y;
        if (mx * mx + my * my < 36) {
          avisado.add(item.id);
          definirEmocao(mon, EMOCAO.EXCLAMACAO, { duracao: 1 });
        }
      }
      continue;
    }
    const chave = pegar(item, quem);
    itens.splice(i, 1);
    flutuar(quem.faccao ? quem : { x: corpo.x, y: corpo.y, z: corpo.elevacao ?? corpo.z }, nomeDoItem(chave), "#fde68a");
  }
}

export function dropsNoChao() {
  return itens;
}

/** Drop mais perto do mon ainda no raio do treinador (coleta OW). */
export function dropMaisPerto(mon, jogador, raio = POKEMON.RAIO_AGRO) {
  if (!mon || !itens.length) return null;
  const lim = (raio > 0 ? raio : POKEMON.RAIO_AGRO) ** 2;
  let melhor = null;
  let melhorD = Infinity;
  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];
    if (jogador) {
      const dxj = item.x - jogador.x;
      const dyj = item.y - jogador.y;
      if (dxj * dxj + dyj * dyj > lim) continue;
    }
    const dx = item.x - mon.x;
    const dy = item.y - mon.y;
    const d = dx * dx + dy * dy;
    if (d < melhorD) {
      melhor = item;
      melhorD = d;
    }
  }
  return melhor;
}
