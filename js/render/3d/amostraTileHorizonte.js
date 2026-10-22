/**
 * Amostra CPU de um tile do LOD horizonte (128² / passo 16).
 * Usado no runtime e no script de assar — sem DOM / WebGL.
 */
import {
  CHUNK_HORIZONTE,
  PASSO_HORIZONTE,
  QUANT_ALTURA_HORIZONTE,
  UV_ESCALA_HORIZONTE,
  UV_ESCALA_MAR_HORIZONTE,
} from "../../config.js";
import { alturaDoRelevo, amostrarRegiao, nivelMarBlocos } from "../../mundo/bioma/catalogo.js";
import { cruSplat } from "../../mundo/bioma/detalhe.js";
import { obterKits } from "../../mundo/bioma/kits.js";
import { rgbBioma } from "../../mundo/bioma/tinta.js";
import { amostraKanto, dentroDoKanto } from "../../mundo/regiao/amostraKanto.js";
import { ajustarAlturaCorredorEstrada } from "../../mundo/regiao/linhasEstrada.js";
import { criarGeometriaMarPlano, criarGeometriaTerraced } from "./geometriaTerraced.js";

/** @type {{ chave: string, ids: string[] }} */
let gradeBioma = { chave: "", ids: [] };

export function idsKitsHorizonte() {
  const ids = Object.keys(obterKits()?.kits || {}).sort();
  const chave = ids.join("|");
  if (gradeBioma.chave === chave) return gradeBioma.ids;
  gradeBioma = { chave, ids };
  return ids;
}

function celulaDe(kit) {
  const ids = idsKitsHorizonte();
  const i = ids.indexOf(kit);
  return i < 0 ? 0 : i;
}

function parNoPonto(wx, wy) {
  if (dentroDoKanto(wx, wy)) {
    const amostra = amostraKanto(wx, wy);
    let a = amostra?.bioma?.kit || "_";
    let b = amostra?.biomaB?.kit || a;
    let peso = amostra ? amostra.dominio : 1;
    if (a === b) return { a, b, peso: 1 };
    if (a > b) {
      const t = a;
      a = b;
      b = t;
      peso = 1 - peso;
    }
    return { a, b, peso };
  }
  const reg = amostrarRegiao(wx, wy);
  let a = reg?.a?.kit || "_";
  let b = reg?.b?.kit || a;
  let peso = reg ? reg.dominio : 1;
  if (a === b) return { a, b, peso: 1 };
  if (a > b) {
    const t = a;
    a = b;
    b = t;
    peso = 1 - peso;
  }
  return { a, b, peso };
}

function quantizar(h) {
  const q = QUANT_ALTURA_HORIZONTE;
  if (q <= 0) return h;
  return Math.round(h / q) * q;
}

function amostraAltura(wx, wy) {
  let h;
  if (dentroDoKanto(wx, wy)) {
    const a = amostraKanto(wx, wy);
    h = a && Number.isFinite(a.h) ? a.h : alturaDoRelevo(wx, wy);
  } else {
    h = alturaDoRelevo(wx, wy);
  }
  return quantizar(ajustarAlturaCorredorEstrada(wx, wy, h));
}

/**
 * Grade amostrada de um tile (hx, hy). Null se vazio.
 * @returns {object | null}
 */
export function amostrarTileHorizonte(hx, hy) {
  const passo = PASSO_HORIZONTE;
  const lado = CHUNK_HORIZONTE;
  const ox = hx * lado;
  const oy = hy * lado;
  const nx = Math.max(1, Math.round(lado / passo));
  const ny = nx;
  const nivel = nivelMarBlocos();

  const alturas = new Float32Array((nx + 1) * (ny + 1));
  const cores = new Float32Array(nx * ny * 3);
  const bioma = new Float32Array(nx * ny * 3);
  const splat = new Float32Array(nx * ny);
  const mar = new Uint8Array(nx * ny);
  let celulas = 0;
  let celulasMar = 0;

  for (let cy = 0; cy <= ny; cy++) {
    for (let cx = 0; cx <= nx; cx++) {
      alturas[cy * (nx + 1) + cx] = amostraAltura(ox + cx * passo, oy + cy * passo);
    }
  }

  for (let cy = 0; cy < ny; cy++) {
    for (let cx = 0; cx < nx; cx++) {
      const wx = ox + cx * passo + passo * 0.5;
      const wy = oy + cy * passo + passo * 0.5;
      const iCor = (cy * nx + cx) * 3;
      const h = alturas[cy * (nx + 1) + cx];
      if (!Number.isFinite(h)) continue;
      celulas += 1;
      const rgb = rgbBioma(wx, wy, false);
      cores[iCor] = rgb[0];
      cores[iCor + 1] = rgb[1];
      cores[iCor + 2] = rgb[2];
      const par = parNoPonto(wx, wy);
      bioma[iCor] = celulaDe(par.a);
      bioma[iCor + 1] = celulaDe(par.b);
      bioma[iCor + 2] = par.peso;
      splat[cy * nx + cx] = cruSplat(wx, wy, par.a) ? 1 : 0;
      if (h < nivel) {
        mar[cy * nx + cx] = 1;
        celulasMar += 1;
      }
    }
  }

  if (!celulas) return null;
  return {
    hx,
    hy,
    ox,
    oy,
    passo,
    nx,
    ny,
    nivel,
    alturas,
    cores,
    bioma,
    splat,
    mar,
    celulas,
    celulasMar,
  };
}

/** Monta BufferGeometry a partir da grade (mesmo path do tick live). */
export function geometriasDoTileHorizonte(grade) {
  if (!grade) return { terra: null, agua: null };
  const { ox, oy, passo, nx, ny, nivel, alturas, cores, bioma, splat, mar, celulasMar } = grade;
  const terra = criarGeometriaTerraced(alturas, cores, {
    ox,
    oy,
    passo,
    nx,
    ny,
    uvEscala: UV_ESCALA_HORIZONTE,
    bioma,
    splat,
  });
  const agua =
    celulasMar > 0
      ? criarGeometriaMarPlano(mar, {
          ox,
          oy,
          passo,
          nx,
          ny,
          nivel,
          uvEscala: UV_ESCALA_MAR_HORIZONTE,
        })
      : null;
  return { terra, agua };
}
