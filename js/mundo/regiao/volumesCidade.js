/**
 * Lotes e volumes de prédio. A colisão é a coluna do chunk carregado;
 * o layout em si é só conta, sem malha.
 */
import { ajusteDe } from "../cidade/ajustesColisor.js";
import { idDaCasa } from "../cidade/catalogoCasas.js";

/** casa-2 e casa-4 não têm porta. Igual red-house-2/4. */
const FOLHAS_SEM_PORTA = new Set([2, 4]);

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
  let casas = 0;
  for (let i = 0; i < n; i++) {
    const lote = ordem[i];
    const papel = papelDe(def, i, n);
    const variante = papel === "casa" ? varianteCasa(casas) : 0;
    let modelo = null;
    let cartao = false;
    let folha = 0;
    if (papel === "casa") {
      cartao = def.key === "pallet-town" && (casas % 2) === 1;
      if (cartao) folha = (casas % 5) + 1;
      modelo = idDaCasa(def.key, casas++);
    } else if (papel === "centro" || papel === "loja" || papel === "lab") modelo = papel;
    volumes.push({
      x0: lote.x0,
      y0: lote.y0,
      x1: lote.x1,
      y1: lote.y1,
      altura: ALTURA[papel] || ALTURA.casa,
      papel,
      variante,
      modelo,
      cartao,
      folha,
      porta: !(cartao && FOLHAS_SEM_PORTA.has(folha)),
    });
  }
  return { fp, volumes };
}

function yawDaFrente(v) {
  if (v.cartao || v.papel === "casa" || v.papel === "lab") return 0;
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

/** Caixa do editor, no espaço do lote. O giro da rua entra aqui. */
export function projetarCaixa(v, caixa) {
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

/** Quintal em volta do laboratório, pra o mato não entrar no lote. */
export function naEntradaDoLab(lx, ly, layout) {
  const lista = layout?.volumes;
  if (!lista) return false;
  for (let i = 0; i < lista.length; i++) {
    const v = lista[i];
    if (v.papel !== "lab") continue;
    if (lx >= v.x0 - 2 && lx < v.x1 + 2 && ly >= v.y0 - 1 && ly < v.y1 + 6) return true;
  }
  return false;
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
