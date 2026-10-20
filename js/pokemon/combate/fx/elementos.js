/** Paleta elemental (BattleParticles) — cores e taxas de rastro/impacto. */

/**
 * @typedef {object} ConfigRastro
 * @property {number} taxa
 * @property {number} vida
 * @property {number} dispersao
 */

/**
 * @typedef {object} ConfigImpacto
 * @property {number} particulas
 * @property {number} raio
 * @property {number} duracao
 * @property {number} [gravidade]
 */

/**
 * @typedef {object} ConfigElemento
 * @property {string} id
 * @property {string} primaria
 * @property {string} secundaria
 * @property {string} nucleo
 * @property {ConfigRastro} rastro
 * @property {ConfigImpacto} impacto
 */

/** @type {ConfigElemento[]} */
const LISTA = [
  {
    id: "normal",
    primaria: "#a8a878",
    secundaria: "#c6c6a7",
    nucleo: "#f0f0e8",
    rastro: { taxa: 20, vida: 0.3, dispersao: 0.8 },
    impacto: { particulas: 24, raio: 0.42, duracao: 0.35 },
  },
  {
    id: "fire",
    primaria: "#f08030",
    secundaria: "#f8d030",
    nucleo: "#fff4c8",
    rastro: { taxa: 28, vida: 0.4, dispersao: 1.4 },
    impacto: { particulas: 36, raio: 0.54, duracao: 0.45, gravidade: 2.2 },
  },
  {
    id: "water",
    primaria: "#6890f0",
    secundaria: "#98d8d8",
    nucleo: "#d0f0ff",
    rastro: { taxa: 22, vida: 0.35, dispersao: 0.6 },
    impacto: { particulas: 30, raio: 0.46, duracao: 0.4, gravidade: 3.2 },
  },
  {
    id: "electric",
    primaria: "#f8d030",
    secundaria: "#fff080",
    nucleo: "#ffffc0",
    rastro: { taxa: 32, vida: 0.2, dispersao: 2.0 },
    impacto: { particulas: 40, raio: 0.5, duracao: 0.3 },
  },
  {
    id: "grass",
    primaria: "#78c850",
    secundaria: "#a8e060",
    nucleo: "#e0ffc0",
    rastro: { taxa: 18, vida: 0.45, dispersao: 1.0 },
    impacto: { particulas: 28, raio: 0.44, duracao: 0.5, gravidade: 1.6 },
  },
  {
    id: "ice",
    primaria: "#98d8d8",
    secundaria: "#c0f0f0",
    nucleo: "#e8ffff",
    rastro: { taxa: 16, vida: 0.5, dispersao: 0.5 },
    impacto: { particulas: 32, raio: 0.48, duracao: 0.55 },
  },
  {
    id: "fighting",
    primaria: "#c03028",
    secundaria: "#e85850",
    nucleo: "#ffc8c0",
    rastro: { taxa: 24, vida: 0.25, dispersao: 1.6 },
    impacto: { particulas: 34, raio: 0.52, duracao: 0.35, gravidade: 1.1 },
  },
  {
    id: "poison",
    primaria: "#a040a0",
    secundaria: "#c060c0",
    nucleo: "#f0c0f0",
    rastro: { taxa: 20, vida: 0.55, dispersao: 0.9 },
    impacto: { particulas: 30, raio: 0.46, duracao: 0.6, gravidade: -0.8 },
  },
  {
    id: "ground",
    primaria: "#e0c068",
    secundaria: "#c8a848",
    nucleo: "#fff0c0",
    rastro: { taxa: 14, vida: 0.4, dispersao: 1.2 },
    impacto: { particulas: 36, raio: 0.56, duracao: 0.5, gravidade: 2.8 },
  },
  {
    id: "flying",
    primaria: "#a890f0",
    secundaria: "#c8b0f8",
    nucleo: "#f0e8ff",
    rastro: { taxa: 26, vida: 0.3, dispersao: 1.8 },
    impacto: { particulas: 26, raio: 0.4, duracao: 0.35, gravidade: -0.55 },
  },
  {
    id: "psychic",
    primaria: "#f85888",
    secundaria: "#f898a8",
    nucleo: "#ffe0e8",
    rastro: { taxa: 24, vida: 0.45, dispersao: 1.5 },
    impacto: { particulas: 32, raio: 0.48, duracao: 0.45 },
  },
  {
    id: "bug",
    primaria: "#a8b820",
    secundaria: "#c8d830",
    nucleo: "#f0ffc0",
    rastro: { taxa: 22, vida: 0.35, dispersao: 1.1 },
    impacto: { particulas: 28, raio: 0.42, duracao: 0.4, gravidade: 1.4 },
  },
  {
    id: "rock",
    primaria: "#b8a038",
    secundaria: "#d0c060",
    nucleo: "#fff8d0",
    rastro: { taxa: 12, vida: 0.35, dispersao: 0.7 },
    impacto: { particulas: 38, raio: 0.52, duracao: 0.4, gravidade: 3.8 },
  },
  {
    id: "ghost",
    primaria: "#705898",
    secundaria: "#9070b8",
    nucleo: "#e0d0f8",
    rastro: { taxa: 18, vida: 0.6, dispersao: 1.3 },
    impacto: { particulas: 26, raio: 0.44, duracao: 0.55, gravidade: -0.4 },
  },
  {
    id: "dragon",
    primaria: "#7038f8",
    secundaria: "#9070ff",
    nucleo: "#e0d0ff",
    rastro: { taxa: 26, vida: 0.4, dispersao: 1.6 },
    impacto: { particulas: 40, raio: 0.58, duracao: 0.5 },
  },
  {
    id: "dark",
    primaria: "#705848",
    secundaria: "#907868",
    nucleo: "#d0c0b0",
    rastro: { taxa: 16, vida: 0.45, dispersao: 0.8 },
    impacto: { particulas: 30, raio: 0.46, duracao: 0.45, gravidade: 0.8 },
  },
  {
    id: "steel",
    primaria: "#b8b8d0",
    secundaria: "#d8d8e8",
    nucleo: "#ffffff",
    rastro: { taxa: 14, vida: 0.3, dispersao: 0.4 },
    impacto: { particulas: 34, raio: 0.44, duracao: 0.35 },
  },
  {
    id: "fairy",
    primaria: "#ee99ac",
    secundaria: "#ffb8c8",
    nucleo: "#fff0f4",
    rastro: { taxa: 28, vida: 0.5, dispersao: 1.4 },
    impacto: { particulas: 32, raio: 0.46, duracao: 0.5, gravidade: -0.3 },
  },
];

/** @type {Record<string, ConfigElemento>} */
const MAPA = Object.create(null);
for (let i = 0; i < LISTA.length; i++) MAPA[LISTA[i].id] = LISTA[i];

export function elementoDe(tipo) {
  return MAPA[tipo] || MAPA.normal;
}
