/**
 * Cadeia de pose aérea PMD (asset ≠ tipo Flying).
 * FlapAround preferido; Hover/Hop/Float cobrem aves sem flap (Spearow, Starly…).
 */

export const CADEIA_VOO = Object.freeze(["FlapAround", "Hover", "Hop", "Float"]);

/** CopyOf que não conta como pose aérea real. */
export const POSE_VOO_DENY_COPY = Object.freeze(
  new Set(["Twirl", "Rotate", "Dance"]),
);

/**
 * Melhor strip aérea presente no atlas/pack.
 * @param {{ anims?: Record<string, unknown> } | null | undefined} pack
 * @returns {string | null}
 */
export function escolherAnimVoo(pack) {
  const anims = pack?.anims;
  if (!anims) return null;
  for (let i = 0; i < CADEIA_VOO.length; i++) {
    const n = CADEIA_VOO[i];
    if (anims[n]) return n;
  }
  return null;
}

/**
 * @param {string | null | undefined} nome
 */
export function ehAnimVoo(nome) {
  if (!nome) return false;
  for (let i = 0; i < CADEIA_VOO.length; i++) {
    if (CADEIA_VOO[i] === nome) return true;
  }
  return false;
}

/** Voo/planagem de verdade — não pulo de chão. */
export function ehVooDeVerdade(ator) {
  return !!(ator && (ator.skyPasser || ator.voando || ator.planando));
}

/**
 * No ar por pulo de locomoção/combate (hopLift / pulando), sem voo verdadeiro.
 */
export function ehPuloChao(ator) {
  if (!ator || ehVooDeVerdade(ator)) return false;
  if (ator.pulando) return true;
  if ((ator.hopLift || 0) > 0.12) return true;
  if ((ator.puloAlt || 0) > 0.02 && ator.puloVisual) return true;
  return false;
}

/**
 * Pulo de chão em mon sem FlapAround/Hover — usa Hop scrubado + pivot atenuado.
 * @param {object | null | undefined} ator
 * @param {{ anims?: Record<string, unknown> } | null | undefined} pack
 */
export function querHopOrientado(ator, pack) {
  if (!ehPuloChao(ator) || ehVooDeVerdade(ator)) return false;
  if (!pack?.anims?.Hop) return false;
  if (pack.anims.FlapAround || pack.anims.Hover) return false;
  return true;
}
