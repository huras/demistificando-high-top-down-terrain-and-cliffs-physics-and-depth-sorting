/**
 * Placeholder do skill loadout (paridade Pokemon AI).
 * Gated: só monta shell; skills completas entram depois com dados.
 */

let root = null;
let aberto = false;

export function montarSkillLoadout() {
  root = document.getElementById("skill-loadout-hud");
  if (!root) {
    root = document.createElement("div");
    root.id = "skill-loadout-hud";
    root.className = "skill-loadout-hud";
    root.hidden = true;
    root.innerHTML = `<div class="skill-loadout-hud__panel">
      <header><b>Skills</b>
        <button type="button" data-skill-close aria-label="Fechar">×</button>
      </header>
      <p class="skill-loadout-hud__nota">Loadout de habilidades do treinador — em integração com o sistema 3D.</p>
    </div>`;
    document.getElementById("jogo-hud")?.appendChild(root);
    root.querySelector("[data-skill-close]")?.addEventListener("click", fechar);
  }
  return {
    open: abrir,
    close: fechar,
    toggle: () => (aberto ? fechar() : abrir()),
    isOpen: () => aberto,
  };
}

function abrir() {
  aberto = true;
  if (root) {
    root.hidden = false;
    root.classList.add("is-open");
  }
  return true;
}

function fechar() {
  aberto = false;
  if (root) {
    root.classList.remove("is-open");
    root.hidden = true;
  }
  return true;
}
