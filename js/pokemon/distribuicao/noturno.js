/**
 * Quem é noturno no overworld (sono natural só para diurnos à noite).
 * 1) set explícito  2) tipos ghost/dark  3) resto = diurno
 */
import { especie } from "../dados.js";

/** Chaves explicitamente noturnas. */
const NOTURNOS = new Set([
  "zubat",
  "golbat",
  "crobat",
  "gastly",
  "haunter",
  "gengar",
  "hoothoot",
  "noctowl",
  "spinarak",
  "ariados",
  "murkrow",
  "honchkrow",
  "misdreavus",
  "mismagius",
  "sneasel",
  "weavile",
  "houndour",
  "houndoom",
  "umbreon",
  "absol",
  "sableye",
  "shuppet",
  "banette",
  "duskull",
  "dusclops",
  "dusknoir",
  "drifloon",
  "drifblim",
  "spiritomb",
  "stunky",
  "skuntank",
  "skorupi",
  "drapion",
  "darkrai",
  "cresselia",
  "lunatone",
  "nuzleaf",
  "shiftry",
  "cacturne",
  "mightyena",
  "poochyena",
  "noibat",
  "noivern",
]);

/**
 * @param {string | { key?: string, tipos?: string[] } | null | undefined} chaveOuEsp
 */
export function ehNoturno(chaveOuEsp) {
  let chave = "";
  let tipos = null;
  if (typeof chaveOuEsp === "string") {
    chave = chaveOuEsp;
  } else if (chaveOuEsp && typeof chaveOuEsp === "object") {
    chave = String(chaveOuEsp.key || chaveOuEsp.especie?.key || "");
    tipos = chaveOuEsp.tipos || chaveOuEsp.especie?.tipos;
  }
  if (!chave) return false;
  if (NOTURNOS.has(chave)) return true;
  const esp = tipos ? null : especie(chave);
  const lista = tipos || esp?.tipos || [];
  for (let i = 0; i < lista.length; i++) {
    const t = String(lista[i] || "").toLowerCase();
    if (t === "ghost" || t === "dark") return true;
  }
  return false;
}

export function ehDiurno(chaveOuEsp) {
  return !ehNoturno(chaveOuEsp);
}
