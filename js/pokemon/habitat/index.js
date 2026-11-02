export { HABITAT, ehHabitatAquatico, ehHabitatTerrestre } from "./kinds.js";
export {
  FLAP_DENY_DEX,
  FLAP_DEXES,
  FLAP_ENTRIES,
  FLIGHT_POSE_DEXES,
  FLIGHT_POSE_ENTRIES,
  chaveTemFlapAround,
  chaveTemPoseVoo,
  dexTemFlapAround,
  dexTemPoseVoo,
  sortearFlapEntry,
  sortearPoseVooEntry,
} from "./flapCatalog.js";
export {
  ehAquatico,
  especieServeHabitat,
  kindDoLar,
  temFlapAround,
  temPoseVoo,
} from "./gates.js";
export { CADEIA_VOO, escolherAnimVoo, ehAnimVoo } from "./poseVoo.js";
export {
  PERFIL_CAMPO,
  PERFIL_NINHO_VOO,
  PERFIL_SUPERFICIE,
  PERFIL_UNDERSEA,
  perfilDoHabitat,
} from "./perfis.js";
export {
  PROF_UNDERSEA,
  infoTileHabitat,
  kindAguaDoTile,
  zDoLarAquatico,
} from "./tile.js";
export { tickPatrolVooLar } from "./patrolVoo.js";
export { tickPatrolAguaLar } from "./patrolAgua.js";
export {
  SKY_CFG,
  SKY_PASSER_KEYS,
  ehSkyPasser,
  limparSkyPassers,
  poolSkyDeChaves,
  skyPassersAtivos,
  sortearSkyPasser,
  tickSkyPassers,
} from "./skyPassers/index.js";
