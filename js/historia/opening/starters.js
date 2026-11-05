/** Triângulo de iniciais Red / Blue / Leaf. */

export const OPENING_STARTER_TRIOS = Object.freeze([
  Object.freeze({ id: "kanto", grass: "bulbasaur", fire: "charmander", water: "squirtle" }),
  Object.freeze({ id: "johto", grass: "chikorita", fire: "cyndaquil", water: "totodile" }),
  Object.freeze({ id: "hoenn", grass: "treecko", fire: "torchic", water: "mudkip" }),
  Object.freeze({ id: "sinnoh", grass: "turtwig", fire: "chimchar", water: "piplup" }),
]);

export const OPENING_KANTO_STARTERS = Object.freeze(["bulbasaur", "charmander", "squirtle"]);

export const OPENING_TRIAL_BONUS_MOVES = Object.freeze({
  bulbasaur: "sleepPowder",
  charmander: "ember",
  squirtle: "waterGun",
});

const TYPE_ORDER = Object.freeze(["grass", "fire", "water"]);

export function findOpeningStarterTrio(species) {
  if (!species) return null;
  for (const trio of OPENING_STARTER_TRIOS) {
    for (const type of TYPE_ORDER) {
      if (trio[type] === species) return { trio, type };
    }
  }
  return null;
}

export function resolveOpeningRivalStarters(playerSpecies) {
  const found = findOpeningStarterTrio(playerSpecies);
  if (!found) return null;
  const { trio, type: playerType } = found;
  const playerIdx = TYPE_ORDER.indexOf(playerType);
  if (playerIdx < 0) return null;
  const blueType = TYPE_ORDER[(playerIdx + 1) % 3];
  const redType = TYPE_ORDER[(playerIdx + 2) % 3];
  const leafTrio =
    OPENING_STARTER_TRIOS.find((e) => e.id !== trio.id) || OPENING_STARTER_TRIOS[1];
  return {
    blue: trio[blueType],
    red: trio[redType],
    leaf: leafTrio[playerType],
    trioId: trio.id,
    leafTrioId: leafTrio.id,
    playerType,
    blueType,
    redType,
    leafType: playerType,
  };
}
