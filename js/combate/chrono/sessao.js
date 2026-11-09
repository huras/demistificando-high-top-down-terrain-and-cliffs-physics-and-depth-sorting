/**
 * Chrono → BattleStage (compat re-exports).
 * A luta em turno wild agora roda no sandbox 3D isolado.
 */
export {
  abrirSessaoChrono,
  combateChronoSeguraEntrada,
  encerrarSessaoChrono,
  ligarHooksChrono,
  obterSessaoChrono,
  sessaoChronoAtiva,
  tickSessaoChrono,
  stageAtivo,
  kindStage,
  entrarStage,
  sairStage,
  tickStage,
  sessaoStageAtiva,
  obterSessaoStage,
} from "../stage/sessao.js";
