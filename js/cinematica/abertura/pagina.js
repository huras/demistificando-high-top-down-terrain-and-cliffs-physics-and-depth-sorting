import {
  avancarAbertura,
  desenharAbertura,
  ligarAbertura,
} from "./cena.js";

const canvas = document.getElementById("vista");
const statusEl = document.getElementById("status");

let ultimo = 0;
let ligado = false;

function quadro(agora) {
  if (!ligado) return;
  const dt = ultimo ? Math.min(0.05, (agora - ultimo) / 1000) : 0.016;
  ultimo = agora;
  avancarAbertura(dt);
  desenharAbertura();
  requestAnimationFrame(quadro);
}

async function iniciar() {
  if (!canvas) {
    if (statusEl) statusEl.textContent = "Canvas ausente";
    return;
  }
  try {
    await ligarAbertura(canvas);
    ligado = true;
    if (statusEl) {
      statusEl.textContent = "Pronto";
      statusEl.classList.add("status--ok");
    }
    requestAnimationFrame(quadro);
  } catch (erro) {
    console.error(erro);
    if (statusEl) statusEl.textContent = "Falha ao carregar a abertura";
  }
}

iniciar();
