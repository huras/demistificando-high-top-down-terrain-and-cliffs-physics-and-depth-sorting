/** Runtime de história: opening + warehouses Rocket. */

export { OPENING_STAGE, ROCKET_CLEANUP, VIRIDIAN_ROCKET, criarHistoriaState } from "./flags.js";
export {
  serializarHistoria,
  hidratarHistoria,
  garantirHistoria,
  historiaPodeSalvar,
  registrarEstadoHistoria,
} from "./persistencia.js";
export { aplicarCameraEvento, cameraEventoAtiva, ligarCameraEvento, beginCamTween } from "./cameraEvento.js";
export { historiaTravaMovimento, historiaTravaOlhar, historiaEscondeHud } from "./travas.js";
export { listarAtoresScriptados, atorScriptadoPerto } from "./atoresScriptados.js";
export {
  bootHistoria,
  tickHistoria,
  interagirHistoria,
  promptHistoria,
  historiaBloqueiaMovimento,
} from "./tick.js";
export {
  openingAtiva,
  openingStage,
  mesaIniciaisLiberada,
  podeEscolherFinal,
  podeEscolherTrial,
  falarOakLab,
  entregarParcelaViridian,
  concluirFinalStarter,
  escolherTrial,
} from "./opening/flow.js";
export { onGiovanniGymCleared } from "./warehouses/overhear.js";
export { listarWarehousesMundo, warehousePerto } from "./warehouses/placement.js";
export { tentarEntrarArmazem, sairArmazem } from "./warehouses/entrar.js";
