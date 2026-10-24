/**
 * Entrada do boot: splash imediato, depois carrega o grafo de módulos.
 */
import {
  montarTelaCarregamento,
  marcarFase,
  definirStatus,
  falharCarregamento,
} from "./carregamento.js";

montarTelaCarregamento();
definirStatus(
  "Carregando módulos do jogo…",
  "Na 1ª abertura após reiniciar o PC, disco e shaders da GPU demoram mais.",
);
marcarFase("modulos", 0.04);

// Creep visual enquanto o grafo ES modules baixa/parseia (sem progresso nativo).
let creep = 0.04;
const creepTimer = setInterval(() => {
  creep = Math.min(0.82, creep + 0.018);
  marcarFase("modulos", creep);
}, 180);

try {
  const { iniciar } = await import("../principal.js");
  clearInterval(creepTimer);
  marcarFase("modulos", 1);
  await iniciar();
} catch (erro) {
  clearInterval(creepTimer);
  console.error(erro);
  falharCarregamento(erro);
}
