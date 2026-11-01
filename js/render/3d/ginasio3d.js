/** Ginásio na cena 3D. */
import { plantaGinasio } from "../../mundo/cidade/ginasio.js";
import { montarHub3d } from "./hubInterior3d.js";

export function montarGinasio3d(grupo) {
  return montarHub3d(grupo, plantaGinasio(), null);
}
