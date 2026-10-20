import { ESCALA, TILE } from "../config.js";
import { alturaEm } from "../mundo/altura.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import { chaveEntidade, chaveTopo, empilhar } from "./ordenacaoProfundidade.js";

/** Ties: sombra sob o sprite; baixa < alta na mesma faixa. */
const TIE_SOMBRA_BAIXA = 2.5;
const TIE_SOMBRA_ALTA = 4.5;

/** Afastamento da parede pro blob da queda na escalada. */
const SOMBRA_QUEDA_OFF = 0.28;

/** Elipse em células de mundo (aprox.). */
const RX_MUNDO = 0.45;
const RY_MUNDO = 0.22;

/** Sombra logo acima do topo do tile, sem ultrapassar terraços vizinhos. */
const EPS_SOMBRA_NO_TOPO = 0.00015;
const EPS_SOMBRA_SOB_ALTO = 0.0002;

/**
 * Sombra dual: pedaço no chão dos pés + pedaço no nível abaixo na beirada.
 * A sombra baixa NUNCA ganha do topo do cliff (crítico na face de trás / ATRÁS,
 * onde o Y misturado ainda cai na célula alta e o AABB de tela sobrepõe).
 */
export function empilharSombras(lista, corpo) {
  // Escalando: só a elipse no chão da queda (onde cai se soltar), nunca na face
  if (corpo.escalando && corpo.escalada) {
    empilharSombraQuedaEscalada(lista, corpo);
    return;
  }

  const x = corpo.x;
  const y = corpo.y;
  const z = corpo.z;
  if (z <= 0) return;

  const { altos, baixos, zBaixo } = coletarToposPerto(x, y, z);

  if (!baixos.length || zBaixo === null) {
    empilhar(
      lista,
      chaveEntidade(y, z) - EPS_SOMBRA_NO_TOPO,
      0,
      (ctx) => desenharElipseSombra(ctx, x, y, z, 0.28),
      TIE_SOMBRA_ALTA,
      z,
    );
    return;
  }

  empilhar(
    lista,
    chaveEntidade(y, z) - EPS_SOMBRA_NO_TOPO,
    0,
    (ctx) => {
      ctx.save();
      clipTopos(ctx, altos);
      desenharElipseSombra(ctx, x, y, z, 0.3);
      ctx.restore();
    },
    TIE_SOMBRA_ALTA,
    z,
  );

  const proj = projetarNoChaoBaixo(x, y, baixos);
  empilhar(
    lista,
    chaveSombraBaixa(proj, altos),
    0,
    (ctx) => {
      ctx.save();
      clipTopos(ctx, baixos);
      desenharElipseSombra(ctx, proj.x, proj.y, proj.z, 0.22);
      ctx.restore();
    },
    TIE_SOMBRA_BAIXA,
    proj.z,
  );
}

/** Elipse no chão da queda (zBase), um pouco afastada da face. */
function empilharSombraQuedaEscalada(lista, corpo) {
  const e = corpo.escalada;
  const zChao = e.zBase > 0 ? e.zBase : 0;
  if (zChao <= 0) return;

  const x = corpo.x + (e.normalX || 0) * SOMBRA_QUEDA_OFF;
  const y = corpo.y + (e.normalY || 0) * SOMBRA_QUEDA_OFF;
  const cy = Math.floor(y);

  empilhar(
    lista,
    chaveTopo(cy, zChao) + EPS_SOMBRA_NO_TOPO,
    0,
    (ctx) => desenharElipseSombra(ctx, x, y, zChao, 0.26),
    TIE_SOMBRA_BAIXA,
    zChao,
  );
}

/**
 * Sort da sombra baixa: ancora no tile BAIXO real (não no y misturado).
 * Garante sortKey < qualquer topo alto vizinho — senão pinta “por cima” do terraço
 * na face de trás (AABB do chão z=0 em cy-1 ≡ topo z=1 em cy).
 */
function chaveSombraBaixa(proj, altos) {
  let key = chaveTopo(proj.cy, proj.z) + EPS_SOMBRA_NO_TOPO;

  for (let i = 0; i < altos.length; i++) {
    const a = altos[i];
    const teto = chaveTopo(a.cy, a.z) - EPS_SOMBRA_SOB_ALTO;
    if (key > teto) key = teto;
  }
  return key;
}

function coletarToposPerto(x, y, z) {
  const cx0 = Math.floor(x);
  const cy0 = Math.floor(y);
  const altos = [];
  const baixos = [];
  let zBaixo = null;

  for (let cy = cy0 - 1; cy <= cy0 + 1; cy++) {
    for (let cx = cx0 - 1; cx <= cx0 + 1; cx++) {
      const hz = alturaEm(cx, cy);
      if (hz <= 0) continue;
      if (!elipseTocaCelula(x, y, cx, cy)) continue;

      if (hz === z) {
        altos.push({ cx, cy, z: hz });
      } else if (hz < z) {
        baixos.push({ cx, cy, z: hz });
        zBaixo = zBaixo === null ? hz : Math.max(zBaixo, hz);
      }
    }
  }

  if (!altos.some((t) => t.cx === cx0 && t.cy === cy0)) {
    const hz = alturaEm(cx0, cy0);
    if (hz === z) altos.push({ cx: cx0, cy: cy0, z: hz });
  }

  if (zBaixo !== null) {
    return {
      altos,
      baixos: baixos.filter((t) => t.z === zBaixo),
      zBaixo,
    };
  }
  return { altos, baixos, zBaixo };
}

function elipseTocaCelula(x, y, cx, cy) {
  const px = clamp(x, cx, cx + 1);
  const py = clamp(y, cy, cy + 1);
  const dx = (px - x) / RX_MUNDO;
  const dy = (py - y) / RY_MUNDO;
  return dx * dx + dy * dy <= 1.05;
}

/** Centro da sombra baixa no tile inferior mais perto — guarda cx/cy do tile. */
function projetarNoChaoBaixo(x, y, baixos) {
  let melhor = baixos[0];
  let melhorD = Infinity;
  let mx = x;
  let my = y;

  for (let i = 0; i < baixos.length; i++) {
    const t = baixos[i];
    const px = clamp(x, t.cx, t.cx + 0.999);
    const py = clamp(y, t.cy, t.cy + 0.999);
    const d = (px - x) * (px - x) + (py - y) * (py - y);
    if (d < melhorD) {
      melhorD = d;
      melhor = t;
      mx = px;
      my = py;
    }
  }

  return {
    x: x * 0.35 + mx * 0.65,
    y: y * 0.35 + my * 0.65,
    z: melhor.z,
    cx: melhor.cx,
    cy: melhor.cy,
  };
}

function clipTopos(ctx, topos) {
  ctx.beginPath();
  const s = TILE * ESCALA;
  for (let i = 0; i < topos.length; i++) {
    const t = topos[i];
    const px = mundoParaTelaX(t.cx);
    const py = mundoParaTelaY(t.cy, t.z);
    ctx.rect(px, py, s, s);
  }
  ctx.clip();
}

function desenharElipseSombra(ctx, x, y, z, alpha) {
  const sx = mundoParaTelaX(x);
  const sy = mundoParaTelaY(y, z) - 2 * ESCALA;
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(sx, sy, 7 * ESCALA, 3 * ESCALA, 0, 0, Math.PI * 2);
  ctx.fill();
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
