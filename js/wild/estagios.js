/** Estágios de crescimento da berry. Solo vazio não entra na cadeia. */

export const ESTAGIO = Object.freeze({
  SOLO: "soil",
  SEMENTE: "seed",
  BROTO: "sprout",
  ARBUSTO: "bush",
  FLOR: "flower",
  MADURA: "ripe",
});

export const ORDEM_CRESCIMENTO = Object.freeze([
  ESTAGIO.SEMENTE,
  ESTAGIO.BROTO,
  ESTAGIO.ARBUSTO,
  ESTAGIO.FLOR,
  ESTAGIO.MADURA,
]);

const DURACAO_PADRAO = Object.freeze({
  seed: 45,
  sprout: 45,
  bush: 45,
  flower: 45,
  ripe: 0,
});

export function indiceEstagio(estagio) {
  return ORDEM_CRESCIMENTO.indexOf(estagio);
}

export function proximoEstagio(estagio) {
  const i = indiceEstagio(estagio);
  if (i < 0 || i >= ORDEM_CRESCIMENTO.length - 1) return null;
  return ORDEM_CRESCIMENTO[i + 1];
}

export function estaCrescendo(estagio) {
  return indiceEstagio(estagio) >= 0 && estagio !== ESTAGIO.MADURA;
}

export function duracaoEstagioSeg(estagio) {
  return DURACAO_PADRAO[estagio] ?? 45;
}

export function fatorSeco() {
  return 0.1;
}

export function janelaUmidaMs() {
  return 180 * 1000;
}

export function estaUmido(plot, agora = Date.now()) {
  if (!plot?.lastWateredAt) return false;
  return agora - plot.lastWateredAt <= janelaUmidaMs();
}

export function msEfetivo(de, ate, plot) {
  if (!plot || ate <= de) return 0;
  const seco = fatorSeco();
  const inicio = plot.lastWateredAt > 0 ? plot.lastWateredAt : Infinity;
  const fim = Number.isFinite(inicio) ? inicio + janelaUmidaMs() : -Infinity;
  let efetivo = 0;
  let t = de;
  while (t < ate) {
    const umido = t >= inicio && t < fim;
    let prox = ate;
    if (umido && fim < prox) prox = fim;
    if (!umido && inicio > t && inicio < prox) prox = inicio;
    efetivo += (prox - t) * (umido ? 1 : seco);
    t = prox;
  }
  return efetivo;
}
