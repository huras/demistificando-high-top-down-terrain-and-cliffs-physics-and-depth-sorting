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

export function listarEspecies() {
  if (!especies) return [];
  const chaves = Object.keys(especies);
  const lista = [];
  for (let i = 0; i < chaves.length; i++) lista.push(especies[chaves[i]]);
  return lista;
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

function dobrarCustoPp(tabela) {
  const chaves = Object.keys(tabela);
  for (let i = 0; i < chaves.length; i++) {
    const g = tabela[chaves[i]];
    if (!g) continue;
    g.pp = (g.pp | 0 || 1) * 2;
    if (g.forma !== "contact" && g.forma !== "radius") continue;
    g.pp = Math.max(1, Math.round(g.pp / 2));
  }
}

function aplicarPivos(arquivo) {
  if (!arquivo || typeof arquivo !== "object" || Array.isArray(arquivo)) return;
  const chaves = Object.keys(arquivo);
  for (let i = 0; i < chaves.length; i++) {
    const esp = especies[chaves[i]];
    const item = arquivo[chaves[i]];
    if (!esp || !item || typeof item !== "object") continue;
    const offsetY = Number(item.offsetY);
    const dx = Number(item.dx);
    const dy = Number(item.dy);
    if (Number.isFinite(offsetY)) esp.offsetY = offsetY;
    if (Number.isFinite(dx)) esp.pivoDx = dx;
    if (Number.isFinite(dy)) esp.pivoDy = dy;
  }
}

export async function carregarDados() {
  const [catRes, dropRes, pivoRes] = await Promise.all([
    fetch("/ref/catalogo.json"),
    fetch("/ref/src/data/pokemon/speciesDrops.json"),
    fetch("/assets/pokemon/pivos.json"),
  ]);
  if (!catRes.ok) throw new Error("catálogo de pokémon indisponível");
  const cat = await catRes.json();
  especies = cat.especies || {};
  golpes = cat.golpes || {};
  dobrarCustoPp(golpes);
  if (dropRes.ok) {
    const bruto = await dropRes.json();
    drops = {
      berries: bruto.berries || {},
      materials: bruto.materials || {},
    };
  }
  if (pivoRes.ok) aplicarPivos(await pivoRes.json());
  pronto = true;
  return { especies: Object.keys(especies).length, golpes: Object.keys(golpes).length };
}
