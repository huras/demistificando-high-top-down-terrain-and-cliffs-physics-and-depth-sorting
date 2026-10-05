import { RAIO_CORPO } from "../config.js";
import { alturaEm, dentroDoMapa } from "./altura.js";

/** Alcance pra grudar na face (células). */
const ALCANCE = 0.55;

/**
 * Probe O(1) — face climbável mais próxima do corpo.
 * Normal aponta para fora (lado do jogador).
 * Lateral = direita do jogador quando ele olha PRA parede (-normal).
 */
export function encontrarFacePerto(x, y, zRef) {
  const cx0 = Math.floor(x);
  const cy0 = Math.floor(y);
  let melhor = null;
  let melhorScore = Infinity;

  for (let cy = cy0 - 1; cy <= cy0 + 1; cy++) {
    for (let cx = cx0 - 1; cx <= cx0 + 1; cx++) {
      if (!dentroDoMapa(cx, cy)) continue;
      const zTopo = alturaEm(cx, cy);
      if (zTopo <= 0) continue;

      considerarFaceSul(cx, cy, zTopo, x, y, zRef, (f, s) => {
        if (s < melhorScore) {
          melhorScore = s;
          melhor = f;
        }
      });
      considerarFaceNorte(cx, cy, zTopo, x, y, zRef, (f, s) => {
        if (s < melhorScore) {
          melhorScore = s;
          melhor = f;
        }
      });
      considerarFaceOeste(cx, cy, zTopo, x, y, zRef, (f, s) => {
        if (s < melhorScore) {
          melhorScore = s;
          melhor = f;
        }
      });
      considerarFaceLeste(cx, cy, zTopo, x, y, zRef, (f, s) => {
        if (s < melhorScore) {
          melhorScore = s;
          melhor = f;
        }
      });
    }
  }

  return melhor;
}

/** True se a célula tem face climbável naquele lado. */
export function faceClimbavel(lado, cx, cy) {
  if (!dentroDoMapa(cx, cy)) return null;
  const zTopo = alturaEm(cx, cy);
  if (zTopo <= 0) return null;
  let zBase = 0;
  if (lado === "s") zBase = alturaEm(cx, cy + 1);
  else if (lado === "n") zBase = alturaEm(cx, cy - 1);
  else if (lado === "w") zBase = alturaEm(cx - 1, cy);
  else if (lado === "e") zBase = alturaEm(cx + 1, cy);
  else return null;
  if (zTopo - zBase < 1) return null;
  return montarFace(lado, cx, cy, zBase, zTopo);
}

/**
 * Após mover na parede: canto (quina), mesma face, ou vizinha reta.
 * `latDir` = sinal do movimento lateral (força canto perto da aresta).
 */
export function resolverFaceAposMovimento(x, y, elev, faceAtual, latDir = 0) {
  if (!faceAtual) return null;

  // 1) canto externo primeiro — vira sem soltar (antes de “ficar na faixa”)
  const canto = faceNoCanto(faceAtual, x, y, latDir);
  if (canto && elevacaoOk(canto, elev)) return canto;

  // 2) ainda na célula atual?
  if (pontoNaFaixaFace(faceAtual.lado, faceAtual.cx, faceAtual.cy, x, y)) {
    const f = faceClimbavel(faceAtual.lado, faceAtual.cx, faceAtual.cy);
    if (f && elevacaoOk(f, elev)) return f;
  }

  // 3) vizinho no mesmo lado (continua a parede reta)
  const viz = vizinhoMesmoLado(faceAtual, x, y);
  if (viz && elevacaoOk(viz, elev)) return viz;

  return null;
}

function elevacaoOk(face, elev) {
  // folga ampla — não desgruda no canto por eps apertado
  return elev >= face.zBase + 0.02 && elev <= face.zTopo + 0.01;
}

function pontoNaFaixaFace(lado, cx, cy, x, y) {
  const pad = 0.12;
  if (lado === "s") {
    return x >= cx - pad && x <= cx + 1 + pad && y >= cy + 0.7 && y <= cy + 1.35;
  }
  if (lado === "n") {
    return x >= cx - pad && x <= cx + 1 + pad && y >= cy - 0.35 && y <= cy + 0.3;
  }
  if (lado === "w") {
    return y >= cy - pad && y <= cy + 1 + pad && x >= cx - 0.35 && x <= cx + 0.3;
  }
  if (lado === "e") {
    return y >= cy - pad && y <= cy + 1 + pad && x >= cx + 0.7 && x <= cx + 1.35;
  }
  return false;
}

function vizinhoMesmoLado(face, x, y) {
  const lado = face.lado;
  if (lado === "s" || lado === "n") {
    // pode estar em cx-1, cx ou cx+1
    for (const cx of [Math.floor(x), Math.floor(x) - 1, Math.floor(x) + 1]) {
      if (cx === face.cx) continue;
      const f = faceClimbavel(lado, cx, face.cy);
      if (f) return f;
    }
    return null;
  }
  for (const cy of [Math.floor(y), Math.floor(y) - 1, Math.floor(y) + 1]) {
    if (cy === face.cy) continue;
    const f = faceClimbavel(lado, face.cx, cy);
    if (f) return f;
  }
  return null;
}

/**
 * Canto externo do platô — só na quina (ou já passou da aresta).
 * Preferência: face perpendicular da MESMA célula (vira sem soltar).
 * Lateral: S +leste; N +oeste; E +norte; W +sul.
 */
function faceNoCanto(face, x, y, latDir) {
  const { lado, cx, cy } = face;
  const s = Math.sign(latDir || 0);
  const A = 0.55;

  if (lado === "s") {
    if (x >= cx + 1 || (x >= cx + A && s > 0)) {
      return faceClimbavel("e", cx, cy) || faceClimbavel("s", cx + 1, cy);
    }
    if (x <= cx || (x <= cx + 1 - A && s < 0)) {
      return faceClimbavel("w", cx, cy) || faceClimbavel("s", cx - 1, cy);
    }
  }
  if (lado === "n") {
    if (x <= cx || (x <= cx + 1 - A && s > 0)) {
      return faceClimbavel("w", cx, cy) || faceClimbavel("n", cx - 1, cy);
    }
    if (x >= cx + 1 || (x >= cx + A && s < 0)) {
      return faceClimbavel("e", cx, cy) || faceClimbavel("n", cx + 1, cy);
    }
  }
  if (lado === "e") {
    if (y <= cy || (y <= cy + 1 - A && s > 0)) {
      return faceClimbavel("n", cx, cy) || faceClimbavel("e", cx, cy - 1);
    }
    if (y >= cy + 1 || (y >= cy + A && s < 0)) {
      return faceClimbavel("s", cx, cy) || faceClimbavel("e", cx, cy + 1);
    }
  }
  if (lado === "w") {
    if (y >= cy + 1 || (y >= cy + A && s > 0)) {
      return faceClimbavel("s", cx, cy) || faceClimbavel("w", cx, cy + 1);
    }
    if (y <= cy || (y <= cy + 1 - A && s < 0)) {
      return faceClimbavel("n", cx, cy) || faceClimbavel("w", cx, cy - 1);
    }
  }
  return null;
}

function considerarFaceSul(cx, cy, zTopo, x, y, zRef, aceitar) {
  const zBase = alturaEm(cx, cy + 1);
  if (zTopo - zBase < 1) return;
  if (zRef > zTopo - 0.05) return;
  const lipY = cy + 1;
  const ax = clamp(x, cx + RAIO_CORPO, cx + 1 - RAIO_CORPO);
  const dy = y - lipY;
  if (dy < -0.15 || dy > ALCANCE + 0.35) return;
  const dx = x - (cx + 0.5);
  if (Math.abs(dx) > 0.65) return;
  const score = Math.abs(dy) + Math.abs(dx) * 0.35 - dy * 0.5;
  aceitar(montarFace("s", cx, cy, zBase, zTopo, ax, lipY + 0.02), score);
}

function considerarFaceNorte(cx, cy, zTopo, x, y, zRef, aceitar) {
  const zBase = alturaEm(cx, cy - 1);
  if (zTopo - zBase < 1) return;
  if (zRef > zTopo - 0.05) return;
  const lipY = cy;
  const ax = clamp(x, cx + RAIO_CORPO, cx + 1 - RAIO_CORPO);
  const dy = lipY - y;
  if (dy < -0.15 || dy > ALCANCE + 0.35) return;
  const dx = x - (cx + 0.5);
  if (Math.abs(dx) > 0.65) return;
  const score = Math.abs(dy) + Math.abs(dx) * 0.35 - dy * 0.5;
  aceitar(montarFace("n", cx, cy, zBase, zTopo, ax, lipY - 0.02), score);
}

function considerarFaceOeste(cx, cy, zTopo, x, y, zRef, aceitar) {
  const zBase = alturaEm(cx - 1, cy);
  if (zTopo - zBase < 1) return;
  if (zRef > zTopo - 0.05) return;
  const lipX = cx;
  const ay = clamp(y, cy + RAIO_CORPO, cy + 1 - RAIO_CORPO);
  const dx = lipX - x;
  if (dx < -0.15 || dx > ALCANCE + 0.35) return;
  const dy = y - (cy + 0.5);
  if (Math.abs(dy) > 0.65) return;
  const score = Math.abs(dx) + Math.abs(dy) * 0.35 - dx * 0.5;
  aceitar(montarFace("w", cx, cy, zBase, zTopo, lipX - 0.02, ay), score);
}

function considerarFaceLeste(cx, cy, zTopo, x, y, zRef, aceitar) {
  const zBase = alturaEm(cx + 1, cy);
  if (zTopo - zBase < 1) return;
  if (zRef > zTopo - 0.05) return;
  const lipX = cx + 1;
  const ay = clamp(y, cy + RAIO_CORPO, cy + 1 - RAIO_CORPO);
  const dx = x - lipX;
  if (dx < -0.15 || dx > ALCANCE + 0.35) return;
  const dy = y - (cy + 0.5);
  if (Math.abs(dy) > 0.65) return;
  const score = Math.abs(dx) + Math.abs(dy) * 0.35 - dx * 0.5;
  aceitar(montarFace("e", cx, cy, zBase, zTopo, lipX + 0.02, ay), score);
}

function montarFace(lado, cx, cy, zBase, zTopo, ancoraX, ancoraY) {
  let nx = 0;
  let ny = 0;
  if (lado === "s") ny = 1;
  else if (lado === "n") ny = -1;
  else if (lado === "w") nx = -1;
  else if (lado === "e") nx = 1;

  const latX = ny;
  const latY = -nx;

  let ax = ancoraX;
  let ay = ancoraY;
  if (ax == null || ay == null) {
    if (lado === "s") {
      ax = cx + 0.5;
      ay = cy + 1.02;
    } else if (lado === "n") {
      ax = cx + 0.5;
      ay = cy - 0.02;
    } else if (lado === "w") {
      ax = cx - 0.02;
      ay = cy + 0.5;
    } else {
      ax = cx + 1.02;
      ay = cy + 0.5;
    }
  }

  return {
    lado,
    cx,
    cy,
    zBase: Math.max(0, zBase),
    zTopo,
    normalX: nx,
    normalY: ny,
    lateralX: latX,
    lateralY: latY,
    latSign: 1,
    ancoraX: ax,
    ancoraY: ay,
  };
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
