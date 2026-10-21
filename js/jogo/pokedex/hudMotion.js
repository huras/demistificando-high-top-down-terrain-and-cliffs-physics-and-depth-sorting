/** Entrada/saída da Pokédex — transform e opacity nas tampas + tela. */

export const POKEDEX_POP_MS = 180;
export const POKEDEX_TELA_MS = 420;
export const POKEDEX_LISTA_MS = 160;
export const POKEDEX_FLOOD_MS = 90;
export const POKEDEX_SAIDA_RATIO = 0.55;

export function prefereMenosMovimento() {
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

/**
 * @param {HTMLElement | null} aparelho
 */
export function medirAlturaTela(aparelho) {
  if (!(aparelho instanceof HTMLElement)) return 0;
  const header = aparelho.querySelector(".pokedex-hud__header");
  const footer = aparelho.querySelector(".pokedex-hud__footer");
  const alvo = Math.max(200, window.innerHeight - 24);
  const chrome = (header?.offsetHeight ?? 0) + (footer?.offsetHeight ?? 0);
  const telaH = Math.max(200, Math.round(alvo - chrome));
  aparelho.style.setProperty("--pokedex-screen-h", `${telaH}px`);
  return telaH;
}

/**
 * @param {HTMLElement} root
 * @param {{ aoTelaPronta?: () => void, aoTerminar?: () => void }} [hooks]
 * @returns {() => void}
 */
export function tocarEntradaPokedex(root, hooks = {}) {
  let cancelado = false;
  /** @type {number[]} */
  const timers = [];
  /** @type {number[]} */
  const rafs = [];
  const reduzido = prefereMenosMovimento();
  const aparelho = root.querySelector(".pokedex-hud__device");

  root.classList.remove(
    "is-out",
    "is-leaving",
    "is-pop",
    "is-screen",
    "is-shine",
    "is-flood",
    "is-list",
  );
  root.classList.add("is-motion", "is-open");
  medirAlturaTela(aparelho);

  const depois = (fn, ms) => {
    const id = window.setTimeout(() => {
      if (!cancelado) fn();
    }, ms);
    timers.push(id);
  };

  const terminar = () => {
    if (cancelado) return;
    root.classList.remove("is-motion");
    hooks.aoTerminar?.();
  };

  if (reduzido) {
    root.classList.add("is-pop", "is-screen", "is-list");
    hooks.aoTelaPronta?.();
    depois(terminar, 40);
    return cancelar;
  }

  const raf1 = requestAnimationFrame(() => {
    const raf2 = requestAnimationFrame(() => {
      if (cancelado) return;
      root.classList.add("is-pop");
    });
    rafs.push(raf2);
  });
  rafs.push(raf1);

  depois(() => {
    medirAlturaTela(aparelho);
    root.classList.add("is-screen", "is-shine", "is-flood");
  }, POKEDEX_POP_MS);

  depois(() => {
    root.classList.add("is-list");
    hooks.aoTelaPronta?.();
  }, POKEDEX_POP_MS + POKEDEX_TELA_MS);

  depois(() => {
    root.classList.remove("is-flood");
  }, POKEDEX_POP_MS + POKEDEX_TELA_MS + POKEDEX_FLOOD_MS);

  depois(terminar, POKEDEX_POP_MS + POKEDEX_TELA_MS + POKEDEX_LISTA_MS + 280);

  function cancelar() {
    cancelado = true;
    for (const id of timers) clearTimeout(id);
    for (const id of rafs) cancelAnimationFrame(id);
  }
  return cancelar;
}

/**
 * @param {HTMLElement} root
 * @param {() => void} [aoFim]
 * @returns {() => void}
 */
export function tocarSaidaPokedex(root, aoFim) {
  let cancelado = false;
  const reduzido = prefereMenosMovimento();
  const popMs = Math.round(POKEDEX_POP_MS * POKEDEX_SAIDA_RATIO);
  const telaMs = Math.round(POKEDEX_TELA_MS * POKEDEX_SAIDA_RATIO);
  const listaMs = Math.round(POKEDEX_LISTA_MS * POKEDEX_SAIDA_RATIO);

  root.classList.add("is-motion", "is-leaving");
  root.classList.remove("is-list", "is-flood");

  const terminar = () => {
    if (cancelado) return;
    cancelado = true;
    root.classList.remove(
      "is-motion",
      "is-leaving",
      "is-pop",
      "is-screen",
      "is-shine",
      "is-flood",
      "is-list",
      "is-entry",
      "is-open",
      "is-out",
    );
    aoFim?.();
  };

  if (reduzido) {
    const t = window.setTimeout(terminar, 80);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }

  const t1 = window.setTimeout(() => {
    if (cancelado) return;
    root.classList.remove("is-shine", "is-screen");
  }, listaMs);

  const t2 = window.setTimeout(() => {
    if (cancelado) return;
    root.classList.remove("is-pop");
    root.classList.add("is-out");
  }, listaMs + telaMs);

  const t3 = window.setTimeout(terminar, listaMs + telaMs + popMs + 40);

  return () => {
    cancelado = true;
    clearTimeout(t1);
    clearTimeout(t2);
    clearTimeout(t3);
  };
}
