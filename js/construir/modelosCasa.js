/**
 * IDs de modelos 3D disponíveis no catálogo de casas do jogador.
 */
import { MODELO_CASA_SITE } from "../mundo/sites/catalogo.js";
import { idsModelosSite, idsVisuais, origemDoModelo } from "../mundo/cidade/catalogoCasas.js";

const CIDADE_BASE = Object.freeze([
  "casa-bark",
  "casa-amigo",
  "casa-cherry",
  "casa-guia",
]);

const BLOQUEADOS = new Set([
  "centro",
  "loja",
  "lab",
  "ginasio",
  "museu",
  "coliseu",
  "mansao",
  "ruina",
  "poste",
]);

/** @type {string[]|null} */
let cache = null;

/**
 * Lista estável de buildingIds construíveis (casas cidade + modelos de sítio).
 */
export function listarIdsCasaJogador() {
  if (cache) return cache;
  const set = new Set(CIDADE_BASE);
  for (const id of idsVisuais()) {
    if (BLOQUEADOS.has(id)) continue;
    if (!origemDoModelo(id)) continue;
    if (id.startsWith("casa-") || id.includes("house") || id.includes("House")) {
      set.add(id);
    }
  }
  for (const id of idsModelosSite()) {
    if (id === "logs") continue;
    set.add(id);
  }
  for (const id of Object.values(MODELO_CASA_SITE)) {
    if (id === "ruina") continue;
    set.add(id);
  }
  cache = Object.freeze([...set]);
  return cache;
}

export function ehCasaSite(buildingId) {
  return idsModelosSite().includes(buildingId);
}
