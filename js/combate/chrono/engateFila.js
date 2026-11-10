/**
 * Fila de engate Chrono por hit no OW.
 * Sem imports de sessão/executor — o dano só enfileira; o tick consome depois.
 */

/** @type {{ atacante: object, alvo: object } | null} */
let fila = null;

/** Primeiro hit do frame ganha (evita abrir duas sessões). */
export function filarEngateChronoHit(atacante, alvo) {
  if (fila || !atacante || !alvo) return;
  // Combate em turnos já está na sessão — não re-engata.
  if (atacante.resultadoTurno) return;
  fila = { atacante, alvo };
}

export function consumirEngateChronoHit() {
  const item = fila;
  fila = null;
  return item;
}

export function limparEngateChronoHit() {
  fila = null;
}
