/** Poké Mart na cena 3D. */
import { plantaLoja } from "../../mundo/cidade/loja.js";
import { montarHub3d } from "./hubInterior3d.js";

export function montarLoja3d(grupo) {
  return montarHub3d(grupo, plantaLoja(), null);
}
