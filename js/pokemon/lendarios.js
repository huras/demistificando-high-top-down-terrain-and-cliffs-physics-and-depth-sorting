/** Lendários e míticos da dex nacional 1–493. Ficam de fora do piso de ninhos. */
const DEX = new Set([
  144, 145, 146, 150, 151,
  243, 244, 245, 249, 250, 251,
  377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493,
]);

export function ehLendario(dex) {
  return DEX.has(dex | 0);
}
