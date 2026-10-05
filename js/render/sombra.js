import { ESCALA, TILE } from "../config.js";
import { alturaEm } from "../mundo/altura.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import { chaveEntidade, chaveTopo, empilhar } from "./ordenacaoProfundidade.js";

const TIE_SOMBRA_BAIXA = 2.5;
const TIE_SOMBRA_ALTA = 4.5;

/** Raio da elipse em células de mundo (aprox.). */
const RX_MUNDO = 0.45;
const RY_MUNDO = 0.22;

/**
 * Sombra no chão atual +, se estiver na beirada, pedaço no chão de baixo
 * (nunca em terreno mais alto que os pés).
 */
export function empilharSombras(lista, corpo) {
  const x = corpo.x;
  const y = corpo.y;
  const z = corpo.z;
  if (z <= 0) return;

  const { altos, baixos, zBaixo } = coletarToposPerto(x, y, z);

  if (!baixos.length || zBaixo === null) {
    empilhar(
      lista,
      chaveEntidade(y, z) - EPS_SOMBRA,
      0,
      (ctx) => desenharElipseSombra(ctx, x, y, z, 0.28),
      TIE_SOMBRA_ALTA,
      z,
    );
    return;
  }

  // pedaço no terraço / chão onde está
  empilhar(
    lista,
    chaveEntidade(y, z) - EPS_SOMBRA,
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

  // pedaço projetado no chão onde cairia (nível abaixo)
  const proj = projetarNoChaoBaixo(x, y, baixos);
  empilhar(
    lista,
    chaveTopo(Math.floor(proj.y), zBaixo) + 0.005,
    0,
    (ctx) => {
      ctx.save();
      clipTopos(ctx, baixos);
      desenharElipseSombra(ctx, proj.x, proj.y, zBaixo, 0.22);
      ctx.restore();
    },
    TIE_SOMBRA_BAIXA,
    zBaixo,
  );
}

const EPS_SOMBRA = 0.0002;

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

      // só células que a elipse pode tocar
      if (!elipseTocaCelula(x, y, cx, cy)) continue;

      // nunca projeta sombra em terreno mais alto que os pés
      if (hz === z) {
        altos.push({ cx, cy, z: hz });
      } else if (hz < z) {
        baixos.push({ cx, cy, z: hz });
        zBaixo = zBaixo === null ? hz : Math.max(zBaixo, hz);
      }
    }
  }

  // garante o topo sob os pés
  if (!altos.some((t) => t.cx === cx0 && t.cy === cy0)) {
    const hz = alturaEm(cx0, cy0);
    if (hz === z) altos.push({ cx: cx0, cy: cy0, z: hz });
  }

  // sombra baixa só no nível imediatamente abaixo (nunca “acima”)
  if (zBaixo !== null) {
    const filtrados = baixos.filter((t) => t.z === zBaixo);
    return { altos, baixos: filtrados, zBaixo };
  }
  return { altos, baixos, zBaixo };
}

function elipseTocaCelula(x, y, cx, cy) {
  // ponto da célula mais perto dos pés
  const px = clamp(x, cx, cx + 1);
  const py = clamp(y, cy, cy + 1);
  const dx = (px - x) / RX_MUNDO;
  const dy = (py - y) / RY_MUNDO;
  return dx * dx + dy * dy <= 1.05;
}

/** Puxa o centro da sombra baixa pro ponto do chão inferior mais perto dos pés. */
function projetarNoChaoBaixo(x, y, baixos) {
  let melhor = baixos[0];
  let melhorD = Infinity;
  let mx = x;
  let my = y;

  for (const t of baixos) {
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

  // mistura: ainda perto dos pés, mas já no tile de baixo
  return {
    x: x * 0.35 + mx * 0.65,
    y: y * 0.35 + my * 0.65,
    z: melhor.z,
  };
}

function clipTopos(ctx, topos) {
  ctx.beginPath();
  const s = TILE * ESCALA;
  for (const t of topos) {
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
