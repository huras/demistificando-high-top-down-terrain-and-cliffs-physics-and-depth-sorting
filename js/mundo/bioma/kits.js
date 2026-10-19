/** Catálogo visual dos biomas de terra (props, chão, cliff). */

/** @type {object | null} */
let dados = null;

export function definirKits(proximo) {
  dados = proximo || null;
}

export async function carregarKits() {
  const res = await fetch("biomas/kits.json", { cache: "no-store" });
  if (!res.ok) throw new Error("biomas/kits.json");
  definirKits(await res.json());
}

export function obterKits() {
  return dados;
}

export function idsDeKit() {
  return Object.keys(dados?.kits || {});
}

export function obterKit(id) {
  if (!id || !dados?.kits) return null;
  return dados.kits[id] || null;
}

export function chanceGrama() {
  const n = Number(dados?.gramaChance);
  return Number.isFinite(n) ? n : 0.35;
}

export function chancePedra() {
  const n = Number(dados?.pedraChance);
  return Number.isFinite(n) ? n : 0.02;
}

export function arquivoSprite(id) {
  return dados?.sprites?.[id]?.arquivo || null;
}

/** @param {{ id: string, peso?: number }[] | null | undefined} lista */
export function sortearSprite(lista, u) {
  if (!lista?.length) return null;
  let soma = 0;
  for (let i = 0; i < lista.length; i++) {
    soma += Math.max(0, Number(lista[i].peso) || 0);
  }
  if (soma <= 0) return lista[0].id;
  let acc = (u - Math.floor(u)) * soma;
  for (let i = 0; i < lista.length; i++) {
    acc -= Math.max(0, Number(lista[i].peso) || 0);
    if (acc <= 0) return lista[i].id;
  }
  return lista[lista.length - 1].id;
}
