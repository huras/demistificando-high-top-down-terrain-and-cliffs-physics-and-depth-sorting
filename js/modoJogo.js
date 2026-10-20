/** Modo de visualização / jogo: "2d" | "3d". */
let modo = "3d";
const ouvintes = new Set();

export function obterModo() {
  return modo;
}

export function estaEm3d() {
  return modo === "3d";
}

export function definirModo(novo) {
  const m = novo === "3d" ? "3d" : "2d";
  if (m === modo) return modo;
  modo = m;
  for (const fn of ouvintes) fn(modo);
  return modo;
}

export function alternarModo() {
  return definirModo(modo === "2d" ? "3d" : "2d");
}

export function aoMudarModo(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

/**
 * Liga botão do header e sincroniza rótulo.
 */
export function ligarControleModo(botao) {
  if (!botao) return;
  const sync = (m) => {
    botao.textContent = m === "3d" ? "Voltar 2D" : "Jogar em 3D";
    botao.setAttribute("aria-pressed", m === "3d" ? "true" : "false");
    document.body.dataset.modo = m;
  };
  sync(modo);
  botao.addEventListener("click", () => {
    alternarModo();
  });
  aoMudarModo(sync);
}
