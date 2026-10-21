/** Painel de status do treinador (utility → status). */

import { obterTreinador } from "../../pokemon/sistema.js";
import { estado } from "../estado.js";
import { progressoDex } from "../pokedex/progresso.js";
import { listaParty } from "../../pokemon/party.js";

let root = null;
let aberto = false;

export function montarStatusJogador(host) {
  root = host;
  if (!root) {
    return { open() {}, close() {}, toggle() {}, isOpen: () => false, sync() {} };
  }
  if (!root.querySelector(".player-status")) {
    root.innerHTML = `<div class="player-status" role="dialog" aria-label="Status do treinador">
      <header class="player-status__head">
        <b>Status</b>
        <button type="button" class="player-status__close" data-status-close aria-label="Fechar">×</button>
      </header>
      <div class="player-status__body" data-status-body></div>
    </div>`;
  }
  root.querySelector("[data-status-close]")?.addEventListener("click", fechar);
  root.hidden = true;
  return {
    open: abrir,
    close: fechar,
    toggle: () => (aberto ? fechar() : abrir()),
    isOpen: () => aberto,
    sync: pintar,
  };
}

function abrir() {
  aberto = true;
  if (root) {
    root.hidden = false;
    requestAnimationFrame(() => root.classList.add("is-open"));
  }
  pintar();
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

// aliases

function pintar() {
  if (!root || !aberto) return;
  const body = root.querySelector("[data-status-body]");
  if (!body) return;
  const tre = obterTreinador();
  const hp = Math.round(tre?.hp ?? tre?.hpMax ?? 12);
  const max = Math.round(tre?.hpMax || tre?.maxHp || 12);
  const stam = tre?.stamina != null ? Math.round(tre.stamina) : "—";
  const dex = progressoDex();
  const party = listaParty().length;
  body.innerHTML = `
    <dl class="player-status__facts">
      <div><dt>Vida</dt><dd>${hp}/${max}</dd></div>
      <div><dt>Stamina</dt><dd>${stam}</dd></div>
      <div><dt>Dinheiro</dt><dd>₽ ${estado.dinheiro}</dd></div>
      <div><dt>Time</dt><dd>${party}</dd></div>
      <div><dt>Pokédex</dt><dd>${dex.caught}/${dex.total} capt. · ${dex.seenOnly} vistos</dd></div>
    </dl>`;
}
