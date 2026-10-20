/** API pública do VFX de combate 3D (BattleParticles adaptado). */

export { elementoDe } from "./elementos.js";
export { emitirImpacto } from "./impacto.js";
export { emitirRastro } from "./rastro.js";
export { folhaDaReceita, receitaFx } from "./receitas.js";
export {
  desligarFxCena,
  dispararGolpeFx,
  impactoFx,
  limparFx,
  ligarFxCena,
  padroesAtivos,
  sincronizarFx,
  tickFx,
} from "./gerenciador.js";
