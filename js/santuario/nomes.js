/**
 * Nomes de templo a partir do shrineId (port leve de templeNames).
 */
import { shrineDefByElement } from "./catalogo.js";

const PREFIXOS = [
  "Templo",
  "Santuário",
  "Altar",
  "Câmara",
  "Relíquia",
  "Monólito",
  "Oratório",
  "Capela",
];

const SUFIXOS = [
  "do Eco",
  "da Bruma",
  "do Crepúsculo",
  "da Pedra",
  "do Vento",
  "das Cinzas",
  "do Orvalho",
  "da Aurora",
  "do Silêncio",
  "das Raízes",
];

function hashStr(value) {
  const s = String(value ?? "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function nomeElemento(element) {
  const e = String(element || "normal").toLowerCase();
  const nomes = {
    normal: "Normal",
    dark: "Sombrio",
    ice: "Gelo",
    fighting: "Lutador",
    water: "Água",
    grass: "Planta",
    fire: "Fogo",
    poison: "Veneno",
    electric: "Elétrico",
    bug: "Inseto",
    rock: "Pedra",
    ground: "Terra",
    dragon: "Dragão",
    psychic: "Psíquico",
  };
  return nomes[e] || e;
}

export function nomeTemplo(shrineId, element) {
  const h = hashStr(shrineId);
  const pref = PREFIXOS[h % PREFIXOS.length];
  const suf = SUFIXOS[(h >>> 8) % SUFIXOS.length];
  const def = shrineDefByElement(element);
  const el = nomeElemento(def?.element || element);
  return `${pref} ${el} ${suf}`;
}
