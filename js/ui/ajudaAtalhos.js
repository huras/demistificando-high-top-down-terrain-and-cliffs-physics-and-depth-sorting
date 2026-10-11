/**
 * Popover de atalhos no header (hover / focus / click + Escape).
 */
import { consumirTecla } from "../entrada/teclado.js";

export function ligarAjudaAtalhos() {
  const raiz = document.getElementById("ajuda-atalhos");
  const btn = document.getElementById("btn-ajuda-controles");
  const painel = document.getElementById("painel-ajuda-controles");
  if (!raiz || !btn || !painel) return;

  function abrir() {
    painel.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    raiz.classList.add("ajuda-atalhos--aberto");
  }

  function fechar() {
    painel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    raiz.classList.remove("ajuda-atalhos--aberto");
  }

  function estaAberto() {
    return !painel.hidden;
  }

  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (estaAberto()) fechar();
    else abrir();
  });

  btn.addEventListener("focus", abrir);

  raiz.addEventListener("mouseenter", abrir);
  raiz.addEventListener("mouseleave", () => {
    if (document.activeElement === btn) return;
    fechar();
  });

  btn.addEventListener("blur", () => {
    requestAnimationFrame(() => {
      if (raiz.contains(document.activeElement)) return;
      if (raiz.matches(":hover")) return;
      fechar();
    });
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && estaAberto()) {
      consumirTecla("Escape");
      fechar();
      btn.blur();
    }
  });

  document.addEventListener("pointerdown", (ev) => {
    if (!estaAberto()) return;
    if (raiz.contains(ev.target)) return;
    fechar();
  });
}
