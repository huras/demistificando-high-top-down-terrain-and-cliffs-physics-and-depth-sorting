/** Vista de cena: câmera livre, só no modo 3D. O jogo continua simulado. */

let ativo = false;
const ouvintes = new Set();

export function estaEmCena() {
  return ativo;
}

/** WASD, pulo, voo e escalada ficam com a câmera de cena. */
export function entradaJogadorSuspensa() {
  return ativo;
}

export function definirModoCena(ligado) {
  const proximo = !!ligado;
  if (proximo === ativo) return ativo;
  ativo = proximo;
  if (document.body) {
    if (ativo) document.body.dataset.cena = "ativa";
    else delete document.body.dataset.cena;
  }
  for (const fn of ouvintes) fn(ativo);
  return ativo;
}

export function alternarModoCena() {
  return definirModoCena(!ativo);
}

export function aoMudarCena(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}
