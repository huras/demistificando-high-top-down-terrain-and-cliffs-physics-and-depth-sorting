/** Travas de input/HUD durante cinemáticas de história. */

let travaMovimento = false;
let travaOlhar = false;
let esconderHud = false;

export function travarHistoria({ movimento = true, olhar = true, hud = true } = {}) {
  travaMovimento = !!movimento;
  travaOlhar = !!olhar;
  esconderHud = !!hud;
  sincronizarDom();
}

export function liberarHistoria() {
  travaMovimento = false;
  travaOlhar = false;
  esconderHud = false;
  sincronizarDom();
}

export function historiaTravaMovimento() {
  return travaMovimento;
}

export function historiaTravaOlhar() {
  return travaOlhar;
}

export function historiaEscondeHud() {
  return esconderHud;
}

function sincronizarDom() {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("is-story-cinema", esconderHud);
}
