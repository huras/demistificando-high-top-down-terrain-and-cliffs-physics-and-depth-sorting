import { baseTopoEm, superficieBaixaEm, superficieEm } from "../mundo/voxel/storeMundo.js";

/** Células para cada lado, no plano do chão. O eixo vertical não entra no raio. */
export const RAIO_RECORTE_FACES = 5;

const CHAVE = "faces-recorte-horizontal";

function amostra(wx, wy, shift) {
  const surf = superficieEm(wx, wy) | 0;
  if (surf <= 0) return { h: 0, furos: [] };
  const h = surf - shift;
  if (h <= 0) return { h: 0, furos: [] };
  const base = baseTopoEm(wx, wy) | 0;
  const furos = [];
  if (base > 0) {
    const baixa = superficieBaixaEm(wx, wy) | 0;
    const zIni = baixa - shift;
    const zFim = base - shift;
    for (let z = Math.max(0, zIni); z < Math.min(h, zFim); z++) furos.push(z);
  }
  return { h, furos };
}

/**
 * Quadrado horizontal de raio 5 em volta do pé.
 * A altura é rebatida pra superfície mais baixa do quadrado virar 1:
 * o miolo da coluna, abaixo disso, não entra na malha.
 * Uma volta a mais (anel) só existe pra o chanfro da borda ver o vizinho real.
 */
export function gravarRecorteAoRedor(x, y, zPe) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const raio = RAIO_RECORTE_FACES;
  const lado = raio * 2 + 1;
  let minSurf = Infinity;
  for (let r = 0; r < lado; r++) {
    for (let c = 0; c < lado; c++) {
      const surf = superficieEm(cx + (c - raio), cy + (r - raio)) | 0;
      if (surf > 0 && surf < minSurf) minSurf = surf;
    }
  }
  const shift = Number.isFinite(minSurf) ? minSurf - 1 : 0;
  const alturas = [];
  const furos = [];
  for (let r = 0; r < lado; r++) {
    const linha = [];
    for (let c = 0; c < lado; c++) {
      const cel = amostra(cx + (c - raio), cy + (r - raio), shift);
      linha.push(cel.h);
      for (let i = 0; i < cel.furos.length; i++) furos.push({ c, r, z: cel.furos[i] });
    }
    alturas.push(linha);
  }
  const anel = [];
  for (let r = -1; r <= lado; r++) {
    for (let c = -1; c <= lado; c++) {
      if (c >= 0 && c < lado && r >= 0 && r < lado) continue;
      const cel = amostra(cx + (c - raio), cy + (r - raio), shift);
      if (cel.h <= 0) continue;
      anel.push({ c, r, h: cel.h, furos: cel.furos });
    }
  }
  const hCentro = alturas[raio][raio] | 0;
  const recorte = {
    raio,
    x: cx,
    y: cy,
    z: zPe | 0,
    alturas,
    furos,
    anel,
    foco: {
      c: raio,
      r: raio,
      z: Math.max(0, hCentro - 1),
      nome: "eu",
    },
    nota: `Raio horizontal de ${raio} voxels ao redor de (${cx}, ${cy}), norte em cima. O pé estava em z ${zPe | 0}. A superfície mais baixa desse quadrado virou altura 1 — o que está abaixo disso na coluna fica de fora. A malha leva mais uma célula em volta só pra borda não virar penhasco falso.`,
  };
  sessionStorage.setItem(CHAVE, JSON.stringify(recorte));
}

export function consumirRecorteFaces() {
  const bruto = sessionStorage.getItem(CHAVE);
  if (!bruto) return null;
  sessionStorage.removeItem(CHAVE);
  try {
    const recorte = JSON.parse(bruto);
    if (!recorte || !Array.isArray(recorte.alturas) || !recorte.alturas.length) return null;
    const n = recorte.alturas.length;
    if (recorte.alturas.some((linha) => !Array.isArray(linha) || linha.length !== n)) return null;
    return recorte;
  } catch {
    return null;
  }
}
