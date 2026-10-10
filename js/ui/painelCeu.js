import {
  definirCiclo,
  definirClima,
  definirHora,
  obterControleCeu,
  textoHora,
} from "../render/3d/ceu/controleCeu.js";

let arrastandoHora = false;

export function ligarPainelCeu() {
  const hora = document.getElementById("ceu-hora");
  const valor = document.getElementById("ceu-hora-valor");
  const clima = document.getElementById("ceu-clima");
  const ciclo = document.getElementById("ceu-ciclo");
  if (!hora || !clima || !ciclo) return;

  hora.addEventListener("pointerdown", () => {
    arrastandoHora = true;
  });
  window.addEventListener("pointerup", () => {
    arrastandoHora = false;
  });
  hora.addEventListener("input", () => {
    definirHora(Number(hora.value));
    if (valor) valor.textContent = textoHora();
  });
  clima.addEventListener("change", () => {
    definirClima(clima.value);
  });
  ciclo.addEventListener("change", () => {
    definirCiclo(ciclo.checked);
  });

  sincronizarPainelCeu();
}

export function sincronizarPainelCeu() {
  const hora = document.getElementById("ceu-hora");
  const valor = document.getElementById("ceu-hora-valor");
  const clima = document.getElementById("ceu-clima");
  const ciclo = document.getElementById("ceu-ciclo");
  const estado = obterControleCeu();
  if (hora && !arrastandoHora && document.activeElement !== hora) {
    hora.value = estado.hora.toFixed(2);
  }
  if (valor) valor.textContent = textoHora(estado.hora);
  if (clima && clima.value !== estado.clima) clima.value = estado.clima;
  if (ciclo) ciclo.checked = estado.ciclo;
}
