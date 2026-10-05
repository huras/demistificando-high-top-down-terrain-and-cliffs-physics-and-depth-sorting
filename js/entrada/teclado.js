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
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Space",
        "Equal",
        "Minus",
        "KeyQ",
        "KeyE",
        "ShiftLeft",
        "ShiftRight",
      ].includes(k)
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

/** Transforma o vetor WASD (ex.: relativo à câmera 3D). */
let adaptadorVetor = null;

export function definirAdaptadorVetor(fn) {
  adaptadorVetor = typeof fn === "function" ? fn : null;
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
  if (adaptadorVetor) return adaptadorVetor(dx, dy);
  return { dx, dy };
}

export function limparEdges() {
  acabouDePressionar.clear();
  consumidos.clear();
}

/**
 * Escalada: E no 2D; F no 3D (Q/E órbitam a câmera).
 * codigoEscalada: "KeyE" | "KeyF" | null (auto pelo body[data-modo]).
 */
export function teclaEscaladaAgora(codigoEscalada = null) {
  const codigo =
    codigoEscalada ||
    (document.body?.dataset?.modo === "3d" ? "KeyF" : "KeyE");
  return teclaAgora(codigo);
}
