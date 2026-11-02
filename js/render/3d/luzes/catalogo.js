/**
 * Pontos de luz por modelo.
 * Casa/poste/Pokémon: flare (cartão) + poça no mapa de chão.
 * Só santuário ainda disputa o pool de PointLight (flare dinâmico).
 *
 * Pokémon elétrico/fogo/psíquico (qualquer facção): fallback por tipo se não
 * houver entrada no catálogo (ex.: Pikachu autorado ganha o ponto do JSON).
 */

/**
 * Fallback por tipo: cor + alcance do flare (poça no mapa usa intensidade;
 * raio do stamp continua no PERFIL_POKEMON).
 */
export const PERFIL_LUZ_TIPO = Object.freeze({
  electric: Object.freeze({ cor: "#ffcc66", raio: 2.35, intensidade: 1.2 }),
  fire: Object.freeze({ cor: "#ff7a3d", raio: 2.85, intensidade: 1.25 }),
  psychic: Object.freeze({ cor: "#ff6ad5", raio: 2.15, intensidade: 1.05 }),
});

/** Tinta luminosa (mais quente que COR_TIPO da UI). */
export const COR_LUZ_TIPO = Object.freeze({
  electric: PERFIL_LUZ_TIPO.electric.cor,
  fire: PERFIL_LUZ_TIPO.fire.cor,
  psychic: PERFIL_LUZ_TIPO.psychic.cor,
});

const VAZIO = Object.freeze([]);
const _pontoTipo = {
  x: 0,
  y: 0.48,
  z: 0,
  cor: PERFIL_LUZ_TIPO.electric.cor,
  raio: PERFIL_LUZ_TIPO.electric.raio,
  intensidade: PERFIL_LUZ_TIPO.electric.intensidade,
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
  const perfil = PERFIL_LUZ_TIPO[tipo];
  _pontoTipo.cor = perfil.cor;
  _pontoTipo.raio = perfil.raio;
  _pontoTipo.intensidade = perfil.intensidade;
  return _listaTipo;
}
