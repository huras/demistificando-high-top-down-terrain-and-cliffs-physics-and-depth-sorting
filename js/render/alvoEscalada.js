import { ESCALA, TILE } from "../config.js";
import { encontrarFacePerto } from "../mundo/facesCliff.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import { chaveTopo, empilhar } from "./ordenacaoProfundidade.js";

/** Evita flicker nas bordas de tile (escalada lateral). */
const HISTERESE = 0.22;
const TROCA_MS = 90;
const LERP_VISUAL = 14;

let sticky = null; // { cx, cy, z, cand, candDesde }
let visual = null; // { x, y, z } mundo contínuo pro desenho

/**
 * Tile de topo do mantle — estável nas bordas; posição visual suavizada.
 */
export function consultarAlvoEscalada(corpo) {
  const bruto = detectarAlvoBruto(corpo);
  const agora = performance.now();

  if (!bruto) {
    sticky = null;
    visual = null;
    return null;
  }

  if (!sticky) {
    sticky = { cx: bruto.cx, cy: bruto.cy, z: bruto.z, cand: null, candDesde: 0 };
    visual = { x: bruto.cx + 0.5, y: bruto.cy + 0.5, z: bruto.z };
    return alvoComVisual();
  }

  const mesmo =
    sticky.cx === bruto.cx && sticky.cy === bruto.cy && sticky.z === bruto.z;

  if (mesmo) {
    sticky.cand = null;
    return alvoComVisual();
  }

  // candidato novo — só troca depois de estável um tempo
  if (
    !sticky.cand ||
    sticky.cand.cx !== bruto.cx ||
    sticky.cand.cy !== bruto.cy ||
    sticky.cand.z !== bruto.z
  ) {
    sticky.cand = { cx: bruto.cx, cy: bruto.cy, z: bruto.z };
    sticky.candDesde = agora;
    return alvoComVisual();
  }

  if (agora - sticky.candDesde >= TROCA_MS) {
    sticky.cx = sticky.cand.cx;
    sticky.cy = sticky.cand.cy;
    sticky.z = sticky.cand.z;
    sticky.cand = null;
  }

  return alvoComVisual();
}

function alvoComVisual() {
  if (!sticky) return null;
  return {
    cx: sticky.cx,
    cy: sticky.cy,
    z: sticky.z,
    x: visual?.x ?? sticky.cx + 0.5,
    y: visual?.y ?? sticky.cy + 0.5,
    vz: visual?.z ?? sticky.z,
  };
}

/** Avança o lerp visual — chamar 1× por frame (2D ou 3D). */
export function atualizarVisualAlvoEscalada(corpo, dt = 1 / 60) {
  const alvo = consultarAlvoEscalada(corpo);
  if (!alvo || !sticky) {
    visual = null;
    return null;
  }

  const tx = sticky.cx + 0.5;
  const ty = sticky.cy + 0.5;
  const tz = sticky.z;

  if (!visual) {
    visual = { x: tx, y: ty, z: tz };
  } else {
    const t = 1 - Math.exp(-LERP_VISUAL * dt);
    visual.x += (tx - visual.x) * t;
    visual.y += (ty - visual.y) * t;
    visual.z += (tz - visual.z) * t;
  }

  return {
    cx: sticky.cx,
    cy: sticky.cy,
    z: sticky.z,
    x: visual.x,
    y: visual.y,
    vz: visual.z,
  };
}

function detectarAlvoBruto(corpo) {
  if (!corpo) return null;

  if (corpo.mantle) {
    return { cx: corpo.mantle.cx, cy: corpo.mantle.cy, z: corpo.mantle.zTopo };
  }

  if (corpo.escalando && corpo.escalada) {
    return alvoNaEscalada(corpo);
  }

  if ((corpo.stamina ?? 0) <= 1e-4) return null;

  const zRef = corpo.noChao ? corpo.z : (corpo.elevacao ?? corpo.z);
  const face = encontrarFacePerto(corpo.x, corpo.y, zRef);
  if (!face) return null;

  return { cx: face.cx, cy: face.cy, z: face.zTopo };
}

/**
 * Durante a escalada: célula do topo pela posição lateral com histerese,
 * sem oscilar em cima da aresta do tile.
 */
function alvoNaEscalada(corpo) {
  const e = corpo.escalada;
  const z = e.zTopo;
  const baseCx = sticky?.cx ?? e.cx;
  const baseCy = sticky?.cy ?? e.cy;

  if (e.lado === "s" || e.lado === "n") {
    // lateral = eixo X; a face fica na linha cy
    return {
      cx: celulaComHisterese(corpo.x, baseCx),
      cy: e.cy,
      z,
    };
  }

  // leste / oeste: lateral = eixo Y
  return {
    cx: e.cx,
    cy: celulaComHisterese(corpo.y, baseCy),
    z,
  };
}

/** Só troca de célula depois de passar bem do centro (+/− histerese). */
function celulaComHisterese(pos, cellAtual) {
  const c = Math.floor(pos);
  if (c === cellAtual) return cellAtual;

  if (c > cellAtual) {
    // indo pra direita/sul — espera ultrapassar 0.5 + histerese
    return pos >= cellAtual + 0.5 + HISTERESE ? c : cellAtual;
  }
  // indo pra esquerda/norte
  return pos < cellAtual + 0.5 - HISTERESE ? c : cellAtual;
}

export function empilharAlvoEscalada(lista, corpo, dt = 1 / 60) {
  const alvo = atualizarVisualAlvoEscalada(corpo, dt);
  if (!alvo) return null;

  const sortKey = chaveTopo(alvo.cy, alvo.z);
  empilhar(
    lista,
    sortKey,
    0,
    (ctx) => desenharCirculoAlvo(ctx, alvo),
    12,
    alvo.z,
  );
  return alvo;
}

function desenharCirculoAlvo(ctx, alvo) {
  const sx = mundoParaTelaX(alvo.x);
  const sy = mundoParaTelaY(alvo.y, alvo.vz ?? alvo.z);
  const base = TILE * ESCALA * 0.38;
  const pulso = 0.92 + 0.08 * Math.sin(performance.now() * 0.006);
  const r = base * pulso;

  ctx.save();
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(125, 206, 106, 0.28)";
  ctx.fill();
  ctx.strokeStyle = "rgba(200, 255, 170, 0.95)";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(sx, sy, r * 0.45, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(125, 206, 106, 0.7)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}
