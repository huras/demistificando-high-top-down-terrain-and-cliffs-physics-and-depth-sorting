/** API pública do sistema de construção / base do jogador. */

export {
  TIPO_CONSTRUIR,
  SUB_CASA,
  SUB_CASA_ORDEM,
  SUB_MOVEL,
  SUB_MOVEL_ORDEM,
  pegadaCasa,
  receitaConstruir,
  listarCasasConstruiveis,
  listarMoveisConstruiveis,
  listarCercasConstruiveis,
  listarSubcasas,
  listarSubmoveis,
  podePagar,
  gastarCusto,
  reembolsarCusto,
  custosDoRecipe,
} from "./catalogo.js";

export {
  claimRect,
  temClaim,
  pontoNoClaim,
  footprintNoClaim,
  tamanhoClaim,
  definirTamanhoClaim,
  rectClaimNaMira,
  previewBandeira,
  plantarBandeira,
  versaoBaseJogador,
  serializarBase,
  hidratarBase,
} from "./base.js";

export {
  listarCasas,
  listarMoveisOutdoor,
  listarCercas,
  casasPerto,
  acharCasa,
  colocarCasa,
  demolirCasa,
  colocarMovelOutdoor,
  demolirMovelOutdoor,
  colocarCerca,
  removerCerca,
  cercaEm,
  propsColisaoCasas,
  syncInteriorMoveis,
  interiorDaCasa,
  versaoEstruturasJogador,
  proximoIdCasa,
  criarRegistroCasa,
} from "./estruturas.js";

export {
  validarCasa,
  validarMovelOutdoor,
  validarCerca,
  obterPreview,
  colocarSelecionado,
  mensagemFalha,
} from "./colocacao.js";

export {
  buildMode,
  selecionarConstruir,
  limparSelecaoConstruir,
  abrirCatalogoConstruir,
  toggleCatalogoConstruir,
  temSelecaoConstruir,
} from "./modo.js";

export {
  siteConstrucao,
  temRitualAtivo,
  iniciarRitual,
  acertarRitual,
  cancelarRitual,
  tickRitual,
} from "./ritual.js";

export {
  serializarConstrucao,
  hidratarConstrucao,
  resetConstrucao,
} from "./estadoConstrucao.js";

export { marcasBaseJogador, invalidarMarcasBase } from "./mapaMarcas.js";

export {
  contarStockMovel,
  contarStockCasa,
  listarStockMovel,
  listarStockCasa,
} from "./stock.js";

export { alvoDemolirPerto, acertarDemolicao } from "./demolir.js";

export { tileOcupado, pontoOcupado } from "./ocupacao.js";

export {
  ordenarRitualConstrucao,
  tickOrdemConstrucao,
  indiceCompanheiroConstrutor,
} from "./ordemRitual.js";

export * from "./cerca/index.js";
