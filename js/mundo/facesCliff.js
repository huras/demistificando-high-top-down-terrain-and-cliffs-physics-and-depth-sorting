import { CHUNK_Y, RAIO_CORPO } from "../config.js";
import { alturaEm, dentroDoMapa, quedaVisualFace } from "./altura.js";
import { obterBloco } from "./voxel/storeMundo.js";
import { ehSolido } from "./voxel/tiposBloco.js";

/** Alcance pra grudar na face (células). */
const ALCANCE = 0.55;

/**
 * Probe O(1) — face climbável mais próxima do corpo.
 * Inclui cliffs de superfície e paredes internas (caverna).
 */
export function encontrarFacePerto(x, y, zRef) {
  const cx0 = Math.floor(x);
  const cy0 = Math.floor(y);
  let melhor = null;
  let melhorScore = Infinity;

  for (let cy = cy0 - 1; cy <= cy0 + 1; cy++) {
    for (let cx = cx0 - 1; cx <= cx0 + 1; cx++) {
      if (!dentroDoMapa(cx, cy)) continue;

      // Faces de superfície (heightmap)
      const zTopo = alturaEm(cx, cy);
      if (zTopo > 0) {
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

      // Paredes voxel internas perto da elevação
      considerarFacesVoxel(cx, cy, x, y, zRef, (f, s) => {
        if (s < melhorScore) {
          melhorScore = s;
          melhor = f;
        }
      });
    }
  }

  return melhor;
}

/** True se a célula tem face climbável naquele lado (superfície ou voxel). */
export function faceClimbavel(lado, cx, cy, zRef = null) {
  if (!dentroDoMapa(cx, cy)) return null;
  const dir = dirDoLado(lado);
  if (!dir) return null;

  // Preferência: face de superfície clássica
  const zTopo = alturaEm(cx, cy);
  if (zTopo > 0) {
    const queda = quedaVisualFace(cx, cy, dir.dx, dir.dy);
    if (queda >= 1) {
      const zBase = zTopo - queda;
      if (zRef == null || (zRef >= zBase - 0.5 && zRef <= zTopo + 0.5)) {
        return montarFace(lado, cx, cy, zBase, zTopo);
      }
    }
  }

  // Fallback: run sólido com ar no vizinho
  const run = runSolidoExposto(lado, cx, cy, zRef);
  if (!run) return null;
  return montarFace(lado, cx, cy, run.zBase, run.zTopo);
}

/**
 * Contíguo de sólidos em (cx,cy) com ar no vizinho do lado.
 * Se zRef != null, escolhe o run que contém / mais perto de zRef.
 */
function runSolidoExposto(lado, cx, cy, zRef = null) {
  const dir = dirDoLado(lado);
  if (!dir) return null;
  const nx = cx + dir.dx;
  const ny = cy + dir.dy;

  /** @type {{ zBase: number, zTopo: number }[]} */
  const runs = [];
  let z0 = null;
  for (let z = 0; z < CHUNK_Y; z++) {
    const solido = ehSolido(obterBloco(cx, cy, z));
    const vizAr = !ehSolido(obterBloco(nx, ny, z));
    if (solido && vizAr) {
      if (z0 == null) z0 = z;
    } else if (z0 != null) {
      runs.push({ zBase: z0, zTopo: z });
      z0 = null;
    }
  }
  if (z0 != null) runs.push({ zBase: z0, zTopo: CHUNK_Y });

  if (!runs.length) return null;
  if (zRef == null) {
    // Maior face
    let best = runs[0];
    for (const r of runs) {
      if (r.zTopo - r.zBase > best.zTopo - best.zBase) best = r;
    }
    return best.zTopo - best.zBase >= 1 ? best : null;
  }

  let best = null;
  let bestD = Infinity;
  for (const r of runs) {
    if (r.zTopo - r.zBase < 1) continue;
    if (zRef >= r.zBase - 0.35 && zRef <= r.zTopo + 0.35) {
      return r;
    }
    const mid = (r.zBase + r.zTopo) * 0.5;
    const d = Math.abs(mid - zRef);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

function considerarFacesVoxel(cx, cy, x, y, zRef, aceitar) {
  for (const lado of ["s", "n", "w", "e"]) {
    const run = runSolidoExposto(lado, cx, cy, zRef);
    if (!run) continue;
    if (zRef > run.zTopo - 0.05) continue;
    if (zRef < run.zBase - 0.4) continue;

    if (lado === "s") {
      const lipY = cy + 1;
      const ax = clamp(x, cx + RAIO_CORPO, cx + 1 - RAIO_CORPO);
      const dy = y - lipY;
      if (dy < -0.15 || dy > ALCANCE + 0.35) continue;
      const dx = x - (cx + 0.5);
      if (Math.abs(dx) > 0.65) continue;
      const score = Math.abs(dy) + Math.abs(dx) * 0.35 - dy * 0.5 + 0.05;
      aceitar(
        montarFace("s", cx, cy, run.zBase, run.zTopo, ax, lipY + 0.02),
        score,
      );
    } else if (lado === "n") {
      const lipY = cy;
      const ax = clamp(x, cx + RAIO_CORPO, cx + 1 - RAIO_CORPO);
      const dy = lipY - y;
      if (dy < -0.15 || dy > ALCANCE + 0.35) continue;
      const dx = x - (cx + 0.5);
      if (Math.abs(dx) > 0.65) continue;
      const score = Math.abs(dy) + Math.abs(dx) * 0.35 - dy * 0.5 + 0.05;
      aceitar(
        montarFace("n", cx, cy, run.zBase, run.zTopo, ax, lipY - 0.02),
        score,
      );
    } else if (lado === "w") {
      const lipX = cx;
      const ay = clamp(y, cy + RAIO_CORPO, cy + 1 - RAIO_CORPO);
      const dx = lipX - x;
      if (dx < -0.15 || dx > ALCANCE + 0.35) continue;
      const dy = y - (cy + 0.5);
      if (Math.abs(dy) > 0.65) continue;
      const score = Math.abs(dx) + Math.abs(dy) * 0.35 - dx * 0.5 + 0.05;
      aceitar(
        montarFace("w", cx, cy, run.zBase, run.zTopo, lipX - 0.02, ay),
        score,
      );
    } else {
      const lipX = cx + 1;
      const ay = clamp(y, cy + RAIO_CORPO, cy + 1 - RAIO_CORPO);
      const dx = x - lipX;
      if (dx < -0.15 || dx > ALCANCE + 0.35) continue;
      const dy = y - (cy + 0.5);
      if (Math.abs(dy) > 0.65) continue;
      const score = Math.abs(dx) + Math.abs(dy) * 0.35 - dx * 0.5 + 0.05;
      aceitar(
        montarFace("e", cx, cy, run.zBase, run.zTopo, lipX + 0.02, ay),
        score,
      );
    }
  }
}

function dirDoLado(lado) {
  if (lado === "s") return { dx: 0, dy: 1 };
  if (lado === "n") return { dx: 0, dy: -1 };
  if (lado === "w") return { dx: -1, dy: 0 };
  if (lado === "e") return { dx: 1, dy: 0 };
  return null;
}

/** Base da face (vizinho heightmap, limitada à espessura do topo em overhang). */
function zBaseFace(cx, cy, dx, dy, zTopo) {
  const queda = quedaVisualFace(cx, cy, dx, dy);
  if (queda < 1) return null;
  return zTopo - queda;
}

/**
 * Após mover na parede: canto (convex/côncavo), mesma face, ou vizinha reta.
 * `latDir` = sinal do movimento lateral (força canto perto da aresta).
 */
export function resolverFaceAposMovimento(x, y, elev, faceAtual, latDir = 0) {
  if (!faceAtual) return null;

  const canto = primeiraFaceOk(candidatosNoCanto(faceAtual, x, y, latDir), elev);
  if (canto) return canto;

  if (pontoNaFaixaFace(faceAtual.lado, faceAtual.cx, faceAtual.cy, x, y)) {
    const f = faceClimbavel(faceAtual.lado, faceAtual.cx, faceAtual.cy, elev);
    if (f && elevacaoOk(f, elev)) return f;
  }

  const viz = vizinhoMesmoLado(faceAtual, x, y, elev);
  if (viz && elevacaoOk(viz, elev)) return viz;

  return null;
}

function elevacaoOk(face, elev) {
  return elev >= face.zBase + 0.02 && elev <= face.zTopo + 0.01;
}

function primeiraFaceOk(candidatas, elev) {
  for (let i = 0; i < candidatas.length; i++) {
    const f = candidatas[i];
    if (f && elevacaoOk(f, elev)) return f;
  }
  return null;
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

function vizinhoMesmoLado(face, x, y, elev) {
  const lado = face.lado;
  if (lado === "s" || lado === "n") {
    for (const cx of [Math.floor(x), Math.floor(x) - 1, Math.floor(x) + 1]) {
      if (cx === face.cx) continue;
      const f = faceClimbavel(lado, cx, face.cy, elev);
      if (f) return f;
    }
    return null;
  }
  for (const cy of [Math.floor(y), Math.floor(y) - 1, Math.floor(y) + 1]) {
    if (cy === face.cy) continue;
    const f = faceClimbavel(lado, face.cx, cy, elev);
    if (f) return f;
  }
  return null;
}

function candidatosNoCanto(face, x, y, latDir) {
  const { lado, cx, cy } = face;
  const s = Math.sign(latDir || 0);
  const A = 0.55;
  const out = [];
  const elev = (face.zBase + face.zTopo) * 0.5;

  const push = (...faces) => {
    for (let i = 0; i < faces.length; i++) {
      if (faces[i]) out.push(faces[i]);
    }
  };

  if (lado === "s") {
    if (x >= cx + 1 || (x >= cx + A && s > 0)) {
      push(
        faceClimbavel("e", cx, cy, elev),
        faceClimbavel("s", cx + 1, cy, elev),
        faceClimbavel("w", cx + 1, cy + 1, elev),
        faceClimbavel("w", cx + 1, cy, elev),
      );
    }
    if (x <= cx || (x <= cx + 1 - A && s < 0)) {
      push(
        faceClimbavel("w", cx, cy, elev),
        faceClimbavel("s", cx - 1, cy, elev),
        faceClimbavel("e", cx - 1, cy + 1, elev),
        faceClimbavel("e", cx - 1, cy, elev),
      );
    }
  } else if (lado === "n") {
    if (x <= cx || (x <= cx + 1 - A && s > 0)) {
      push(
        faceClimbavel("w", cx, cy, elev),
        faceClimbavel("n", cx - 1, cy, elev),
        faceClimbavel("e", cx - 1, cy - 1, elev),
        faceClimbavel("e", cx - 1, cy, elev),
      );
    }
    if (x >= cx + 1 || (x >= cx + A && s < 0)) {
      push(
        faceClimbavel("e", cx, cy, elev),
        faceClimbavel("n", cx + 1, cy, elev),
        faceClimbavel("w", cx + 1, cy - 1, elev),
        faceClimbavel("w", cx + 1, cy, elev),
      );
    }
  } else if (lado === "e") {
    if (y <= cy || (y <= cy + 1 - A && s > 0)) {
      push(
        faceClimbavel("n", cx, cy, elev),
        faceClimbavel("e", cx, cy - 1, elev),
        faceClimbavel("s", cx + 1, cy - 1, elev),
        faceClimbavel("s", cx + 1, cy, elev),
      );
    }
    if (y >= cy + 1 || (y >= cy + A && s < 0)) {
      push(
        faceClimbavel("s", cx, cy, elev),
        faceClimbavel("e", cx, cy + 1, elev),
        faceClimbavel("n", cx + 1, cy + 1, elev),
        faceClimbavel("n", cx + 1, cy, elev),
      );
    }
  } else if (lado === "w") {
    if (y >= cy + 1 || (y >= cy + A && s > 0)) {
      push(
        faceClimbavel("s", cx, cy, elev),
        faceClimbavel("w", cx, cy + 1, elev),
        faceClimbavel("n", cx - 1, cy + 1, elev),
        faceClimbavel("n", cx - 1, cy, elev),
      );
    }
    if (y <= cy || (y <= cy + 1 - A && s < 0)) {
      push(
        faceClimbavel("n", cx, cy, elev),
        faceClimbavel("w", cx, cy - 1, elev),
        faceClimbavel("s", cx - 1, cy - 1, elev),
        faceClimbavel("s", cx - 1, cy, elev),
      );
    }
  }

  return out;
}

function considerarFaceSul(cx, cy, zTopo, x, y, zRef, aceitar) {
  const zBase = zBaseFace(cx, cy, 0, 1, zTopo);
  if (zBase == null) return;
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
  const zBase = zBaseFace(cx, cy, 0, -1, zTopo);
  if (zBase == null) return;
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
  const zBase = zBaseFace(cx, cy, -1, 0, zTopo);
  if (zBase == null) return;
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
  const zBase = zBaseFace(cx, cy, 1, 0, zTopo);
  if (zBase == null) return;
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
