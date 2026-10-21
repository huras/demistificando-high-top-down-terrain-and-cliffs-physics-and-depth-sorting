/** Barra bottom-center: golpes Z/X/C/V + PP do mon em campo. */

import { pokemonDeployado, pokemonNoCampo } from "../../pokemon/party.js";
import { ppDe, ppMaxDe } from "../../pokemon/pp.js";
import { COR_TIPO } from "../../pokemon/tipos.js";
import { definirEscudoTipo, garantirAtlasTipo } from "../tipoEscudo.js";
import { preencherIconeGolpe } from "../iconesGolpe.js";

const TECLAS = Object.freeze(["Z", "X", "C", "V"]);

let root = null;
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

export function montarMovesCampo(host) {
  root = host || document.getElementById("party-moves-combat");
  if (!root) return { sync() {} };
  garantirAtlasTipo();
  if (!root.querySelector(".party-moves-combat__inner")) {
    root.innerHTML = `<div class="party-moves-combat__inner">
      <div class="party-moves-combat__slots" data-moves-slots></div>
      <div class="party-moves-combat__pp">
        <div class="party-moves-combat__pp-bar"><i data-moves-pp></i></div>
        <span class="party-moves-combat__pp-num" data-moves-pp-num></span>
      </div>
    </div>`;
  }
  return { sync: pintarMovesCampo };
}

export function pintarMovesCampo() {
  if (!root) return;
  const ator = pokemonDeployado() || pokemonNoCampo();
  if (!ator || ator.capturado) {
    root.hidden = true;
    assinatura = "empty";
    return;
  }

  const golpes = (ator.golpes || []).slice(0, 4);
  const tipos = ator.ppTipos || [];
  const tipoPp = tipos[0] || golpes[0]?.def?.tipo || "normal";
  const pp = Math.round(ppDe(ator, tipoPp));
  const ppMax = ppMaxDe(ator);
  const sig = `${ator.id}:${golpes.map((g) => g?.def?.key || "").join(",")}:${pp}/${ppMax}`;
  const pct = ppMax > 0 ? Math.round((pp / ppMax) * 100) : 0;

  if (sig !== assinatura) {
    assinatura = sig;
    root.hidden = false;
    const slots = root.querySelector("[data-moves-slots]");
    if (slots) {
      slots.innerHTML = TECLAS.map((tecla, i) => {
        const g = golpes[i];
        const def = g?.def || g;
        if (!def) {
          return `<button type="button" class="skill-chip is-empty" disabled data-move-slot="${i}">
            <kbd class="skill-chip__key">${tecla}</kbd>
            <span class="skill-chip__type" aria-hidden="true"></span>
            <span class="skill-chip__kind">—</span>
          </button>`;
        }
        const nome = def.nome || def.name || def.key || "?";
        const tipo = def.tipo || def.type || "normal";
        const key = def.key || "";
        const cor = COR_TIPO[tipo] || "#9ca3af";
        return `<button type="button" class="skill-chip is-ready" data-move-slot="${i}" data-move-key="${escHtml(key)}" data-move-tipo="${escHtml(tipo)}" title="${escHtml(nome)}" style="--chip-tipo:${cor}">
          <kbd class="skill-chip__key">${tecla}</kbd>
          <span class="skill-chip__art" data-skill-art hidden></span>
          <span class="skill-chip__type" data-skill-type aria-hidden="true"></span>
          <span class="skill-chip__kind">${escHtml(nome)}</span>
        </button>`;
      }).join("");

      const chips = slots.querySelectorAll(".skill-chip.is-ready");
      for (let i = 0; i < chips.length; i++) {
        const chip = chips[i];
        const tipo = chip.dataset.moveTipo || "normal";
        const key = chip.dataset.moveKey || "";
        const art = chip.querySelector("[data-skill-art]");
        const typeHost = chip.querySelector("[data-skill-type]");
        const temArt = preencherIconeGolpe(art, key, tipo);
        chip.classList.toggle("has-skill-art", temArt);
        if (typeHost) {
          definirEscudoTipo(typeHost, tipo, temArt ? 16 : 28);
        }
      }
    }
  }

  const bar = root.querySelector("[data-moves-pp]");
  const num = root.querySelector("[data-moves-pp-num]");
  if (bar) bar.style.width = `${pct}%`;
  if (num) num.textContent = `PP ${pp}/${ppMax}`;
  root.hidden = false;
}
