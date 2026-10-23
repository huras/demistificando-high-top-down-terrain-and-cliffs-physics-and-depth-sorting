/**
 * HUD da bússola de santuário (device).
 */
import {
  closestShrineBearing,
  formatShrineDistanceMeters,
  shrineCompassRotationDeg,
} from "./bussola.js";

let raiz = null;

function garantirDom() {
  if (raiz) return raiz;
  raiz = document.getElementById("shrine-compass");
  if (raiz) return raiz;
  raiz = document.createElement("div");
  raiz.id = "shrine-compass";
  raiz.className = "shrine-compass";
  raiz.hidden = true;
  raiz.innerHTML = `
    <div class="shrine-compass__seta" data-seta></div>
    <span class="shrine-compass__dist" data-dist></span>
  `;
  const host = document.getElementById("jogo-hud") || document.body;
  host.appendChild(raiz);
  return raiz;
}

/**
 * @param {{ x: number, y: number } | null} corpo
 * @param {boolean} interior
 */
export function atualizarBussolaSantuario(corpo, interior) {
  const el = garantirDom();
  const bearing = corpo ? closestShrineBearing(corpo, interior) : null;
  if (!bearing) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const seta = el.querySelector("[data-seta]");
  const dist = el.querySelector("[data-dist]");
  if (seta) {
    seta.style.transform = `rotate(${shrineCompassRotationDeg(bearing.angle)}deg)`;
    seta.style.background = bearing.color || "#e2e8f0";
  }
  if (dist) dist.textContent = formatShrineDistanceMeters(bearing.dist);
}
