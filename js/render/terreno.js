import { ESCALA, FACE_H, TILE } from "../config.js";
import { alturaEm, quedaSul } from "../mundo/altura.js";
import { ALTURAS, COLUNAS, LINHAS, PROPS } from "../mundo/mapaDemo.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import { chaveProfundidade, empilhar } from "./ordenacaoProfundidade.js";
import { bordaDoTopo, CORES, coresDoTopo } from "./paleta.js";

/**
 * Fallback de cubos legível:
 * - cor do topo muda com z (chão / terraço / mirante)
 * - borda em todo lado exposto (N/E/S/W)
 * - face sul + laterais W/E quando há queda
 */
export function empilharTerreno(lista, _atlas, debug) {
  for (let cy = 0; cy < LINHAS; cy++) {
    for (let cx = 0; cx < COLUNAS; cx++) {
      const z = ALTURAS[cy][cx];
      if (z <= 0) continue;

      const sortTop = chaveProfundidade(cy + 0.99, z);
      empilhar(lista, sortTop, 0, (ctx) => desenharTopo(ctx, cx, cy, z), 0);

      const quedaS = quedaSul(cx, cy);
      if (quedaS > 0) {
        empilhar(
          lista,
          chaveProfundidade(cy + 0.995, z),
          0,
          (ctx) => desenharFaceSul(ctx, cx, cy, z, quedaS),
          1,
        );
      }

      const dzW = z - alturaEm(cx - 1, cy);
      const dzE = z - alturaEm(cx + 1, cy);
      if (dzW > 0) {
        empilhar(
          lista,
          chaveProfundidade(cy + 0.992, z),
          0,
          (ctx) => desenharFaceLateral(ctx, cx, cy, z, dzW, "w"),
          2,
        );
      }
      if (dzE > 0) {
        empilhar(
          lista,
          chaveProfundidade(cy + 0.992, z),
          0,
          (ctx) => desenharFaceLateral(ctx, cx, cy, z, dzE, "e"),
          2,
        );
      }

      if (debug) {
        empilhar(lista, sortTop + 0.0001, 2, (ctx) => desenharDebug(ctx, cx, cy, z), 9);
      }
    }
  }

  for (const prop of PROPS) {
    const z = alturaEm(Math.floor(prop.x), Math.floor(prop.y));
    empilhar(
      lista,
      chaveProfundidade(prop.y, z),
      1,
      (ctx) => desenharProp(ctx, prop, z),
      2,
    );
  }
}

function desenharTopo(ctx, cx, cy, z) {
  const px = mundoParaTelaX(cx);
  const py = mundoParaTelaY(cy, z);
  const s = TILE * ESCALA;
  const cores = coresDoTopo(z);

  ctx.fillStyle = (cx + cy) & 1 ? cores.a : cores.b;
  ctx.fillRect(px, py, s, s);

  ctx.fillStyle = CORES.grade;
  ctx.fillRect(px, py + s - 1, s, 1);
  ctx.fillRect(px + s - 1, py, 1, s);

  // contorno em todo lado mais baixo que este cubo
  const n = alturaEm(cx, cy - 1) < z;
  const sEdge = alturaEm(cx, cy + 1) < z;
  const w = alturaEm(cx - 1, cy) < z;
  const e = alturaEm(cx + 1, cy) < z;
  const f = Math.max(2, ESCALA);
  const borda = bordaDoTopo(z);

  ctx.fillStyle = borda;
  if (n) ctx.fillRect(px, py, s, f);
  if (sEdge) ctx.fillRect(px, py + s - f, s, f);
  if (w) ctx.fillRect(px, py, f, s);
  if (e) ctx.fillRect(px + s - f, py, f, s);

  // cantos reforçados
  if (n && w) ctx.fillRect(px, py, f, f);
  if (n && e) ctx.fillRect(px + s - f, py, f, f);
  if (sEdge && w) ctx.fillRect(px, py + s - f, f, f);
  if (sEdge && e) ctx.fillRect(px + s - f, py + s - f, f, f);
}

function desenharFaceSul(ctx, cx, cy, z, queda) {
  const px = mundoParaTelaX(cx);
  const topY = mundoParaTelaY(cy, z);
  const w = TILE * ESCALA;
  const h = queda * FACE_H * ESCALA;
  const py = topY + TILE * ESCALA;

  const faixa = Math.max(3, ESCALA * 2);
  for (let y = 0; y < h; y += faixa) {
    ctx.fillStyle = (y / faixa) & 1 ? CORES.faceTopo : CORES.faceMeio;
    ctx.fillRect(px, py + y, w, Math.min(faixa, h - y));
  }

  ctx.fillStyle = CORES.faceBase;
  ctx.fillRect(px, py + h - Math.max(2, ESCALA), w, Math.max(2, ESCALA));

  const borda = Math.max(2, ESCALA);
  ctx.fillStyle = CORES.faceSombra;
  if (alturaEm(cx - 1, cy) < z) ctx.fillRect(px, py, borda, h);
  if (alturaEm(cx + 1, cy) < z) ctx.fillRect(px + w - borda, py, borda, h);

  ctx.fillStyle = bordaDoTopo(z);
  ctx.fillRect(px, py, w, Math.max(1, ESCALA));
}

/** Lateral W/E do cubo — deixa o terraço legível de lado. */
function desenharFaceLateral(ctx, cx, cy, z, queda, lado) {
  const px = mundoParaTelaX(cx);
  const topY = mundoParaTelaY(cy, z);
  const s = TILE * ESCALA;
  const h = queda * FACE_H * ESCALA;
  const faixa = Math.max(3, ESCALA + 1);
  const x = lado === "w" ? px - faixa : px + s;

  ctx.fillStyle = CORES.faceLateral;
  ctx.fillRect(x, topY, faixa, s + h);

  ctx.fillStyle = CORES.faceSombra;
  ctx.fillRect(lado === "w" ? x : x + faixa - 1, topY, 1, s + h);

  ctx.fillStyle = bordaDoTopo(z);
  ctx.fillRect(x, topY, faixa, Math.max(1, ESCALA));
}

function desenharProp(ctx, prop, z) {
  const px = mundoParaTelaX(prop.x);
  const py = mundoParaTelaY(prop.y, z);

  if (prop.tipo === "arvore") {
    ctx.fillStyle = "#5a3a22";
    ctx.fillRect(px - 3, py - 18, 6, 20);
    ctx.fillStyle = "#2f7a3a";
    ctx.beginPath();
    ctx.arc(px, py - 22, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3f9a4a";
    ctx.beginPath();
    ctx.arc(px - 5, py - 26, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (prop.tipo === "placa") {
    ctx.fillStyle = "#6b4a2a";
    ctx.fillRect(px - 2, py - 14, 4, 14);
    ctx.fillStyle = "#d8c27a";
    ctx.fillRect(px - 10, py - 26, 20, 12);
    ctx.fillStyle = "#333";
    ctx.font = "8px monospace";
    ctx.fillText("3→1", px - 8, py - 17);
  } else {
    ctx.fillStyle = "#7a6a5a";
    ctx.beginPath();
    ctx.ellipse(px, py - 2, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9a8a78";
    ctx.beginPath();
    ctx.ellipse(px - 2, py - 4, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function desenharDebug(ctx, cx, cy, z) {
  const px = mundoParaTelaX(cx);
  const py = mundoParaTelaY(cy, z);
  const s = TILE * ESCALA;
  ctx.strokeStyle = CORES.debugStroke;
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
  ctx.fillStyle = CORES.debug;
  ctx.font = "10px monospace";
  ctx.fillText(`z${z}`, px + 3, py + 12);
}
