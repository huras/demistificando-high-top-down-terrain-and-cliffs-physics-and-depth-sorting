/**
 * Lotes e volumes de prédio. A colisão é a coluna do chunk carregado;
 * o layout em si é só conta, sem malha.
 */
import { ajusteDe } from "../cidade/ajustesColisor.js";
import { idDaCasa } from "../cidade/catalogoCasas.js";
import { portaPadraoSprite } from "../cidade/caixaSprite.js";

/** casa-2 e casa-4 não têm porta. Igual red-house-2/4. */
const FOLHAS_SEM_PORTA = new Set([2, 4]);

const BORDA = 2;
const CORPO_X = 6;
const CORPO_Y = 5;
/** Quintal em volta do corpo (todos os lados). */
const QUINTAL = 2;
/** Beco mínimo entre lotes. */
const RUA = 3;
const LOTE_CASA_X = CORPO_X + QUINTAL * 2;
const LOTE_CASA_Y = CORPO_Y + QUINTAL * 2;
const PASSO_X = LOTE_CASA_X + RUA;
const PASSO_Y = LOTE_CASA_Y + RUA;
const MEIO_RUA = 3.5;
const CENTRO = 64;
const LIMITE = 36;

/** Máscara O(1): vazio na borda, rua, quintal/lote, corpo do prédio. */
const MASK_VAZIO = 0;
const MASK_RUA = 1;
const MASK_LOTE = 2;
const MASK_CORPO = 3;

const GRADE = Object.freeze({
  starter: Object.freeze({ col: 5, lin: 5 }),
  town: Object.freeze({ col: 5, lin: 5 }),
  city: Object.freeze({ col: 7, lin: 7 }),
});

/** Pegada no chão por papel (não a altura do billboard). */
const CORPO_POR_PAPEL = Object.freeze({
  casa: Object.freeze({ x: 6, y: 5 }),
  centro: Object.freeze({ x: 6, y: 5 }),
  loja: Object.freeze({ x: 6, y: 5 }),
  lab: Object.freeze({ x: 7, y: 6 }),
  ginasio: Object.freeze({ x: 9, y: 7 }),
  museu: Object.freeze({ x: 10, y: 7 }),
  torre: Object.freeze({ x: 9, y: 7 }),
  coliseu: Object.freeze({ x: 15, y: 8 }),
  mansao: Object.freeze({ x: 18, y: 9 }),
  porto: Object.freeze({ x: 6, y: 5 }),
  safari: Object.freeze({ x: 6, y: 5 }),
  ruina: Object.freeze({ x: 8, y: 6 }),
});

/** Quatro modelos de casa. */
const VARIANTES_CASA = 4;

export function varianteCasa(indice) {
  return ((indice % VARIANTES_CASA) + VARIANTES_CASA) % VARIANTES_CASA;
}

const ALTURA = Object.freeze({
  casa: 5,
  centro: 4,
  loja: 5,
  ginasio: 6,
  lab: 5,
  museu: 5,
  torre: 14,
  porto: 3,
  safari: 4,
  ruina: 6,
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

function corpoDoPapel(papel) {
  return CORPO_POR_PAPEL[papel] || CORPO_POR_PAPEL.casa;
}

function loteDoCorpo(cx, cy) {
  return { x: cx + QUINTAL * 2, y: cy + QUINTAL * 2 };
}

function spanDoLote(lw, lh) {
  return {
    col: Math.max(1, Math.ceil((lw + RUA) / PASSO_X)),
    lin: Math.max(1, Math.ceil((lh + RUA) / PASSO_Y)),
  };
}

function papeisEspeciais(def) {
  const lista = [];
  if (def.tier === "starter") lista.push("lab");
  lista.push("centro", "loja");
  if (def.ginasio) lista.push("ginasio");
  if (def.marco?.tipo) lista.push(def.marco.tipo);
  return lista;
}

function celulaLivre(ocupada, grade, col, lin, spanC, spanL) {
  if (col < 0 || lin < 0 || col + spanC > grade.col || lin + spanL > grade.lin) return false;
  for (let dy = 0; dy < spanL; dy++) {
    for (let dx = 0; dx < spanC; dx++) {
      if (ocupada[(lin + dy) * grade.col + (col + dx)]) return false;
    }
  }
  return true;
}

function marcarCelulas(ocupada, grade, col, lin, spanC, spanL) {
  for (let dy = 0; dy < spanL; dy++) {
    for (let dx = 0; dx < spanC; dx++) {
      ocupada[(lin + dy) * grade.col + (col + dx)] = 1;
    }
  }
}

function candidatosDaGrade(grade, xIni, yIni) {
  const lista = [];
  for (let lin = 0; lin < grade.lin; lin++) {
    for (let col = 0; col < grade.col; col++) {
      const ox = xIni + col * PASSO_X;
      const oy = yIni + lin * PASSO_Y;
      const mx = ox + LOTE_CASA_X * 0.5;
      const my = oy + LOTE_CASA_Y * 0.5;
      lista.push({
        col,
        lin,
        ox,
        oy,
        dist: (mx - CENTRO) * (mx - CENTRO) + (my - CENTRO) * (my - CENTRO),
        sul: my,
      });
    }
  }
  return lista;
}

function ordenarCandidatos(lista, preferirSul) {
  if (preferirSul) {
    return lista.slice().sort((a, b) => b.sul - a.sul || a.dist - b.dist);
  }
  return lista.slice().sort((a, b) => a.dist - b.dist);
}

function encaixarLote(ocupada, grade, candidatos, lw, lh, fp) {
  const span = spanDoLote(lw, lh);
  const utilX = span.col * PASSO_X - RUA;
  const utilY = span.lin * PASSO_Y - RUA;
  for (let i = 0; i < candidatos.length; i++) {
    const c = candidatos[i];
    if (!celulaLivre(ocupada, grade, c.col, c.lin, span.col, span.lin)) continue;
    const lx0 = c.ox + Math.floor((utilX - lw) * 0.5);
    const ly0 = c.oy + Math.floor((utilY - lh) * 0.5);
    const lx1 = lx0 + lw;
    const ly1 = ly0 + lh;
    if (lx0 < fp.x0 + BORDA || ly0 < fp.y0 + BORDA || lx1 > fp.x1 - BORDA || ly1 > fp.y1 - BORDA) {
      continue;
    }
    if (cruzaFaixa(lx0, ly0, lx1, ly1)) continue;
    return { col: c.col, lin: c.lin, spanC: span.col, spanL: span.lin, x0: lx0, y0: ly0, x1: lx1, y1: ly1 };
  }
  return null;
}

function montarVolume(def, papel, lote, casas) {
  const corpo = corpoDoPapel(papel);
  const cx0 = lote.x0 + Math.floor((lote.x1 - lote.x0 - corpo.x) * 0.5);
  const cy0 = lote.y0 + Math.floor((lote.y1 - lote.y0 - corpo.y) * 0.5);
  const variante = papel === "casa" ? varianteCasa(casas.n) : 0;
  let modelo = null;
  let cartao = false;
  let folha = 0;
  if (papel === "casa") {
    modelo = idDaCasa(def.key, casas.n);
    casas.n += 1;
  } else if (
    papel === "centro" ||
    papel === "loja" ||
    papel === "lab" ||
    papel === "ginasio" ||
    papel === "museu" ||
    papel === "coliseu" ||
    papel === "mansao" ||
    papel === "ruina"
  ) {
    modelo = papel;
  }
  return {
    x0: cx0,
    y0: cy0,
    x1: cx0 + corpo.x,
    y1: cy0 + corpo.y,
    lote: { x0: lote.x0, y0: lote.y0, x1: lote.x1, y1: lote.y1 },
    altura: ALTURA[papel] || ALTURA.casa,
    papel,
    variante,
    modelo,
    cartao,
    folha,
    porta: !(cartao && FOLHAS_SEM_PORTA.has(folha)),
  };
}

function assarMascara(fp, volumes) {
  const x0 = Math.floor(fp.x0);
  const y0 = Math.floor(fp.y0);
  const x1 = Math.ceil(fp.x1);
  const y1 = Math.ceil(fp.y1);
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  const tipo = new Uint8Array(w * h);
  const vol = new Int16Array(w * h);
  vol.fill(-1);

  const xIni = Math.ceil(fp.x0) + BORDA;
  const yIni = Math.ceil(fp.y0) + BORDA;
  const xFim = Math.floor(fp.x1) - BORDA;
  const yFim = Math.floor(fp.y1) - BORDA;

  for (let y = yIni; y < yFim; y++) {
    for (let x = xIni; x < xFim; x++) {
      tipo[(y - y0) * w + (x - x0)] = MASK_RUA;
    }
  }

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (Math.abs(x + 0.5 - fp.cx) <= MEIO_RUA || Math.abs(y + 0.5 - fp.cy) <= MEIO_RUA) {
        tipo[(y - y0) * w + (x - x0)] = MASK_RUA;
      }
    }
  }

  for (let i = 0; i < volumes.length; i++) {
    const v = volumes[i];
    const L = v.lote;
    const lx0 = Math.floor(L.x0);
    const ly0 = Math.floor(L.y0);
    const lx1 = Math.ceil(L.x1);
    const ly1 = Math.ceil(L.y1);
    for (let y = ly0; y < ly1; y++) {
      for (let x = lx0; x < lx1; x++) {
        if (x < x0 || y < y0 || x >= x1 || y >= y1) continue;
        tipo[(y - y0) * w + (x - x0)] = MASK_LOTE;
      }
    }
  }

  for (let i = 0; i < volumes.length; i++) {
    const v = volumes[i];
    const cx0 = Math.floor(v.x0);
    const cy0 = Math.floor(v.y0);
    const cx1 = Math.ceil(v.x1);
    const cy1 = Math.ceil(v.y1);
    for (let y = cy0; y < cy1; y++) {
      for (let x = cx0; x < cx1; x++) {
        if (x < x0 || y < y0 || x >= x1 || y >= y1) continue;
        const idx = (y - y0) * w + (x - x0);
        tipo[idx] = MASK_CORPO;
        vol[idx] = i;
      }
    }
  }

  return { x0, y0, w, h, tipo, vol };
}

function indiceMascara(mascara, lx, ly) {
  if (!mascara) return -1;
  const x = Math.floor(lx) - mascara.x0;
  const y = Math.floor(ly) - mascara.y0;
  if (x < 0 || y < 0 || x >= mascara.w || y >= mascara.h) return -1;
  return y * mascara.w + x;
}

export function montarLayout(def) {
  const grade = gradeDe(def);
  const cols = BORDA + LOTE_CASA_X + (grade.col - 1) * PASSO_X + BORDA;
  const lins = BORDA + LOTE_CASA_Y + (grade.lin - 1) * PASSO_Y + BORDA;
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
  const ocupada = new Uint8Array(grade.col * grade.lin);
  const candidatos = candidatosDaGrade(grade, xIni, yIni);
  const volumes = [];
  const casas = { n: 0 };

  const especiais = papeisEspeciais(def);
  for (let i = 0; i < especiais.length; i++) {
    const papel = especiais[i];
    const corpo = corpoDoPapel(papel);
    const loteTam = loteDoCorpo(corpo.x, corpo.y);
    const ordem = ordenarCandidatos(candidatos, def.tier === "starter" && papel === "lab");
    const lugar = encaixarLote(ocupada, grade, ordem, loteTam.x, loteTam.y, fp);
    if (!lugar) continue;
    marcarCelulas(ocupada, grade, lugar.col, lugar.lin, lugar.spanC, lugar.spanL);
    volumes.push(montarVolume(def, papel, lugar, casas));
  }

  const ordemCasa = ordenarCandidatos(candidatos, false);
  const loteCasa = loteDoCorpo(CORPO_X, CORPO_Y);
  for (let i = 0; i < ordemCasa.length && volumes.length < LIMITE; i++) {
    const lugar = encaixarLote(ocupada, grade, [ordemCasa[i]], loteCasa.x, loteCasa.y, fp);
    if (!lugar) continue;
    marcarCelulas(ocupada, grade, lugar.col, lugar.lin, lugar.spanC, lugar.spanL);
    volumes.push(montarVolume(def, "casa", lugar, casas));
  }

  const mascara = assarMascara(fp, volumes);
  return { fp, volumes, mascara };
}

function yawDaFrente(v) {
  if (v.cartao || v.sprite || v.papel === "casa" || v.papel === "lab") return 0;
  const mx = (v.x0 + v.x1) * 0.5;
  const my = (v.y0 + v.y1) * 0.5;
  const dx = mx - CENTRO;
  const dy = my - CENTRO;
  if (Math.abs(dy) <= Math.abs(dx)) return dy > 0 ? Math.PI : 0;
  return dx > 0 ? -Math.PI / 2 : Math.PI / 2;
}

function giroLocal(x, z, yaw) {
  const k = ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
  if (k === 1) return [z, -x];
  if (k === 2) return [-x, -z];
  if (k === 3) return [-z, x];
  return [x, z];
}

function faixaNoMeio(v) {
  const k = ((Math.round(yawDaFrente(v) / (Math.PI / 2)) % 4) + 4) % 4;
  const cx = (v.x0 + v.x1) * 0.5;
  const cy = (v.y0 + v.y1) * 0.5;
  if (k === 0) return { x0: cx - 0.5, x1: cx + 0.5, y0: v.y1 - 1, y1: v.y1 };
  if (k === 1) return { x0: v.x1 - 1, x1: v.x1, y0: cy - 0.5, y1: cy + 0.5 };
  if (k === 2) return { x0: cx - 0.5, x1: cx + 0.5, y0: v.y0, y1: v.y0 + 1 };
  return { x0: v.x0, x1: v.x0 + 1, y0: cy - 0.5, y1: cy + 0.5 };
}

/** Vidro da porta nas folhas de 64px. O pivô do cartão é o meio; a porta fica à direita. */
const PORTA_CARTAO = Object.freeze({
  1: Object.freeze([36, 50]),
  3: Object.freeze([36, 50]),
  5: Object.freeze([36, 50]),
});
const LARGURA_CARTAO = 4;

function faixaDoCartao(v) {
  const px = PORTA_CARTAO[v.folha];
  if (!px) return faixaNoMeio(v);
  const cx = (v.x0 + v.x1) * 0.5;
  return {
    x0: cx + (px[0] / 64 - 0.5) * LARGURA_CARTAO,
    x1: cx + (px[1] / 64 - 0.5) * LARGURA_CARTAO,
    y0: v.y1 - 1,
    y1: v.y1,
  };
}

/**
 * O cartão do jogo deita 45° e o chão esmaga a altura.
 * A caixa do editor, em pé na arte, vira essa sombra no chão.
 */
function projetarCartao(v, caixa) {
  const altura = 3;
  const s = Math.sin(Math.PI / 4);
  const c = Math.cos(Math.PI / 4);
  const hx = Number(caixa.lx) * 0.5;
  const hz = Number(caixa.ly) * 0.5;
  const xs = [Number(caixa.x) - hx, Number(caixa.x) + hx];
  const ys = [0, altura];
  const zs = [Number(caixa.y) - hz, Number(caixa.y) + hz];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let ix = 0; ix < 2; ix++) {
    for (let iy = 0; iy < 2; iy++) {
      for (let iz = 0; iz < 2; iz++) {
        const z2 = -ys[iy] * s + zs[iz] * c;
        if (xs[ix] < minX) minX = xs[ix];
        if (xs[ix] > maxX) maxX = xs[ix];
        if (z2 < minZ) minZ = z2;
        if (z2 > maxZ) maxZ = z2;
      }
    }
  }
  const cx = (v.x0 + v.x1) * 0.5;
  const cy = (v.y0 + v.y1) * 0.5;
  return { x0: cx + minX, x1: cx + maxX, y0: cy + minZ, y1: cy + maxZ };
}

/** Caixa do editor, no espaço do lote. O giro da rua entra aqui. */
export function projetarCaixa(v, caixa) {
  if (v?.sprite) return projetarCartao(v, caixa);
  const hx = Number(caixa.lx) * 0.5;
  const hy = Number(caixa.ly) * 0.5;
  const x0 = Number(caixa.x) - hx;
  const x1 = Number(caixa.x) + hx;
  const z0 = Number(caixa.y) - hy;
  const z1 = Number(caixa.y) + hy;
  const yaw = yawDaFrente(v);
  const cx = (v.x0 + v.x1) * 0.5;
  const cy = (v.y0 + v.y1) * 0.5;
  const cantos = [
    [x0, z0],
    [x1, z0],
    [x0, z1],
    [x1, z1],
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < cantos.length; i++) {
    const [rx, rz] = giroLocal(cantos[i][0], cantos[i][1], yaw);
    const wx = cx + rx;
    const wy = cy + rz;
    if (wx < minX) minX = wx;
    if (wx > maxX) maxX = wx;
    if (wy < minY) minY = wy;
    if (wy > maxY) maxY = wy;
  }
  return { x0: minX, x1: maxX, y0: minY, y1: maxY };
}

function caixaMedida(caixa) {
  if (!caixa) return false;
  const lx = Number(caixa.lx);
  const ly = Number(caixa.ly);
  return Number.isFinite(Number(caixa.x))
    && Number.isFinite(Number(caixa.y))
    && lx > 0.05
    && ly > 0.05;
}

/** Sólido do lote. Com medida salva, usa ela. Senão, o retângulo do lote. */
export function caixaDoCorpo(v) {
  const ajuste = ajusteDe(v);
  if (ajuste?.corpo && caixaMedida(ajuste.corpo)) return projetarCaixa(v, ajuste.corpo);
  return { x0: v.x0, y0: v.y0, x1: v.x1, y1: v.y1 };
}

/**
 * Vão da porta no lote.
 * Medida salva na página de colisores vem primeiro.
 * Sem isso, a porta da malha. Sem malha, um tile no meio da frente.
 */
export function faixaDaPorta(v, porta) {
  if (!v) return null;
  const ajuste = ajusteDe(v);
  if (ajuste && Object.prototype.hasOwnProperty.call(ajuste, "porta")) {
    if (!ajuste.porta) return null;
    if (caixaMedida(ajuste.porta)) return projetarCaixa(v, ajuste.porta);
  }
  // Cartão 2D não herda a porta da malha 3D. Sem medida salva, a mesma
  // porta que a página desenha em cima da arte.
  if (v.sprite) return projetarCaixa(v, portaPadraoSprite(v.larguraSprite));
  if (v.porta === false) return null;
  if (!porta) return v.cartao ? faixaDoCartao(v) : faixaNoMeio(v);
  const hx = (v.x1 - v.x0) * 0.5;
  const hz = (v.y1 - v.y0) * 0.5;
  const yaw = yawDaFrente(v);
  const k = ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
  const troca = k === 1 || k === 3;
  const meioX = troca ? hz : hx;
  const meioZ = troca ? hx : hz;
  const fora = 0.9;
  const dentro = 0.45;
  let x0;
  let x1;
  let z0;
  let z1;
  if (porta.eixo === 0) {
    z0 = porta.u0;
    z1 = porta.u1;
    const borda = porta.paraFora > 0 ? meioX : -meioX;
    const a = porta.plano - porta.paraFora * dentro;
    const b = borda + porta.paraFora * fora;
    x0 = Math.min(a, b);
    x1 = Math.max(a, b);
  } else {
    x0 = porta.u0;
    x1 = porta.u1;
    const borda = porta.paraFora > 0 ? meioZ : -meioZ;
    const a = porta.plano - porta.paraFora * dentro;
    const b = borda + porta.paraFora * fora;
    z0 = Math.min(a, b);
    z1 = Math.max(a, b);
  }
  const cx = (v.x0 + v.x1) * 0.5;
  const cy = (v.y0 + v.y1) * 0.5;
  const cantos = [
    [x0, z0],
    [x1, z0],
    [x0, z1],
    [x1, z1],
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < cantos.length; i++) {
    const [rx, rz] = giroLocal(cantos[i][0], cantos[i][1], yaw);
    const wx = cx + rx;
    const wy = cy + rz;
    if (wx < minX) minX = wx;
    if (wx > maxX) maxX = wx;
    if (wy < minY) minY = wy;
    if (wy > maxY) maxY = wy;
  }
  return { x0: minX, x1: maxX, y0: minY, y1: maxY };
}

/** Um passo para fora da porta da frente. */
export function saidaDaPorta(v, ox, oy, porta) {
  const faixa = faixaDaPorta(v, porta);
  const cx = ox + (v.x0 + v.x1) * 0.5;
  if (!faixa) return { x: cx, y: oy + v.y1 + 1.15 };
  const px = ox + (faixa.x0 + faixa.x1) * 0.5;
  const py = oy + (faixa.y0 + faixa.y1) * 0.5;
  if (faixa.y1 >= v.y1) return { x: px, y: oy + v.y1 + 1.15 };
  if (faixa.y0 <= v.y0) return { x: px, y: oy + v.y0 - 1.15 };
  if (faixa.x1 >= v.x1) return { x: ox + v.x1 + 1.15, y: py };
  return { x: ox + v.x0 - 1.15, y: py };
}

/** Quintal de qualquer lote — mato/decor não entra. */
export function noQuintalDoLote(lx, ly, layout) {
  const idx = indiceMascara(layout?.mascara, lx, ly);
  if (idx < 0) return false;
  return layout.mascara.tipo[idx] === MASK_LOTE;
}

/** Compat: mesmo papel do quintal (antes só o lab). */
export function naEntradaDoLab(lx, ly, layout) {
  return noQuintalDoLote(lx, ly, layout);
}

export function noFootprint(lx, ly, layout) {
  const fp = layout.fp;
  return lx >= fp.x0 && lx < fp.x1 && ly >= fp.y0 && ly < fp.y1;
}

export function predioNoLayout(lx, ly, layout) {
  const mascara = layout?.mascara;
  if (mascara) {
    const idx = indiceMascara(mascara, lx, ly);
    if (idx < 0) return null;
    const vi = mascara.vol[idx];
    if (vi < 0) return null;
    return layout.volumes[vi] || null;
  }
  const lista = layout.volumes;
  for (let i = 0; i < lista.length; i++) {
    const v = lista[i];
    if (lx >= v.x0 && lx < v.x1 && ly >= v.y0 && ly < v.y1) return v;
  }
  return null;
}

export function ruaNoLayout(lx, ly, layout) {
  const mascara = layout?.mascara;
  if (mascara) {
    const idx = indiceMascara(mascara, lx, ly);
    if (idx < 0) {
      const fp = layout.fp;
      return Math.abs(lx + 0.5 - fp.cx) <= MEIO_RUA || Math.abs(ly + 0.5 - fp.cy) <= MEIO_RUA;
    }
    return mascara.tipo[idx] === MASK_RUA;
  }
  const fp = layout.fp;
  return Math.abs(lx + 0.5 - fp.cx) <= MEIO_RUA || Math.abs(ly + 0.5 - fp.cy) <= MEIO_RUA;
}
