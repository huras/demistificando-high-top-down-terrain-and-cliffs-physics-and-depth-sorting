/** Barra de golpes da simbiose. Montada uma vez; some fora da fusão. */
import { CD_GOLPE_S } from "../../pokemon/combate/executor.js";
import { COR_TIPO } from "../../pokemon/tipos.js";
import { t } from "../i18n.js";
import { dispararTeclaSimbiose, estaEmSimbiose, monSimbiose } from "../simbiose.js";

const TECLAS = Object.freeze(["Z", "X", "C", "V"]);
const PASSO_MS = 120;

let root = null;
let ultimo = 0;
let assinatura = "";

function escHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&amp;";
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === '"') return "&quot;";
    return "&#39;";
  });
}

function nomeDe(ator) {
  return ator?.especie?.nome || ator?.especie?.name || ator?.especie?.key || "Pokémon";
}

export function montarSimbioseHud(host) {
  root = host || document.getElementById("symbiosis-hud");
  if (!root) return { sync() {} };
  root.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-simbiose-slot]");
    if (!btn || btn.disabled) return;
    dispararTeclaSimbiose(Number(btn.dataset.simbioseSlot));
  });
  return { sync: pintarSimbioseHud };
}

export function pintarSimbioseHud(agoraMs = performance.now()) {
  if (!root) return;
  if (!estaEmSimbiose()) {
    if (!root.hidden) root.hidden = true;
    assinatura = "";
    return;
  }
  if (agoraMs - ultimo < PASSO_MS && assinatura) {
    atualizarCd();
    return;
  }
  ultimo = agoraMs;
  const ator = monSimbiose();
  if (!ator) {
    root.hidden = true;
    return;
  }
  const golpes = ator.golpes || [];
  const tipos = (ator.tipos || []).join(",");
  const sig = `${ator.id}:${golpes.map((g) => g?.def?.key || "").join(",")}:${tipos}:${nomeDe(ator)}`;
  if (sig !== assinatura) {
    assinatura = sig;
    const tipoEls = (ator.tipos || [])
      .map((tipo) => {
        const cor = COR_TIPO[tipo] || "#9ca3af";
        return `<i class="symbiosis-hud__tipo" style="background:${cor}" title="${escHtml(tipo)}"></i>`;
      })
      .join("");
    const slots = TECLAS.map((tecla, i) => {
      const def = golpes[i]?.def;
      if (!def) {
        return `<button type="button" class="symbiosis-hud__slot is-empty" disabled>
          <kbd>${tecla}</kbd><span>—</span>
        </button>`;
      }
      const cor = COR_TIPO[def.tipo] || "#9ca3af";
      const nome = def.nome || def.name || def.key || "?";
      return `<button type="button" class="symbiosis-hud__slot" data-simbiose-slot="${i}" style="--chip-tipo:${cor}" title="${escHtml(nome)}">
        <kbd>${tecla}</kbd>
        <span>${escHtml(nome)}</span>
        <em data-simbiose-cd="${i}"></em>
      </button>`;
    }).join("");
    root.innerHTML = `<div class="symbiosis-hud__titulo"><small>${escHtml(t("simbiose.titulo"))}</small><b>${escHtml(nomeDe(ator))}</b><span class="symbiosis-hud__tipos">${tipoEls}</span></div><div class="symbiosis-hud__slots">${slots}</div>`;
  }
  root.hidden = false;
  atualizarCd();
}

function atualizarCd() {
  if (!root) return;
  const ator = monSimbiose();
  const golpes = ator?.golpes || [];
  const nos = root.querySelectorAll("[data-simbiose-cd]");
  for (let i = 0; i < nos.length; i++) {
    const slot = golpes[Number(nos[i].dataset.simbioseCd)];
    const cd = slot?.cd || 0;
    const ratio = CD_GOLPE_S > 0 ? Math.max(0, Math.min(1, cd / CD_GOLPE_S)) : 0;
    const btn = nos[i].parentElement;
    if (btn) {
      btn.style.setProperty("--cd", ratio.toFixed(3));
      btn.classList.toggle("is-ready", ratio <= 0.001);
    }
    nos[i].textContent = ratio <= 0.001 ? t("simbiose.pronto") : t("simbiose.recarregando");
  }
}
