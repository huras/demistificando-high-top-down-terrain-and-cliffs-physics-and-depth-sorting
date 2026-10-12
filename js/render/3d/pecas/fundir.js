/**
 * Funde o chão plano dentro do chunk.
 * `fundivel` marca célula simples, mesma regra de kit e altura, sem borda e sem splat.
 */
export function fundirChao(lado, fundivel, altura, kit) {
  const usado = new Uint8Array(lado * lado);
  const planos = [];
  for (let ly = 0; ly < lado; ly++) {
    const linha = ly * lado;
    for (let lx = 0; lx < lado; lx++) {
      const i = linha + lx;
      if (usado[i] || !fundivel[i]) continue;
      const h = altura[i];
      const k = kit[i];
      let w = 1;
      while (lx + w < lado) {
        const j = i + w;
        if (usado[j] || !fundivel[j] || altura[j] !== h || kit[j] !== k) break;
        w++;
      }
      let d = 1;
      while (ly + d < lado) {
        const base = (ly + d) * lado + lx;
        let ok = true;
        for (let x = 0; x < w; x++) {
          const j = base + x;
          if (usado[j] || !fundivel[j] || altura[j] !== h || kit[j] !== k) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
        d++;
      }
      for (let y = 0; y < d; y++) {
        const base = (ly + y) * lado + lx;
        for (let x = 0; x < w; x++) usado[base + x] = 1;
      }
      planos.push({ lx, ly, w, d, h, kit: k });
    }
  }
  return planos;
}
