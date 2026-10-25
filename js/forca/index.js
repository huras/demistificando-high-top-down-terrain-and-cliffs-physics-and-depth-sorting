/**
 * Força — carregar / arremessar pedras, cristais e Pokémon.
 */
export {
  carregarOverridesForca,
  forcaDoCarrier,
  forcaHumana,
  forcaPorDex,
  forcaPorEspecie,
  FORCA_HUMANO,
  FORCA_MAX,
  FORCA_MIN,
} from "./forcaEspecie.js";
export { pesoDoProp, pesoDoCorpo, normalizarPeso, PESO_MAX, PESO_MIN } from "./pesoCarga.js";
export { podeLevantar, ehFalhaGrab, deltaTelaFalha, mundoOcultoForca } from "./falhaLevantar.js";
export {
  ehPropLevantavel,
  ehPokemonLevantavel,
  ehDesmaiadoLevantavel,
  acharAlvoForca,
  propSobMira,
  pokemonSobMira,
  pesoDoPokemon,
} from "./alvos.js";
export {
  ACAO_FORCA,
  ALCANCE_COMANDO,
  ALCANCE_GRAB,
  ALCANCE_PLACE,
  ALCANCE_THROW,
  RAIO_MIRA,
  companionsDeployados,
  montarOpcoesMenuForca,
  escolherCompanheiroOrdem,
} from "./ordemCompanheiro.js";
export {
  configurarForca,
  obterCfgForca,
  estadoForca,
  estaCarregandoForca,
  estaNoCanalForca,
  obterCarry,
  obterCarryOwner,
  obterOrderCarrier,
  obterGrabAction,
  obterGrabActor,
  obterThrown,
  cargaArremesso,
  mirandoArremesso,
  infoPromptForca,
  tentarInteragir,
  atualizarCanal,
  iniciarGrabOrdenado,
  executarSoltarOrdenado,
  executarArremessoOrdenado,
  forcarSoltarPerto,
  consumirFalhaLift,
  consumirStruggleBreak,
  resetarForca,
  snapshotSistemaForca,
  mulVelDe,
  mobilidadeDe,
  definirOrderCarrier,
  limparOrderCarrier,
  carrierAtivo,
} from "./sistemaForca.js";
export {
  amostrarArcoArremesso,
  resolverMiraArremesso,
  alcanceMaxArremesso,
  FORCA_CARGA_MS,
} from "./arremessar.js";
export { deltaTelaStruggle, ehAgroForca, ehVivoLevantavel } from "./agarrarVivo.js";
export { ordenarForca, tickOrdensForca } from "./tickOrdensForca.js";
export { atualizarVisualForca } from "./visualForca.js";
export {
  iniciarForca,
  tickForca,
  promptForca,
  definirPonteiroForca,
  prepararCarrierJogador,
} from "./tickForca.js";
