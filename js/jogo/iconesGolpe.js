/**
 * Ícones de golpe em /ref/sprites/skills/{tipo}/{kebab}.{ext} (Pokémon AI).
 */

const BASE = "/ref/sprites/skills";
const EXTENSOES = Object.freeze(["webp", "png", "jpg", "jpeg"]);

/** Paths que existem sob sprites/skills (tipo/arquivo.ext). */
const ARQUIVOS = Object.freeze(
  new Set([
    "bug/bug-buzz.png",
    "dark/dark-pulse.png",
    "dragon/dragon-pulse.png",
    "electric/charge.webp",
    "electric/spark.webp",
    "electric/thunder-punch.webp",
    "electric/thunder-shock.webp",
    "electric/thunder-wave.webp",
    "electric/thunder.png",
    "electric/thunder.webp",
    "electric/thunderbolt.png",
    "electric/thundershock.png",
    "electric/zap-cannon.webp",
    "fairy/dazzling-gleam.png",
    "fighting/aura-sphere.png",
    "fighting/calm-mind.png",
    "fighting/chi-spark.png",
    "fire/blast-burn.jpg",
    "fire/ember-dash.jpg",
    "fire/ember.jpg",
    "fire/eruption.jpg",
    "fire/fire-blast.jpg",
    "fire/fire-blitz.jpg",
    "fire/fire-spin.jpg",
    "fire/flame-wheel.jpg",
    "fire/flamethrower.png",
    "fire/heat-wave.jpg",
    "fire/incinerate.png",
    "fire/lava-plume.jpg",
    "fire/magma-storm.jpg",
    "fire/overheat.jpg",
    "fire/sacred-fire.jpg",
    "fire/will-o-wisp.jpg",
    "flying/air-slash.png",
    "ghost/infernal-parade.png",
    "grass/absorb.jpg",
    "grass/bullet-seed.jpg",
    "grass/cotton-spore.jpg",
    "grass/cut.png",
    "grass/energy-ball.jpg",
    "grass/frenzy-plant.jpg",
    "grass/giga-drain.jpg",
    "grass/grass-knot.jpg",
    "grass/leaf-blade.jpg",
    "grass/leaf-storm.jpg",
    "grass/leech-seed.jpg",
    "grass/magical-leaf.jpg",
    "grass/mega-drain.jpg",
    "grass/needle-arm.jpg",
    "grass/petal-dance.jpg",
    "grass/power-whip.jpg",
    "grass/razor-leaf.png",
    "grass/seed-bomb.jpg",
    "grass/seed-flare.jpg",
    "grass/seed-pulse.jpg",
    "grass/sleep-powder.jpg",
    "grass/solar-beam.jpg",
    "grass/stun-spore.jpg",
    "grass/synthesis.png",
    "grass/vine-whip.jpg",
    "grass/wood-hammer.jpg",
    "grass/worry-seed.jpg",
    "ground/earthquake.png",
    "ice/aurora-beam.webp",
    "ice/blizzard.webp",
    "ice/hail.webp",
    "ice/haze.webp",
    "ice/ice-ball.webp",
    "ice/ice-beam.png",
    "ice/ice-punch.webp",
    "ice/icicle-spear.jpg",
    "ice/icy-wind.webp",
    "ice/mist.webp",
    "ice/powder-snow.webp",
    "ice/sheer-cold.webp",
    "normal/double-edge.png",
    "normal/growl.jpg",
    "normal/hyper-beam.png",
    "normal/quick-attack.jpg",
    "normal/recover.png",
    "normal/tackle.jpg",
    "normal/tackle.png",
    "normal/tail-whip.png",
    "poison/acid-gas.png",
    "poison/poison-powder.jpg",
    "poison/smog.png",
    "psychic/confusion.png",
    "psychic/mimic.jpg",
    "psychic/prismatic-beam.png",
    "psychic/prismatic-laser.png",
    "psychic/psybeam.png",
    "psychic/teleport.png",
    "rock/rock-throw.png",
    "steel/flash-cannon.png",
    "water/aqua-jet.webp",
    "water/aqua-ring.webp",
    "water/aqua-tail.webp",
    "water/brine.webp",
    "water/bubble.webp",
    "water/bubblebeam.webp",
    "water/crabhammer.webp",
    "water/dive.webp",
    "water/hydro-pump.webp",
    "water/muddy-water.webp",
    "water/octazooka.webp",
    "water/surf.webp",
    "water/water-cannon.png",
    "water/water-gun.png",
    "water/water-gun.webp",
    "water/water-pulse.webp",
    "water/water-spout.webp",
    "water/waterfall.webp",
    "water/wave-crest.webp",
    "water/whirpool.webp",
  ]),
);

const ALIASES = Object.freeze({
  calmMind: "fighting/calm-mind.png",
  thunderShock: "electric/thunder-shock.webp",
  waterCannon: "water/water-cannon.png",
  hydroPump: "water/hydro-pump.webp",
  bubbleBeam: "water/bubblebeam.webp",
  whirlpool: "water/whirpool.webp",
  acidGas: "poison/acid-gas.png",
  prismaticLaser: "psychic/prismatic-laser.png",
  prismaticBeam: "psychic/prismatic-beam.png",
  infernalParade: "ghost/infernal-parade.png",
  gust: "flying/air-slash.png",
  cut: "grass/cut.png",
  incinerate: "fire/incinerate.png",
  flareBlitz: "fire/fire-blitz.jpg",
  willOWisp: "fire/will-o-wisp.jpg",
  magicalLeaf: "grass/magical-leaf.jpg",
  mimic: "psychic/mimic.jpg",
  vineWhip: "grass/vine-whip.jpg",
  razorLeaf: "grass/razor-leaf.png",
  waterGun: "water/water-gun.webp",
  ember: "fire/ember.jpg",
  tackle: "normal/tackle.png",
});

const cache = new Map();

function chaveParaKebab(moveKey) {
  return String(moveKey)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

function stemArquivo(path) {
  return path.slice(path.indexOf("/") + 1).replace(/\.[^.]+$/, "");
}

/**
 * @param {string} moveKey
 * @param {string | null | undefined} tipo
 */
function candidatos(moveKey, tipo) {
  const kebab = chaveParaKebab(moveKey);
  const compact = kebab.replace(/-/g, "");
  /** @type {string[]} */
  const out = [];
  if (ALIASES[moveKey]) out.push(ALIASES[moveKey]);
  if (tipo) {
    for (const ext of EXTENSOES) {
      out.push(`${tipo}/${kebab}.${ext}`, `${tipo}/${compact}.${ext}`);
    }
  }
  for (const path of ARQUIVOS) {
    const stem = stemArquivo(path);
    if (stem === kebab || stem === compact) out.push(path);
  }
  return out;
}

/**
 * @param {string | null | undefined} moveKey
 * @param {string | null | undefined} [tipo]
 * @returns {string | null}
 */
export function urlIconeGolpe(moveKey, tipo) {
  if (!moveKey) return null;
  const cacheKey = `${moveKey}|${tipo || ""}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  let hit = null;
  for (const rel of candidatos(moveKey, tipo)) {
    if (ARQUIVOS.has(rel)) {
      hit = `${BASE}/${rel}`;
      break;
    }
  }
  cache.set(cacheKey, hit);
  return hit;
}

/**
 * @param {HTMLElement | null} host
 * @param {string | null | undefined} moveKey
 * @param {string | null | undefined} [tipo]
 */
export function preencherIconeGolpe(host, moveKey, tipo) {
  if (!host) return false;
  const url = urlIconeGolpe(moveKey, tipo);
  const key = moveKey || "";
  const flag = url ? "1" : "0";
  if (host.dataset.artKey === key && host.dataset.hasArt === flag) {
    host.hidden = !url;
    return !!url;
  }
  host.dataset.artKey = key;
  host.dataset.hasArt = flag;
  if (!url) {
    if (host.firstChild) host.replaceChildren();
    host.hidden = true;
    return false;
  }
  let img = host.firstElementChild;
  if (!img || img.tagName !== "IMG") {
    host.replaceChildren();
    img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    host.append(img);
  }
  if (img.getAttribute("src") !== url) img.src = url;
  host.hidden = false;
  return true;
}
