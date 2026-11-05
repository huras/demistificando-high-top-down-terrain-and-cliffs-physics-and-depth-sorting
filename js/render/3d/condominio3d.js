/** Condomínios de Celadon na cena 3D (um hub por andar). */
import { plantasCondominio } from "../../mundo/cidade/condominio.js";
import { montarHub3d } from "./hubInterior3d.js";

export function montarCondominio3d(grupo) {
  const plantas = plantasCondominio();
  const promessas = [];
  for (let i = 0; i < plantas.length; i++) {
    promessas.push(montarHub3d(grupo, plantas[i], null));
  }
  return Promise.all(promessas);
}
