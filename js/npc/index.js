export {
  carregarCatalogoNpc,
  catalogoPronto,
  FOLHA_PLATINUM,
  pessoaPorId,
  resolverNpc,
  sortearParty,
} from "./catalogo/index.js";

export {
  iniciarNpc,
  npcsProntos,
  tickNpc,
  listarNpcsVisiveis,
  listarSolidosNpc,
  listarCivisCidade,
  listarViajantes,
  listarCivisCasa,
  aoEntrarCasa,
  aoSairInterior,
  npcPertoDe,
  falarComNpc,
} from "./runtime.js";

export { ligarNpc3d, sincronizarNpc3d, limparNpc3d } from "./render/npc3d.js";
export { npcPerfAtivo, npcPerfSnapshot, npcPerfReset } from "./perf.js";
