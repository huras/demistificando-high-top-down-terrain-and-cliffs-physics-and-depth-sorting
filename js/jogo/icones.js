/** Ícones copiados de sprites/items-icons. */

const REL = Object.freeze({
  pokeball: "pokeballs/poke-ball.png",
  greatball: "pokeballs/great-ball.png",
  ultraball: "pokeballs/ultra-ball.png",
  masterball: "pokeballs/master-ball.png",
  potion: "medicine/potion.png",
  superPotion: "medicine/super-potion.png",
  hyperPotion: "medicine/hyper-potion.png",
  antidote: "medicine/antidote.png",
  paralyzeHeal: "medicine/paralyze-heal.png",
  awakening: "medicine/awakening.png",
  burnHeal: "medicine/burn-heal.png",
  iceHeal: "medicine/ice-heal.png",
  fullHeal: "medicine/full-heal.png",
  revive: "medicine/revive.png",
  oran: "berries/oran-berry.png",
  sitrus: "berries/sitrus-berry.png",
  cheri: "berries/cheri-berry.png",
  chesto: "berries/chesto-berry.png",
  pecha: "berries/pecha-berry.png",
  rawst: "berries/rawst-berry.png",
  aspear: "berries/aspear-berry.png",
  lum: "berries/lum-berry.png",
  leppa: "berries/leppa-berry.png",
  hoe: "hold-items/soft-sand.png",
  wateringCan: "general-items/sprinklotad.png",
  axe: "hold-items/hard-stone.png",
  pickaxe: "hold-items/rocky-helmet.png",
  hammer: "hold-items/hard-stone.png",
  wood: "hold-items/charcoal.png",
  stone: "hold-items/hard-stone.png",
  plantFiber: "hold-items/miracle-seed.png",
  blueCrystal: "hold-items/never-melt-ice.png",
  redCrystal: "hold-items/fire-gem.png",
  yellowCrystal: "hold-items/electric-gem.png",
  expShare: "hold-items/exp-share.png",
  blocoGrama: "hold-items/miracle-seed.png",
  blocoTerra: "hold-items/soft-sand.png",
  blocoPedra: "hold-items/hard-stone.png",
});

export function urlIcone(chave) {
  const rel = REL[chave];
  return rel ? `assets/itens/${rel}` : "";
}

export function htmlIcone(chave, classe) {
  const url = urlIcone(chave);
  if (!url) return `<span class="${classe || "jogo-icone"} jogo-icone--vazio"></span>`;
  return `<img class="${classe || "jogo-icone"}" src="${url}" alt="" draggable="false" />`;
}
