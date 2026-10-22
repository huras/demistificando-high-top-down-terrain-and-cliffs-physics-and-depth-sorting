/**
 * Golpes no campo — deixa o executor escolher (moves + Investida).
 * O lunge controlado vive em meleeApproach via executor.
 */
import { tentarGolpe } from "../combate/executor.js";

export function tentarGolpesCampo(ator, agora, efeitos) {
  if (!ator?.alvo) return;
  tentarGolpe(ator, agora, efeitos);
}
