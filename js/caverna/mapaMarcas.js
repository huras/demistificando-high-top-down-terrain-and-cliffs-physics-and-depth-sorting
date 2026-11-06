/**
 * Pins das bocas já resolvidas (e das autorais, que resolvem ao abrir o mapa).
 */
import { AREA_KANTO, LADO_KANTO } from "../mundo/regiao/grafoKanto.js";
import { paraLocalKanto, dentroDoKanto } from "../mundo/bounds.js";
import { CAVERNAS_KANTO } from "./catalogo.js";
import { bocasDaArea, peekBocasDaArea } from "./bocas.js";

function garantirPerto(px, py, raio) {
  if (!dentroDoKanto(px, py)) return;
  const local = paraLocalKanto(px, py);
  const ax = Math.floor(local.x / AREA_KANTO);
  const ay = Math.floor(local.y / AREA_KANTO);
  for (let dy = -raio; dy <= raio; dy++) {
    for (let dx = -raio; dx <= raio; dx++) bocasDaArea(ax + dx, ay + dy);
  }
}

export function marcasCaverna(opts = null) {
  if (opts?.mini && Number.isFinite(opts.px) && Number.isFinite(opts.py)) {
    garantirPerto(opts.px, opts.py, 2);
  } else {
    for (let i = 0; i < CAVERNAS_KANTO.length; i++) {
      const bocas = CAVERNAS_KANTO[i].mouths;
      for (let j = 0; j < bocas.length; j++) bocasDaArea(bocas[j].ax, bocas[j].ay);
    }
    if (Number.isFinite(opts?.px) && Number.isFinite(opts?.py)) garantirPerto(opts.px, opts.py, 2);
  }

  const lista = [];
  for (let ay = 0; ay < LADO_KANTO; ay++) {
    for (let ax = 0; ax < LADO_KANTO; ax++) {
      const bocas = peekBocasDaArea(ax, ay);
      if (!bocas?.length) continue;
      for (let i = 0; i < bocas.length; i++) {
        const b = bocas[i];
        lista.push({
          tipo: "caverna",
          id: b.id,
          nome: b.nome || "Caverna",
          x: b.stand?.x ?? b.x,
          y: b.stand?.y ?? b.y,
          z: b.stand?.z ?? b.z,
        });
      }
    }
  }
  return lista;
}
