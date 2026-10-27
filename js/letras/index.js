export {
  LETTER_ORDER,
  LETRA_SPRITE,
  gradeDaLetra,
  letraPuzzleId,
  letraQuota,
} from "./catalogo.js";
export {
  getWorldLetterPuzzlePlan,
  limparCacheLetras,
  letrasNoChunk,
  slotLetraPorId,
} from "./plano.js";
export {
  propsLetrasChunk,
  celulasLetrasChunk,
  layoutDoSlot,
} from "./colocacao.js";
export {
  ehPedraLetra,
  ehPedraLetraSolta,
  tentarEncaixarPedraLetra,
} from "./runtime.js";
export {
  letraResolvida,
  marcarLetraResolvida,
  revelarLetras,
  letrasReveladasAtivas,
  versaoMapaLetras,
} from "./estado.js";
export {
  marcasLetras,
  invalidarMarcasLetras,
  geracaoMarcasLetras,
} from "./mapaMarcas.js";
export {
  celulasPlazaLetrasChunk,
  celulasSitioLetrasChunk,
  retanguloGlifoLetra,
  retanguloSitioLetra,
  ehPlazaLetra,
  ehSitioLetra,
} from "./plaza.js";
export { arcosLetrasAtivos } from "./arcos.js";
export {
  alturaComPlanoLetra,
  ehNucleoPlanoLetra,
  temPlanoLetra,
} from "./relevo.js";
