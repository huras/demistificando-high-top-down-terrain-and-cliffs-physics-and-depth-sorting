/** Mansão na cena 3D. */
import { plantaMansao } from "../../mundo/cidade/mansao.js";
import { montarHub3d } from "./hubInterior3d.js";

export function montarMansao3d(grupo) {
  return montarHub3d(grupo, plantaMansao(), null);
}
