const teclas = new Set();
const acabouDePressionar = new Set();
const consumidos = new Set();

function normalizar(codigo) {
  if (codigo === " ") return "Space";
  return codigo;
}

export function iniciarTeclado() {
  window.addEventListener("keydown", (ev) => {
    const k = normalizar(ev.code || ev.key);
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Equal", "Minus"].includes(k)
    ) {
      ev.preventDefault();
    }
    if (!teclas.has(k)) acabouDePressionar.add(k);
    teclas.add(k);
  });

  window.addEventListener("keyup", (ev) => {
    const k = normalizar(ev.code || ev.key);
    teclas.delete(k);
    acabouDePressionar.delete(k);
    consumidos.delete(k);
  });

  window.addEventListener("blur", () => {
    teclas.clear();
    acabouDePressionar.clear();
    consumidos.clear();
  });
}

export function teclaBaixa(codigo) {
  return teclas.has(codigo);
}

/** True só no frame em que a tecla foi pressionada (edge). */
export function teclaAgora(codigo) {
  if (!acabouDePressionar.has(codigo) || consumidos.has(codigo)) return false;
  consumidos.add(codigo);
  return true;
}

export function vetorMovimento() {
  let dx = 0;
  let dy = 0;
  if (teclaBaixa("KeyA") || teclaBaixa("ArrowLeft")) dx -= 1;
  if (teclaBaixa("KeyD") || teclaBaixa("ArrowRight")) dx += 1;
  if (teclaBaixa("KeyW") || teclaBaixa("ArrowUp")) dy -= 1;
  if (teclaBaixa("KeyS") || teclaBaixa("ArrowDown")) dy += 1;
  if (dx !== 0 && dy !== 0) {
    const inv = 1 / Math.SQRT2;
    dx *= inv;
    dy *= inv;
  }
  return { dx, dy };
}

export function limparEdges() {
  acabouDePressionar.clear();
  consumidos.clear();
}
