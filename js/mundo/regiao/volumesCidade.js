/**
 * Lotes e volumes de prédio. A colisão é a coluna do chunk carregado;
 * o layout em si é só conta, sem malha.
 */

const BORDA = 2;
const LOTE_X = 8;
const CORPO_X = 6;
const CORPO_Y = 5;
const PASSO_X = 11;
const PASSO_Y = 8;
const QUINTAL = 1;
const MEIO_RUA = 3.5;
const CENTRO = 64;

const GRADE = Object.freeze({
  starter: Object.freeze({ col: 5, lin: 5 }),
  town: Object.freeze({ col: 5, lin: 5 }),
  city: Object.freeze({ col: 7, lin: 7 }),
});

/** Mesma ordem de `edificiosCidade.js`. A altura fecha o telhado do modelo. */
const ALTURA_CASA = Object.freeze([6, 6, 5, 6]);

export function varianteCasa(indice) {
  return indice % 4;
}

const ALTURA = Object.freeze({
  casa: 6,
  centro: 4,
  loja: 5,
  ginasio: 6,
  lab: 5,
  museu: 5,
  torre: 14,
  porto: 3,
  safari: 4,
  esconderijo: 6,
  coliseu: 7,
  mansao: 8,
});

function gradeDe(def) {
  const base = GRADE[def.tier] || GRADE.town;
  return {
    col: def.lotesCol || base.col,
    lin: def.lotesLin || base.lin,
  };
}

function cruzaFaixa(x0, y0, x1, y1) {
  const faixaX = x0 < CENTRO + MEIO_RUA && x1 > CENTRO - MEIO_RUA;
  const faixaY = y0 < CENTRO + MEIO_RUA && y1 > CENTRO - MEIO_RUA;
  return faixaX || faixaY;
}

function papelDe(def, indice, total) {
  if (def.tier === "starter" && indice === 0) return "lab";
  let cursor = def.tier === "starter" ? 1 : 0;
  if (indice === cursor) return "centro";
  cursor += 1;
  if (indice === cursor) return "loja";
  cursor += 1;
  if (def.ginasio && indice === cursor) return "ginasio";
  if (def.ginasio) cursor += 1;
  if (def.marco && indice === cursor) return def.marco.tipo;
  if (indice < total) return "casa";
  return "casa";
}

export function montarLayout(def) {
  const grade = gradeDe(def);
  const cols = BORDA + LOTE_X + (grade.col - 1) * PASSO_X + BORDA;
  const lins = BORDA + CORPO_Y + (grade.lin - 1) * PASSO_Y + BORDA;
  const x0 = CENTRO - cols / 2;
  const y0 = CENTRO - lins / 2;
  const fp = {
    x0,
    y0,
    x1: x0 + cols,
    y1: y0 + lins,
    cx: CENTRO,
    cy: CENTRO,
  };
  const xIni = Math.ceil(fp.x0) + BORDA;
  const yIni = Math.ceil(fp.y0) + BORDA;
  const livres = [];
  for (let lin = 0; lin < grade.lin; lin++) {
    for (let col = 0; col < grade.col; col++) {
      const vx0 = xIni + col * PASSO_X + QUINTAL;
      const vy0 = yIni + lin * PASSO_Y;
      const vx1 = vx0 + CORPO_X;
      const vy1 = vy0 + CORPO_Y;
      if (cruzaFaixa(vx0, vy0, vx1, vy1)) continue;
      const mx = (vx0 + vx1) / 2;
      const my = (vy0 + vy1) / 2;
      livres.push({
        x0: vx0,
        y0: vy0,
        x1: vx1,
        y1: vy1,
        dist: (mx - CENTRO) * (mx - CENTRO) + (my - CENTRO) * (my - CENTRO),
        sul: my,
      });
    }
  }
  let ordem = livres;
  if (def.tier === "starter" && livres.length > 1) {
    const porSul = livres.slice().sort((a, b) => b.sul - a.sul || a.dist - b.dist);
    const lab = porSul[0];
    const resto = porSul.slice(1).sort((a, b) => a.dist - b.dist);
    ordem = [lab, ...resto];
  } else {
    ordem = livres.slice().sort((a, b) => a.dist - b.dist);
  }
  const LIMITE = 36;
  const volumes = [];
  const n = Math.min(ordem.length, LIMITE);
  for (let i = 0; i < n; i++) {
    const lote = ordem[i];
    const papel = papelDe(def, i, n);
    const variante = papel === "casa" ? varianteCasa(i) : 0;
    volumes.push({
      x0: lote.x0,
      y0: lote.y0,
      x1: lote.x1,
      y1: lote.y1,
      altura: papel === "casa" ? ALTURA_CASA[variante] : ALTURA[papel] || ALTURA.casa,
      papel,
      variante,
    });
  }
  return { fp, volumes };
}

export function noFootprint(lx, ly, layout) {
  const fp = layout.fp;
  return lx >= fp.x0 && lx < fp.x1 && ly >= fp.y0 && ly < fp.y1;
}

export function predioNoLayout(lx, ly, layout) {
  const lista = layout.volumes;
  for (let i = 0; i < lista.length; i++) {
    const v = lista[i];
    if (lx >= v.x0 && lx < v.x1 && ly >= v.y0 && ly < v.y1) return v;
  }
  return null;
}

export function ruaNoLayout(lx, ly, layout) {
  const fp = layout.fp;
  if (Math.abs(lx + 0.5 - fp.cx) <= MEIO_RUA || Math.abs(ly + 0.5 - fp.cy) <= MEIO_RUA) {
    return true;
  }
  const xIni = Math.ceil(fp.x0) + BORDA;
  const yIni = Math.ceil(fp.y0) + BORDA;
  const xFim = Math.floor(fp.x1) - BORDA;
  const yFim = Math.floor(fp.y1) - BORDA;
  if (lx < xIni || ly < yIni || lx >= xFim || ly >= yFim) return false;
  const dx = (lx - xIni) % PASSO_X;
  const dy = (ly - yIni) % PASSO_Y;
  return dx >= LOTE_X || dy >= CORPO_Y;
}
