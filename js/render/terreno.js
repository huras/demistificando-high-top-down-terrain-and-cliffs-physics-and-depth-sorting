import { ESCALA, FACE_H, TILE } from "../config.js";
import { alturaEm, quedaSul } from "../mundo/altura.js";
import { ALTURAS, COLUNAS, LINHAS, PROPS } from "../mundo/mapaDemo.js";
import { mundoParaTelaX, mundoParaTelaY } from "./camera.js";
import {
  chaveEntidade,
  chaveFaceLateral,
  chaveFaceSul,
  chaveTopo,
  empilhar,
} from "./ordenacaoProfundidade.js";
import { bordaDoTopo, CORES, coresDoTopo } from "./paleta.js";

/** Ties na mesma camada: topo < face < lateral < prop < player */
const TIE_TOPO = 0;
const TIE_FACE = 1;
const TIE_LATERAL = 2;
const TIE_PROP = 3;

/**
 * Tudo na camada 0 — depth sort puro por Y (sortKey).
 */
export function empilharTerreno(lista, _atlas, debug, faceDestaque = null) {
  for (let cy = 0; cy < LINHAS; cy++) {
    for (let cx = 0; cx < COLUNAS; cx++) {
      const z = ALTURAS[cy][cx];
      if (z <= 0) continue;

      const sortTop = chaveTopo(cy, z);
      empilhar(lista, sortTop, 0, (ctx) => desenharTopo(ctx, cx, cy, z), TIE_TOPO, z);

      const quedaS = quedaSul(cx, cy);
      if (quedaS > 0) {
        const sortFace = chaveFaceSul(cy, quedaS, z);
        const destacar =
          faceDestaque &&
          faceDestaque.cx === cx &&
          faceDestaque.cy === cy;
        empilhar(
          lista,
          sortFace,
          0,
          (ctx) => desenharFaceSul(ctx, cx, cy, z, quedaS, destacar),
          TIE_FACE,
          z,
        );
      }

      const dzW = z - alturaEm(cx - 1, cy);
      const dzE = z - alturaEm(cx + 1, cy);
      if (dzW > 0) {
        empilhar(
          lista,
          chaveFaceLateral(cy, z),
          0,
          (ctx) => desenharFaceLateral(ctx, cx, cy, z, dzW, "w"),
          TIE_LATERAL,
          z,
        );
      }
      if (dzE > 0) {
        empilhar(
          lista,
          chaveFaceLateral(cy, z),
          0,
          (ctx) => desenharFaceLateral(ctx, cx, cy, z, dzE, "e"),
          TIE_LATERAL,
          z,
        );
      }

      if (debug) {
        empilhar(
          lista,
          sortTop + 0.0001,
          0,
          (ctx) => desenharDebug(ctx, cx, cy, z),
          9,
          z,
        );
      }
    }
  }

  for (const prop of PROPS) {
    const z = alturaEm(Math.floor(prop.x), Math.floor(prop.y));
    empilhar(
      lista,
      chaveEntidade(prop.y, z),
      0,
      (ctx) => desenharProp(ctx, prop, z),
      TIE_PROP,
      z,
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

  if (n && w) ctx.fillRect(px, py, f, f);
  if (n && e) ctx.fillRect(px + s - f, py, f, f);
  if (sEdge && w) ctx.fillRect(px, py + s - f, f, f);
  if (sEdge && e) ctx.fillRect(px + s - f, py + s - f, f, f);
}

function desenharFaceSul(ctx, cx, cy, z, queda, destacar = false) {
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

  if (destacar) {
    ctx.strokeStyle = "rgba(255, 220, 80, 0.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, w - 2, h - 2);
  }
}

function desenharFaceLateral(ctx, cx, cy, z, queda, lado) {
  const px = mundoParaTelaX(cx);
  const topY = mundoParaTelaY(cy, z);
  const s = TILE * ESCALA;
  const h = queda * FACE_H * ESCALA;
  // na borda do topo (não fora) — cobre a faixa onde o sprite compete de lado
  const faixa = Math.max(5, ESCALA * 3);
  const x = lado === "w" ? px : px + s - faixa;

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
    ctx.fillRect(px - 14, py - 28, 28, 14);
    ctx.fillStyle = "#333";
    ctx.font = "7px monospace";
    const texto = prop.texto || "3→1";
    ctx.fillText(texto, px - 12, py - 18);
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
  ctx.font = "8px monospace";
  ctx.fillText(`${cx}`, px + 2, py + 9);
  ctx.fillText(`${cy}`, px + 2, py + 17);
  ctx.fillText(`${z}`, px + 2, py + 25);
}
