/** Catálogo carregado uma vez: espécies, golpes e tabelas de drop. */

let especies = null;
let golpes = null;
let drops = { berries: {}, materials: {} };
let pronto = false;

export function dadosProntos() {
  return pronto;
}

export function especie(chave) {
  return especies?.[chave] || null;
}

export function golpe(chave) {
  return golpes?.[chave] || null;
}

export function dropsDaEspecie(chave) {
  return {
    berries: drops.berries?.[chave] || null,
    materials: drops.materials?.[chave] || null,
  };
}

export async function carregarDados() {
  const [catRes, dropRes] = await Promise.all([
    fetch("/ref/catalogo.json"),
    fetch("/ref/src/data/pokemon/speciesDrops.json"),
  ]);
  if (!catRes.ok) throw new Error("catálogo de pokémon indisponível");
  const cat = await catRes.json();
  especies = cat.especies || {};
  golpes = cat.golpes || {};
  if (dropRes.ok) {
    const bruto = await dropRes.json();
    drops = {
      berries: bruto.berries || {},
      materials: bruto.materials || {},
    };
  }
  pronto = true;
  return { especies: Object.keys(especies).length, golpes: Object.keys(golpes).length };
}
