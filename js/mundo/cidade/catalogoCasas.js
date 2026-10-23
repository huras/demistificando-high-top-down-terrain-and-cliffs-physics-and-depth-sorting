/**
 * Casa residencial de cada cidade de Kanto.
 * Cinnabar não tem pacote próprio e usa as quatro casas gerais.
 */
const GERAL = ["casa-bark", "casa-amigo", "casa-cherry", "casa-guia"];

const FIXOS = {
  centro: { base: "assets/models/cidade/centro/", arquivo: "modelo.obj" },
  loja: { base: "assets/models/cidade/loja/", arquivo: "modelo.obj" },
  lab: { base: "assets/models/cidade/lab/", arquivo: "modelo.obj" },
  ginasio: { base: "assets/models/cidade/ginasio/", arquivo: "modelo.obj" },
  museu: { base: "assets/models/cidade/museu/", arquivo: "modelo.obj" },
  coliseu: { base: "assets/models/cidade/coliseu/", arquivo: "modelo.obj" },
  mansao: { base: "assets/models/cidade/mansao/", arquivo: "modelo.obj" },
  ruina: { base: "assets/models/cidade/ruina/", arquivo: "modelo.obj" },
  poste: { base: "assets/models/cidade/poste/", arquivo: "modelo.obj" },
  "casa-bark": { base: "assets/models/cidade/casa-bark/", arquivo: "modelo.obj" },
  "casa-amigo": { base: "assets/models/cidade/casa-amigo/", arquivo: "modelo.obj" },
  "casa-cherry": { base: "assets/models/cidade/casa-cherry/", arquivo: "modelo.obj" },
  "casa-guia": { base: "assets/models/cidade/casa-guia/", arquivo: "modelo.obj" },
};

function casa(pasta, arquivo) {
  return {
    id: arquivo.replace(/\.obj$/i, "").replace(/\s+/g, "-").toLowerCase(),
    base: pasta.endsWith("/") ? pasta : `${pasta}/`,
    arquivo,
  };
}

const POR_CIDADE = {
  "pallet-town": [
    casa("assets/models/hgss/Pallet Town Houses/Pallet Town House 1", "Pallet Town House.obj"),
    casa("assets/models/hgss/Pallet Town Houses/Pallet Town House 2", "Pallet Town House 2.obj"),
  ],
  viridian: [
    casa("assets/models/hgss/Viridian City Houses/Viridian City House 1", "Viridian City House.obj"),
    casa("assets/models/hgss/Viridian City Houses/Viridian City House 2", "Viridian City House 2.obj"),
  ],
  pewter: [casa("assets/models/hgss/Pewter City House", "Pewter City House.obj")],
  cerulean: [
    casa("assets/models/hgss/Cerulean City Houses/Cerulean City House 1", "Cerulean City House 1.obj"),
    casa("assets/models/hgss/Cerulean City Houses/Cerulean City House 2", "Cerulean City House 2.obj"),
  ],
  celadon: [casa("assets/models/hgss/Celadon City House", "Celadon City House.obj")],
  saffron: [
    casa("assets/models/hgss/Saffron City Houses/Saffron City House 1", "Saffron City House 1.obj"),
    casa("assets/models/hgss/Saffron City Houses/Saffron City House 2", "Saffron City House 2.obj"),
    casa("assets/models/hgss/Saffron City Houses/Copycat's House", "Copycat's House.obj"),
    casa("assets/models/hgss/Saffron City Houses/Mr. Psychic's House", "Mr. Psychic's House.obj"),
  ],
  lavender: [casa("assets/models/hgss/Lavender Town House", "Lavender Town House.obj")],
  vermilion: [
    casa("assets/models/hgss/Vermilion City Houses/Vermilion City House 1", "Vermilion City House 1.obj"),
    casa("assets/models/hgss/Vermilion City Houses/Vermilion City House 2", "Vermilion City House 2.obj"),
  ],
  fuchsia: [
    casa("assets/models/hgss/Fuchsia City Houses/Fuchsia City House 1", "Fuchsia City House 1.obj"),
    casa("assets/models/hgss/Fuchsia City Houses/Fuchsia City House 2", "Fuchsia City House 2.obj"),
  ],
};

const POR_ID = new Map();
for (const id of Object.keys(FIXOS)) POR_ID.set(id, FIXOS[id]);
for (const chave of Object.keys(POR_CIDADE)) {
  const lista = POR_CIDADE[chave];
  for (let i = 0; i < lista.length; i++) {
    const item = lista[i];
    if (POR_ID.has(item.id)) item.id = `${chave}-${item.id}`;
    POR_ID.set(item.id, item);
  }
}

export function idDaCasa(cidade, indice) {
  const lista = POR_CIDADE[cidade];
  if (!lista?.length) return GERAL[((indice % GERAL.length) + GERAL.length) % GERAL.length];
  const i = ((indice % lista.length) + lista.length) % lista.length;
  return lista[i].id;
}

export function origemDoModelo(id) {
  return POR_ID.get(id) || null;
}

export function urlDoModelo(caminho) {
  return String(caminho)
    .split("/")
    .map((parte) => encodeURIComponent(parte))
    .join("/");
}

export function idsVisuais() {
  const fixos = ["centro", "loja", "lab", "ginasio", "museu", "coliseu", "mansao", "ruina", "poste"];
  const resto = [...POR_ID.keys()].filter((id) => !fixos.includes(id));
  return fixos.concat(resto);
}

export function idsColisao() {
  return idsVisuais().filter((id) => id !== "poste");
}
