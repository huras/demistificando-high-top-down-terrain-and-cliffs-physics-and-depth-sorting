/**
 * Caixa padrão do cartão 2D. Sem dependência de cidade ou de Three,
 * pra o layout e o editor usarem a mesma conta.
 */

/** Corpo raso na frente do cartão. */
export function corpoPadraoSprite(largura) {
  const lx = largura > 0 ? largura : 6;
  const ly = Math.max(1.2, Math.min(4, lx * 0.35));
  return {
    x: 0,
    y: 0,
    lx,
    ly: Math.round(ly * 100) / 100,
  };
}

/** Porta no meio da fachada, encostada na borda sul do corpo padrão. */
export function portaPadraoSprite(largura) {
  const corpo = corpoPadraoSprite(largura);
  const lx = Math.min(1.6, Math.max(0.8, corpo.lx * 0.2));
  return {
    x: 0,
    y: Math.round((corpo.ly * 0.5 - 0.5) * 100) / 100,
    lx: Math.round(lx * 100) / 100,
    ly: 1,
  };
}
