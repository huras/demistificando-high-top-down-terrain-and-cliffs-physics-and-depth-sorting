import {
  ESCALA,
  FACE_H,
  FADE_COBERTURA_ALPHA,
  FADE_COBERTURA_ATIVO,
  FADE_COBERTURA_DELTA_Z_MIN,
  FADE_COBERTURA_RAIO,
  FADE_COBERTURA_RAIO_X,
  FADE_COBERTURA_RAIO_Y,
  FADE_COBERTURA_SOB_TETO,
  FADE_COBERTURA_VEL,
  TILE,
} from "../config.js";
import { tetoSobreCabeca } from "../fisica/colisao.js";
import { PROPS } from "../mundo/mapaDemo.js";
import { vegetacaoNaArea } from "../mundo/bioma/propsBioma.js";
import { alturaEm, quedaVisualFace } from "../mundo/altura.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import {
  chaveEntidade,
  chaveFaceLateral,
  chaveFaceSul,
  chaveTopo,
} from "./ordenacaoProfundidade.js";

/** @type {Map<string, { alpha: number, alvo: number }>} */
const fades = new Map();

/** Conjunto de chaves cobrindo neste frame (reusado pra evitar alloc). */
const cobrindoAgora = new Set();

/**
 * Janela circular de visão (coords de tela / mundo-pixel).
 * @type {{ cx: number, cy: number, r: number, r2: number } | null}
 */
let zonaFade = null;

const EPS_OPACO = 0.004;
const CLIP_MUNDO = 1e6;
const TAU = Math.PI * 2;

/**
 * Atualiza alvos de fade a partir do player e faz lerp temporal.
 * Chamar uma vez por frame 2D, antes de empilharTerreno.
 */
export function atualizarFadeCobertura(corpo, dt, atlas = null) {
  if (!FADE_COBERTURA_ATIVO) {
    cobrindoAgora.clear();
    zonaFade = null;
    fades.clear();
    return;
  }

  cobrindoAgora.clear();
  zonaFade = circuloVisaoPlayer(corpo);
  marcarPecasCobrindo(corpo, atlas);

  const t = 1 - Math.exp(-FADE_COBERTURA_VEL * Math.max(0, dt));
  const alphaAlvo = FADE_COBERTURA_ALPHA;

  for (const chave of cobrindoAgora) {
    let e = fades.get(chave);
    if (!e) {
      e = { alpha: 1, alvo: alphaAlvo };
      fades.set(chave, e);
    }
    e.alvo = alphaAlvo;
  }

  for (const [chave, e] of fades) {
    if (!cobrindoAgora.has(chave)) e.alvo = 1;
    e.alpha += (e.alvo - e.alpha) * t;
    if (e.alvo === 1 && e.alpha > 1 - EPS_OPACO) {
      fades.delete(chave);
    }
  }
}

/** Alpha atual da peça (1 = opaco). */
export function alphaCobertura(chave) {
  const e = fades.get(chave);
  return e ? e.alpha : 1;
}

/** Círculo de visão do fade (ou null). */
export function obterZonaFadeCobertura() {
  return zonaFade;
}

/**
 * Desenha opaco fora do raio do player; translúcido só dentro do círculo.
 */
export function desenharComFadeCobertura(ctx, chave, desenhar) {
  if (!FADE_COBERTURA_ATIVO) {
    desenhar();
    return;
  }

  const a = alphaCobertura(chave);
  if (a >= 1 - 1e-4) {
    desenhar();
    return;
  }

  const zona = zonaFade;
  if (!zona) {
    if (a <= 1e-3) return;
    ctx.save();
    ctx.globalAlpha *= a;
    desenhar();
    ctx.restore();
    return;
  }

  // Opaco com buraco circular na visão do player
  ctx.save();
  ctx.beginPath();
  ctx.rect(-CLIP_MUNDO, -CLIP_MUNDO, CLIP_MUNDO * 2, CLIP_MUNDO * 2);
  ctx.arc(zona.cx, zona.cy, zona.r, 0, TAU);
  ctx.clip("evenodd");
  desenhar();
  ctx.restore();

  // Translucido só no raio — dá pra ver o que acontece em volta
  if (a > 1e-3) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(zona.cx, zona.cy, zona.r, 0, TAU);
    ctx.clip();
    ctx.globalAlpha *= a;
    desenhar();
    ctx.restore();
  }
}

export function chaveFadeTopo(cx, cy) {
  return `t:${cx},${cy}`;
}

export function chaveFadeFaceSul(cx, cy) {
  return `fs:${cx},${cy}`;
}

export function chaveFadeLateral(cx, cy, lado) {
  return lado === "w" ? `fw:${cx},${cy}` : `fe:${cx},${cy}`;
}

export function chaveFadeProp(idx) {
  return `p:${idx}`;
}

function circuloVisaoPlayer(corpo) {
  const r = FADE_COBERTURA_RAIO * TILE * ESCALA;
  const cx = mundoParaTelaX(corpo.x);
  // Centro no tronco (acima dos pés) — raio cobre cabeça + chão local
  const pyPes = mundoParaTelaY(corpo.y, corpo.z, corpo.hopLift);
  const cy = pyPes - r * 0.42;
  return { cx, cy, r, r2: r * r };
}

function marcarPecasCobrindo(corpo, atlas) {
  const sortPlayer = chaveEntidade(corpo.y, corpo.z);
  const zona = zonaFade;
  if (!zona) return;

  const peX = Math.floor(corpo.x);
  const peY = Math.floor(corpo.y);
  const zPe = corpo.z | 0;
  const elev = corpo.elevacao ?? zPe + (corpo.hopLift || 0);

  const tetoPlayer = tetoSobreCabeca(peX, peY, elev);
  const modoCaverna =
    FADE_COBERTURA_SOB_TETO && Number.isFinite(tetoPlayer);

  // Ao ar livre: ignora cliffs baixos. Na caverna: fade o teto local mesmo perto.
  const zMinFade = modoCaverna ? zPe : zPe + FADE_COBERTURA_DELTA_Z_MIN;

  const x0 = peX - FADE_COBERTURA_RAIO_X;
  const x1 = peX + FADE_COBERTURA_RAIO_X;
  const y0 = peY - FADE_COBERTURA_RAIO_Y;
  const y1 = peY + FADE_COBERTURA_RAIO_Y;

  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const z = alturaEm(cx, cy);
      if (z <= 0 || z <= zMinFade) continue;

      // Caverna: só colunas cujo teto está acima do player (teto local).
      // Exterior de cima (cume, árvores no deck) fica opaco.
      if (modoCaverna && !colunaEhTetoLocal(cx, cy, elev)) continue;

      if (!(cx === peX && cy === peY && z === zPe)) {
        if (chaveTopo(cy, z) > sortPlayer) {
          if (aabbTocaCirculo(aabbTopo(cx, cy, z), zona)) {
            cobrindoAgora.add(chaveFadeTopo(cx, cy));
          }
        }
      }

      const quedaS = quedaVisualFace(cx, cy, 0, 1);
      if (quedaS > 0 && chaveFaceSul(cy, quedaS, z) > sortPlayer) {
        if (aabbTocaCirculo(aabbFaceSul(cx, cy, z, quedaS), zona)) {
          cobrindoAgora.add(chaveFadeFaceSul(cx, cy));
        }
      }

      const dzW = quedaVisualFace(cx, cy, -1, 0);
      if (dzW > 0 && chaveFaceLateral(cy, z) > sortPlayer) {
        if (aabbTocaCirculo(aabbLateral(cx, cy, z, dzW, "w"), zona)) {
          cobrindoAgora.add(chaveFadeLateral(cx, cy, "w"));
        }
      }

      const dzE = quedaVisualFace(cx, cy, 1, 0);
      if (dzE > 0 && chaveFaceLateral(cy, z) > sortPlayer) {
        if (aabbTocaCirculo(aabbLateral(cx, cy, z, dzE, "e"), zona)) {
          cobrindoAgora.add(chaveFadeLateral(cx, cy, "e"));
        }
      }
    }
  }

  // Props: só ao ar livre (em cima do deck = mundo de cima).
  if (modoCaverna) return;

  for (let i = 0; i < PROPS.length; i++) {
    const prop = PROPS[i];
    if (prop.tipo === "placa") continue;
    const px = Math.floor(prop.x);
    const py = Math.floor(prop.y);
    if (px < x0 || px > x1 || py < y0 - 2 || py > y1 + 2) continue;
    const z = alturaEm(px, py);
    if (z <= zMinFade) continue;
    const sk = chaveEntidade(prop.y, z);
    if (sk <= sortPlayer) continue;
    const box = aabbProp(prop, z, atlas);
    if (!box) continue;
      if (aabbTocaCirculo(box, zona)) {
      cobrindoAgora.add(chaveFadeProp(i));
    }
  }

  const plantas = vegetacaoNaArea(x0, y0, x1, y1);
  for (let i = 0; i < plantas.length; i++) {
    const prop = plantas[i];
    const z = alturaEm(Math.floor(prop.x), Math.floor(prop.y));
    if (z <= zMinFade) continue;
    const sk = chaveEntidade(prop.y, z);
    if (sk <= sortPlayer) continue;
    const box = aabbProp(prop, z, atlas);
    if (!box) continue;
    if (aabbTocaCirculo(box, zona)) cobrindoAgora.add(`pb:${prop.id}`);
  }
}

/** True se há sólido acima da elevação nesta coluna (player está sob ela). */
function colunaEhTetoLocal(cx, cy, elev) {
  const teto = tetoSobreCabeca(cx, cy, elev);
  return Number.isFinite(teto) && elev < teto;
}

function aabbTopo(cx, cy, z) {
  const s = TILE * ESCALA;
  const px = mundoParaTelaX(cx);
  const py = mundoParaTelaY(cy, z);
  return { x0: px, y0: py, x1: px + s, y1: py + s };
}

function aabbFaceSul(cx, cy, z, queda) {
  const w = TILE * ESCALA;
  const h = queda * FACE_H * ESCALA;
  const px = mundoParaTelaX(cx);
  const topY = mundoParaTelaY(cy, z);
  const py = topY + TILE * ESCALA - 1;
  return { x0: px, y0: py, x1: px + w, y1: py + h };
}

function aabbLateral(cx, cy, z, queda, lado) {
  const s = TILE * ESCALA;
  const h = queda * FACE_H * ESCALA;
  const faixa = Math.max(5, ESCALA * 3);
  const px = mundoParaTelaX(cx);
  const topY = mundoParaTelaY(cy, z);
  const x = lado === "w" ? px : px + s - faixa;
  const y0 = topY + s;
  return { x0: x, y0, x1: x + faixa, y1: y0 + h };
}

function aabbProp(prop, z, atlas) {
  const px = mundoParaTelaX(prop.x);
  const py = mundoParaTelaY(prop.y, z);

  if (prop.tipo === "arvore") {
    const img = atlas?.arvore;
    if (img) {
      const dw = img.width * ESCALA;
      const dh = img.height * ESCALA;
      return {
        x0: px - dw * 0.5,
        y0: py - dh + 2 * ESCALA,
        x1: px + dw * 0.5,
        y1: py + 2 * ESCALA,
      };
    }
    return { x0: px - 14, y0: py - 34, x1: px + 14, y1: py + 2 };
  }

  if (prop.tipo === "mata") {
    const img = atlas?.mata;
    if (img) {
      const dw = img.width * ESCALA * 1.5;
      const dh = img.height * ESCALA * 1.5;
      return {
        x0: px - dw * 0.5,
        y0: py - dh + ESCALA,
        x1: px + dw * 0.5,
        y1: py + ESCALA,
      };
    }
    return { x0: px - 10, y0: py - 16, x1: px + 10, y1: py + 2 };
  }

  return null;
}

/** AABB ∩ círculo (ponto mais próximo do centro no retângulo). */
function aabbTocaCirculo(box, zona) {
  const qx = clamp(zona.cx, box.x0, box.x1);
  const qy = clamp(zona.cy, box.y0, box.y1);
  const dx = zona.cx - qx;
  const dy = zona.cy - qy;
  return dx * dx + dy * dy < zona.r2;
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
