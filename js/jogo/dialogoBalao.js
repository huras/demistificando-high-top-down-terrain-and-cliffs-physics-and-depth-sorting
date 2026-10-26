/**
 * Balão de diálogo HQ ancorado na cabeça do falante (paridade visual Pokemon AI speechBubble).
 * Conteúdo só re-renderiza quando a assinatura muda; posição a cada frame.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../config.js";
import { estaEm3d } from "../modoJogo.js";
import { obterCenario3d } from "../render/3d/cenario3d.js";
import { estado } from "./estado.js";

const _ancora = new THREE.Vector3();
const PAD = 12;
const CABECA_Z = 2.55;

/** @type {HTMLElement|null} */
let raiz = null;
/** @type {string} */
let sigConteudo = "";
let abertoAntes = false;

function escHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&amp;";
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === '"') return "&quot;";
    return "&#39;";
  });
}

function garantirDom() {
  if (raiz) return raiz;
  raiz = document.getElementById("jogo-dialogo");
  if (!raiz) return null;
  raiz.classList.add("dialogo-balao");
  raiz.classList.remove("jogo-dialogo");
  if (!raiz.querySelector(".dialogo-balao__caixa")) {
    raiz.innerHTML = `
      <div class="dialogo-balao__caixa">
        <p class="dialogo-balao__nome" data-dlg-nome></p>
        <p class="dialogo-balao__texto" data-dlg-texto></p>
        <div class="dialogo-balao__acoes" data-dlg-acoes></div>
      </div>
      <span class="dialogo-balao__junta" aria-hidden="true"></span>
      <svg class="dialogo-balao__cauda" viewBox="0 0 18 14" width="18" height="14" aria-hidden="true">
        <polygon points="1,1 17,1 9,13" />
      </svg>
    `;
  }
  return raiz;
}

function ancoraDoDialogo(dlg) {
  const ref = dlg?.npcRef;
  if (ref && Number.isFinite(ref.x) && Number.isFinite(ref.y)) {
    return {
      x: ref.x,
      y: ref.y,
      z: Number.isFinite(ref.z) ? ref.z : 0,
    };
  }
  const a = dlg?.ancora;
  if (a && Number.isFinite(a.x) && Number.isFinite(a.y)) {
    return { x: a.x, y: a.y, z: Number.isFinite(a.z) ? a.z : 0 };
  }
  return null;
}

function projetarCabeca(ancora, canvas) {
  const cRect = canvas.getBoundingClientRect();
  let x = cRect.width * 0.5;
  let y = cRect.height * 0.4;
  let ok = false;
  if (estaEm3d()) {
    const cam = obterCenario3d()?.camera3d?.cam;
    if (cam) {
      _ancora.set(
        ancora.x,
        (ancora.z || 0) * ALTURA_BLOCO + CABECA_Z,
        ancora.y,
      );
      _ancora.project(cam);
      if (_ancora.z >= -1 && _ancora.z <= 1) {
        x = (_ancora.x * 0.5 + 0.5) * cRect.width;
        y = (-_ancora.y * 0.5 + 0.5) * cRect.height;
        ok = true;
      }
    }
  } else {
    ok = true;
  }
  return { x, y, cRect, ok };
}

function assinatura(dlg) {
  const i = dlg.i | 0;
  const linha = dlg.linhas?.[i] || "";
  const escolhas =
    dlg.escolhas && i >= (dlg.linhas?.length || 0) - 1
      ? dlg.escolhas.map((e) => e.id).join(",")
      : "seguir";
  return `${dlg.nome || ""}|${i}|${linha}|${escolhas}|${dlg.retrato || ""}`;
}

function pintarConteudo(host, dlg) {
  const nomeEl = host.querySelector("[data-dlg-nome]");
  const textoEl = host.querySelector("[data-dlg-texto]");
  const acoesEl = host.querySelector("[data-dlg-acoes]");
  if (!nomeEl || !textoEl || !acoesEl) return;

  const i = dlg.i | 0;
  const linha = dlg.linhas?.[i] || "";
  nomeEl.textContent = dlg.nome || "";
  textoEl.textContent = linha;

  const naUltima = i >= (dlg.linhas?.length || 1) - 1;
  let html = "";
  if (dlg.escolhas && naUltima) {
    html = dlg.escolhas
      .map(
        (e) =>
          `<button type="button" data-act="escolha" data-id="${escHtml(e.id)}">${escHtml(e.rotulo)}</button>`,
      )
      .join("");
  } else {
    html = `<button type="button" data-act="seguir">Continuar</button>`;
  }
  acoesEl.innerHTML = html;
}

function colocar(host, tipX, tipY, cRect, hRect) {
  const bw = host.offsetWidth || 200;
  const bh = host.offsetHeight || 80;
  // Ponta da cauda = cabeça; caixa fica acima
  let left = tipX;
  let top = tipY;
  const minX = PAD + bw * 0.5;
  const maxX = cRect.width - PAD - bw * 0.5;
  const minY = PAD + bh + 16;
  const maxY = cRect.height - PAD;
  left = Math.max(minX, Math.min(maxX, left));
  top = Math.max(minY, Math.min(maxY, top));

  // Cauda aponta pro tip real (mesmo com clamp)
  const localTipX = tipX - (left - bw * 0.5);
  const tailPct = Math.max(12, Math.min(88, (localTipX / bw) * 100));
  host.style.setProperty("--tail-x", `${tailPct}%`);

  host.style.left = `${cRect.left - hRect.left + left}px`;
  host.style.top = `${cRect.top - hRect.top + top}px`;
}

/** Atualiza conteúdo + posição. Chamar em pintar e em tick leve. */
export function sincronizarDialogoBalao() {
  const host = garantirDom();
  if (!host) return;

  const dlg = estado.dialogo;
  const aberto = !!dlg;
  document.body.classList.toggle("is-dialogo-open", aberto);

  if (!aberto) {
    if (!host.hidden) {
      host.hidden = true;
      host.classList.remove("is-aberto");
      sigConteudo = "";
      abertoAntes = false;
    }
    return;
  }

  const sig = assinatura(dlg);
  if (sig !== sigConteudo) {
    pintarConteudo(host, dlg);
    sigConteudo = sig;
  }

  const acabouDeAbrir = !abertoAntes;
  host.hidden = false;
  if (acabouDeAbrir) {
    host.classList.remove("is-aberto");
    void host.offsetWidth;
    host.classList.add("is-aberto");
  }
  abertoAntes = true;

  const ancora = ancoraDoDialogo(dlg);
  const canvas = document.getElementById(estaEm3d() ? "canvas-3d" : "canvas");
  const hud = host.offsetParent || host.parentElement;
  if (!canvas || !hud || !ancora) return;

  const { x, y, cRect } = projetarCabeca(ancora, canvas);
  const hRect = hud.getBoundingClientRect();
  colocar(host, x, y, cRect, hRect);
}

/** Snapshot de âncora mundo a partir de um falante. */
export function ancoraDeFalante(falante) {
  if (!falante) return null;
  if (Number.isFinite(falante.x) && Number.isFinite(falante.y)) {
    return {
      x: falante.x,
      y: falante.y,
      z: Number.isFinite(falante.z) ? falante.z : 0,
    };
  }
  return null;
}
