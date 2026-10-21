import {
  definirCiclo,
  definirClima,
  definirHora,
  definirInclinacaoSol,
  definirRotacaoSol,
  INCLINACAO_SOL_MAX,
  INCLINACAO_SOL_MIN,
  obterControleCeu,
  ROTACAO_SOL_MAX,
  ROTACAO_SOL_MIN,
  textoHora,
} from "../render/3d/ceu/controleCeu.js";
import { forcarClimaPreset } from "../clima/amostra.js";

let arrastandoHora = false;
let arrastandoInclinacao = false;
let arrastandoRotacao = false;

export function ligarPainelCeu() {
  const hora = document.getElementById("ceu-hora");
  const valor = document.getElementById("ceu-hora-valor");
  const inclinacao = document.getElementById("ceu-inclinacao");
  const rotacao = document.getElementById("ceu-rotacao");
  const clima = document.getElementById("ceu-clima");
  const ciclo = document.getElementById("ceu-ciclo");
  if (!hora || !inclinacao || !rotacao || !clima || !ciclo) return;

  hora.addEventListener("pointerdown", () => {
    arrastandoHora = true;
  });
  inclinacao.addEventListener("pointerdown", () => {
    arrastandoInclinacao = true;
  });
  rotacao.addEventListener("pointerdown", () => {
    arrastandoRotacao = true;
  });
  window.addEventListener("pointerup", () => {
    arrastandoHora = false;
    arrastandoInclinacao = false;
    arrastandoRotacao = false;
  });
  hora.addEventListener("input", () => {
    definirHora(Number(hora.value));
    if (valor) valor.textContent = textoHora();
  });
  inclinacao.addEventListener("input", () => {
    const graus = definirInclinacaoSol(Number(inclinacao.value));
    escreverGraus("ceu-inclinacao-valor", graus);
  });
  rotacao.addEventListener("input", () => {
    const graus = definirRotacaoSol(Number(rotacao.value));
    escreverGraus("ceu-rotacao-valor", graus);
  });
  clima.addEventListener("change", () => {
    definirClima(clima.value);
    forcarClimaPreset(clima.value);
  });
  ciclo.addEventListener("change", () => {
    definirCiclo(ciclo.checked);
  });

  sincronizarPainelCeu();
}

export function sincronizarPainelCeu() {
  const hora = document.getElementById("ceu-hora");
  const valor = document.getElementById("ceu-hora-valor");
  const inclinacao = document.getElementById("ceu-inclinacao");
  const rotacao = document.getElementById("ceu-rotacao");
  const clima = document.getElementById("ceu-clima");
  const ciclo = document.getElementById("ceu-ciclo");
  const estado = obterControleCeu();
  if (hora && !arrastandoHora && document.activeElement !== hora) {
    hora.value = estado.hora.toFixed(2);
  }
  if (valor) valor.textContent = textoHora(estado.hora);
  if (inclinacao && !arrastandoInclinacao && document.activeElement !== inclinacao) {
    inclinacao.min = String(INCLINACAO_SOL_MIN);
    inclinacao.max = String(INCLINACAO_SOL_MAX);
    inclinacao.value = String(estado.inclinacao);
    escreverGraus("ceu-inclinacao-valor", estado.inclinacao);
  }
  if (rotacao && !arrastandoRotacao && document.activeElement !== rotacao) {
    rotacao.min = String(ROTACAO_SOL_MIN);
    rotacao.max = String(ROTACAO_SOL_MAX);
    rotacao.value = String(estado.rotacao);
    escreverGraus("ceu-rotacao-valor", estado.rotacao);
  }
  if (clima && clima.value !== estado.clima) clima.value = estado.clima;
  if (ciclo) ciclo.checked = estado.ciclo;
}

function escreverGraus(id, graus) {
  const el = document.getElementById(id);
  if (!el) return;
  const arredondado = Math.round(graus * 10) / 10;
  const texto = Number.isInteger(arredondado) ? String(arredondado) : arredondado.toFixed(1);
  el.textContent = `${texto}°`;
}
