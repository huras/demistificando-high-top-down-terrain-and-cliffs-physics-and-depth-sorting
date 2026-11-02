export {
  FENCE_KIND,
  FENCE_CATALOG_ID,
  FENCE_MAX_STROKE,
  FENCE_MAX_PER_AREA,
  fenceKindFromCatalogId,
  receitaCercaPorId,
  receitaCercaPorKind,
  agregarReceitaCerca,
  tileKey,
  parseTileKey,
} from "./tipos.js";

export { roleCerca, mapaRolesArea, invalidarMapasCerca } from "./autotile.js";

export {
  iniciarStrokeCerca,
  limparStrokeCerca,
  cellsStrokeCerca,
  adicionarCellStroke,
  confirmarStrokeCerca,
  cancelarStrokeCerca,
} from "./pintar.js";

export { cercaSolidaEm, avaliarVault } from "./vault.js";
