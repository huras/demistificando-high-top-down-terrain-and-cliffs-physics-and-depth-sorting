/**
 * Cartões 2D dos prédios: o mesmo grid do jogo, sem malha.
 * A chave do colisor troca ":" por "-" porque o arquivo não aceita dois-pontos.
 */
import { AREA_KANTO } from "../regiao/grafoKanto.js";

export const MEIA_ESCALA = new Set([
  "museum",
  "pokemon-mansion-cinnabar",
  "usina-eletrica",
  "eletrical-management-building",
]);

const SPRITE_PAPEL = Object.freeze({
  lab: "pokemon-lab",
  ginasio: "gym-base",
  museu: "museum",
  torre: "tower-A",
  coliseu: "pokemon-stadium-center",
  porto: "pokemart",
  safari: "pokemart",
  mansao: "pokemon-mansion-cinnabar",
  ruina: "underground-ruins-entrance-doors-closed",
});

const TIPO_GINASIO = Object.freeze({
  brock: "rock",
  misty: "water",
  surge: "electric",
  erika: "grass",
  koga: "poison",
  sabrina: "psychic",
  blaine: "fire",
  giovanni: "ground",
});

export const TIPOS_GINASIO = Object.freeze(Object.values(TIPO_GINASIO));

const NOME_TIPO = Object.freeze({
  rock: "pedra",
  water: "água",
  electric: "elétrico",
  grass: "planta",
  poison: "veneno",
  psychic: "psíquico",
  fire: "fogo",
  ground: "terra",
});

export function medidaSprite(id, def) {
  const s = MEIA_ESCALA.has(id) ? 0.5 : 1;
  return {
    largura: Math.max(1, Math.round(def.cols * s)),
    altura: Math.max(1, Math.round(def.rows * s)),
  };
}

export { corpoPadraoSprite, portaPadraoSprite } from "./caixaSprite.js";

export function chaveSpritePredio(papel, ginasio) {
  if (papel === "ginasio") {
    const tipo = TIPO_GINASIO[ginasio];
    return tipo ? `gym-base:${tipo}` : "gym-base";
  }
  return SPRITE_PAPEL[papel] || null;
}

export function chaveColisorSprite(papel, ginasio) {
  const id = chaveSpritePredio(papel, ginasio);
  return id ? id.replaceAll(":", "-") : "";
}

/** O que a página de colisores lista, na ordem em que aparece no jogo. */
export function entradasEditorSprite() {
  const lista = [
    { id: "pokemon-lab", nome: "Laboratório", sprite: "pokemon-lab" },
    { id: "pokemon-stadium-center", nome: "Coliseu", sprite: "pokemon-stadium-center" },
    { id: "usina-eletrica", nome: "Usina elétrica", sprite: "usina-eletrica" },
    { id: "eletrical-management-building", nome: "Gestão da usina", sprite: "eletrical-management-building" },
    { id: "gym-base", nome: "Ginásio", sprite: "gym-base" },
  ];
  const tipos = Object.keys(NOME_TIPO);
  for (let i = 0; i < tipos.length; i++) {
    const tipo = tipos[i];
    lista.push({
      id: `gym-base-${tipo}`,
      nome: `Ginásio ${NOME_TIPO[tipo]}`,
      sprite: "gym-base",
      tipo,
    });
  }
  lista.push(
    { id: "museum", nome: "Museu", sprite: "museum" },
    { id: "tower-A", nome: "Torre", sprite: "tower-A" },
    { id: "pokemart", nome: "Porto e safari", sprite: "pokemart" },
    { id: "pokemon-mansion-cinnabar", nome: "Mansão", sprite: "pokemon-mansion-cinnabar" },
    { id: "underground-ruins-entrance-doors-closed", nome: "Ruína", sprite: "underground-ruins-entrance-doors-closed" },
  );
  return lista;
}

export function pontosGradeUsina(usina, gestao) {
  if (!usina) return [];
  const fpG = gestao || usina;
  const passoX = Math.max(usina.largura, fpG.largura) + 2;
  const passoY = Math.max(usina.altura, fpG.altura) + 2;
  const ox = 28 * AREA_KANTO;
  const oy = 8 * AREA_KANTO;
  const lista = [];
  for (let lin = 0; lin < 3; lin++) {
    for (let col = 0; col < 3; col++) {
      const centro = lin === 1 && col === 1 && gestao;
      const folha = centro ? fpG : usina;
      const x = 48 + col * passoX + Math.floor((passoX - 2 - folha.largura) / 2);
      const y = 46 + lin * passoY + Math.floor((passoY - 2 - folha.altura) / 2);
      lista.push({
        sprite: centro ? "eletrical-management-building" : "usina-eletrica",
        x: ox + x,
        y: oy + y,
        altura: folha.altura,
      });
    }
  }
  return lista;
}

function desenharTile(ctx, img, tileId, colunas, tile, dx, dy) {
  if (tileId == null) return;
  const col = tileId % colunas;
  const row = Math.floor(tileId / colunas);
  ctx.drawImage(img, col * tile, row * tile, tile, tile, dx, dy, tile, tile);
}

export function assarSprite(def, img, tipo) {
  const tile = def.tileSize || 16;
  const tela = document.createElement("canvas");
  tela.width = Math.max(1, def.cols * tile);
  tela.height = Math.max(1, def.rows * tile);
  const ctx = tela.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  const simbolo = tipo ? def.overlay?.types?.[tipo] : null;
  const ox = def.overlay?.originCol | 0;
  const oy = def.overlay?.originRow | 0;
  for (let row = 0; row < def.rows; row++) {
    const linha = def.grid[row];
    if (!linha) continue;
    for (let col = 0; col < def.cols; col++) {
      const celula = linha[col];
      if (!celula) continue;
      const dx = col * tile;
      const dy = row * tile;
      desenharTile(ctx, img, celula[0], def.columns, tile, dx, dy);
      if (!celula[1] || !simbolo) continue;
      const st = simbolo[row - oy]?.[col - ox];
      desenharTile(ctx, img, st, def.columns, tile, dx, dy);
    }
  }
  return tela;
}
