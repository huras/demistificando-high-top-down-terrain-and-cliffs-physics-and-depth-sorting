/** Pontos de luz por modelo. Casa e poste em metros locais; Pokémon no cartão. */

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
  return Array.isArray(lista) ? lista : [];
}
