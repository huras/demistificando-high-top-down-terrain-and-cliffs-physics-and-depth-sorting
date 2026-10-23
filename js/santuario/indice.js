/**
 * API pública do sistema de santuários elementais.
 */
export { getWorldShrinePlan, findShrineSlotForSpecies, findNearbyShrine } from "./colocacao.js";
export { santuarioPerto, promptSantuario, abrirPuzzleSantuario } from "./interagir.js";
export { tentarEntrarSantuario, checarSaidaSantuario, sairSantuario } from "./entrar.js";
export { reclamarTotem } from "./gemas.js";
export { closestShrineBearing } from "./bussola.js";
export {
  serializarSantuarios,
  hidratarSantuarios,
  invalidarMarcasSantuario,
} from "./estadoSantuario.js";
export { marcasSantuario } from "./mapaMarcas.js";
export { drawTypeShield, ensureTypeShieldsLoaded } from "./tipoEscudo.js";
export { desenharPinSantuario } from "./mapaPin.js";
