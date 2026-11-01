/**
 * Pontos de luz por modelo.
 * Casa/poste/Pokémon: flare (cartão) + poça no mapa de chão.
 * Só santuário ainda disputa o pool de PointLight (flare dinâmico).
 *
 * Pokémon elétrico/fogo/psíquico (qualquer facção): fallback por tipo se não
 * houver entrada no catálogo (ex.: Pikachu autorado ganha o ponto do JSON).
 */

/** Tinta luminosa (mais quente que COR_TIPO da UI). */
export const COR_LUZ_TIPO = Object.freeze({
  electric: "#ffcc66",
  fire: "#ff7a3d",
  psychic: "#ff6ad5",
});

const VAZIO = Object.freeze([]);
const _pontoTipo = {
  x: 0,
  y: 0.48,
  z: 0,
  cor: COR_LUZ_TIPO.electric,
  raio: 2.5,
  intensidade: 1.15,
};
const _listaTipo = [_pontoTipo];

let modelos = {};
let promessa = null;

export function carregarCatalogoLuzes() {
  if (promessa) return promessa;
  promessa = fetch("/assets/luzes/catalogo.json")
    .then((res) => (res.ok ? res.json() : { modelos: {} }))
    .then((json) => {
      modelos = json?.modelos && typeof json.modelos === "object" ? json.modelos : {};
      return modelos;
    })
    .catch(() => {
      modelos = {};
      return modelos;
    });
  return promessa;
}

export function pontosDoModelo(id) {
  const lista = modelos[id]?.pontos;
  return Array.isArray(lista) ? lista : VAZIO;
}

/** Primeiro tipo com brilho de aura (ordem do monstro). */
export function tipoBrilhoDe(tipos) {
  if (!tipos?.length) return null;
  for (let i = 0; i < tipos.length; i++) {
    const t = tipos[i];
    if (COR_LUZ_TIPO[t]) return t;
  }
  return null;
}

/**
 * Pontos de flare/poça do ator.
 * 1) Catálogo por espécie (autorado).
 * 2) Elétrico/fogo/psíquico → ponto padrão com cor do tipo.
 */
export function pontosBrilhoAtor(ator) {
  if (!ator || ator.morto) return VAZIO;
  const cat = pontosDoModelo(ator.especie?.key);
  if (cat.length) return cat;
  const tipo = tipoBrilhoDe(ator.tipos || ator.especie?.tipos);
  if (!tipo) return VAZIO;
  _pontoTipo.cor = COR_LUZ_TIPO[tipo];
  return _listaTipo;
}
