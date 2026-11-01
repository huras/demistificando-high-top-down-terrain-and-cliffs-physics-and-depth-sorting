/**
 * Sidebar: alterna combate realtime ↔ Chrono / Paper Mario.
 */
import {
  definirModoCombateCampo,
  modoCombateCampo,
} from "../combate/chrono/modo.js";
import { encerrarSessaoChrono, sessaoChronoAtiva } from "../combate/chrono/sessao.js";
import { selvagensAtivos } from "../pokemon/populacao.js";

function limparAgroCampo() {
  const lista = selvagensAtivos();
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    if (!a || a._chronoHold) continue;
    if (a.modo === "agro") a.modo = "roam";
    a.alvo = null;
    a.agroPersistente = false;
  }
}

export function ligarPainelCombate() {
  const sel = document.getElementById("combate-modo");
  if (!sel) return;

  sel.value = modoCombateCampo();
  sel.addEventListener("change", () => {
    const proximo = sel.value === "chrono" ? "chrono" : "realtime";
    if (sessaoChronoAtiva()) {
      encerrarSessaoChrono("troca");
    }
    definirModoCombateCampo(proximo);
    if (proximo === "chrono") limparAgroCampo();
    sel.value = modoCombateCampo();
  });
}

export function sincronizarPainelCombate() {
  const sel = document.getElementById("combate-modo");
  if (sel) sel.value = modoCombateCampo();
}
