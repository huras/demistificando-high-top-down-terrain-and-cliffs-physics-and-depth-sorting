/** Estado do céu que existe antes da cena 3D (o painel mexe aqui). */

export const CLIMAS = ["limpo", "chuva", "areia", "nevasca"];

const NOMES = {
  limpo: "Limpo",
  chuva: "Chuva",
  areia: "Tempestade de areia",
  nevasca: "Nevasca",
};

let hora = 9.35;
let ciclo = true;
let clima = "limpo";

function enrolar(h) {
  let x = h % 24;
  if (x < 0) x += 24;
  return x;
}

export function obterHora() {
  return hora;
}

export function definirHora(h) {
  hora = enrolar(Number(h) || 0);
  return hora;
}

export function avancarHora(delta) {
  return definirHora(hora + delta);
}

export function cicloLigado() {
  return ciclo;
}

export function definirCiclo(ligado) {
  ciclo = !!ligado;
  return ciclo;
}

export function obterClima() {
  return clima;
}

export function definirClima(id) {
  if (NOMES[id]) clima = id;
  return clima;
}

export function alternarClima() {
  const i = CLIMAS.indexOf(clima);
  clima = CLIMAS[(i + 1) % CLIMAS.length];
  return clima;
}

export function nomeClima(id = clima) {
  return NOMES[id] || id;
}

export function nomeFase(h = hora) {
  if (h >= 5 && h < 8) return "Amanhecer";
  if (h >= 8 && h < 15.5) return "Dia";
  if (h >= 15.5 && h < 18.2) return "Tarde";
  if (h >= 18.2 && h < 20.5) return "Anoitecer";
  return "Noite";
}

export function textoHora(h = hora) {
  const horas = Math.floor(h);
  const minutos = Math.floor((h - horas) * 60);
  const hh = String(horas).padStart(2, "0");
  const mm = String(minutos).padStart(2, "0");
  return `${hh}:${mm} · ${nomeFase(h)}`;
}

export function obterControleCeu() {
  return { hora, ciclo, clima };
}

/** Avança o relógio se o ciclo automático estiver ligado. */
export function avancarCiclo(dt, duracaoDia) {
  if (ciclo && dt > 0) hora = enrolar(hora + (dt * 24) / duracaoDia);
  return hora;
}
