import { fbm2, fbmPerlin01 } from "../voxel/ruido.js";

/**
 * Avalia o grafo. Ruído antigo devolve blocos; Perlin do Unity devolve 0..1.
 * ctx.metrosPorBloco / metrosPorCelula mapeiam o bloco do jogo para o UV mundial.
 */
export function avaliarGrafo(bioma, wx, wy, seed, ctx) {
  const nos = bioma?.nos;
  if (!nos?.length) return 4;
  let saida = null;
  for (let i = 0; i < nos.length; i++) {
    if (nos[i].tipo === "saida") {
      saida = nos[i];
      break;
    }
  }
  if (!saida) return 4;
  return avaliarNo(bioma, saida.id, wx, wy, seed, new Set(), ctx || {});
}

function acharNo(bioma, id) {
  const nos = bioma.nos;
  for (let i = 0; i < nos.length; i++) {
    if (nos[i].id === id) return nos[i];
  }
  return null;
}

function entrada(bioma, idNo, porta, wx, wy, seed, pilha, ctx, cache) {
  const ligacoes = bioma.ligacoes || [];
  for (let i = 0; i < ligacoes.length; i++) {
    const l = ligacoes[i];
    if (l.para === idNo && l.portaPara === porta) {
      return avaliarNo(bioma, l.de, wx, wy, seed, pilha, ctx, cache);
    }
  }
  return 0;
}

function uvMundo(wx, wy, ctx) {
  const mpb = Number(ctx?.metrosPorBloco) || 48;
  const cel = Math.max(1, Number(ctx?.metrosPorCelula) || 1000);
  const u = (wx * mpb) / cel;
  const v = (wy * mpb) / cel;
  return { u, v, uTile: u - Math.floor(u), vTile: v - Math.floor(v) };
}

function avaliarNo(bioma, id, wx, wy, seed, pilha, ctx, cache) {
  if (cache?.has(id)) return cache.get(id);
  if (!pilha.add(id)) return 0;
  try {
    const no = acharNo(bioma, id);
    if (!no) return 0;
    let valor = 0;
    switch (no.tipo) {
      case "constante":
        valor = Number(no.valor) || 0;
        break;
      case "ruido": {
        const freq = Number(no.frequencia) || 0.02;
        const oitavas = Math.max(1, Math.min(6, no.oitavas | 0 || 3));
        const ganho = Number(no.ganho);
        const n = fbm2(wx * freq, wy * freq, (seed + (no.semente | 0)) | 0, oitavas);
        valor = n * (Number.isFinite(ganho) ? ganho : 1);
        break;
      }
      case "perlin": {
        const { u, v } = uvMundo(wx, wy, ctx);
        valor = fbmPerlin01(u, v, no);
        break;
      }
      case "queda": {
        const { uTile, vTile } = uvMundo(wx, wy, ctx);
        const dx = uTile - (Number(no.centroU) || 0);
        const dy = vTile - (Number(no.centroV) || 0);
        const dist = Math.hypot(dx, dy);
        const interno = Math.max(0, Number(no.raioInterno) || 0);
        const externo = Math.max(interno + 0.0001, Number(no.raioExterno) || 0.5);
        const t = Math.max(0, Math.min(1, (dist - interno) / (externo - interno)));
        const s = t * t * (3 - 2 * t);
        const expo = Math.max(0.01, Number(no.expoente) || 1);
        let m = (1 - s) ** expo;
        if (no.inverter) m = 1 - m;
        valor = Math.max(0, Math.min(1, m));
        break;
      }
      case "somar":
        valor =
          entrada(bioma, id, "A", wx, wy, seed, pilha, ctx, cache) +
          entrada(bioma, id, "B", wx, wy, seed, pilha, ctx, cache);
        break;
      case "multiplicar":
        valor =
          entrada(bioma, id, "A", wx, wy, seed, pilha, ctx, cache) *
          entrada(bioma, id, "B", wx, wy, seed, pilha, ctx, cache);
        break;
      case "mistura": {
        const a = entrada(bioma, id, "A", wx, wy, seed, pilha, ctx, cache);
        const b = entrada(bioma, id, "B", wx, wy, seed, pilha, ctx, cache);
        const t = Math.max(0, Math.min(1, Number(no.mistura) || 0));
        valor = a + (b - a) * t;
        break;
      }
      case "mascara": {
        const src = entrada(bioma, id, "Source", wx, wy, seed, pilha, ctx, cache);
        const mIn = entrada(bioma, id, "Mask", wx, wy, seed, pilha, ctx, cache);
        const thr = Math.max(0, Math.min(1, Number(no.limiar) ?? 0.5));
        const sm = Math.max(0, Math.min(1, Number(no.suavidade) || 0));
        let dentro;
        if (sm <= 0.0001) {
          const passa = no.inverter ? mIn > thr : mIn <= thr;
          dentro = passa ? 1 : 0;
        } else if (!no.inverter) {
          dentro = mIn > thr ? 0 : 1 - suave(thr - sm, thr, mIn);
        } else {
          dentro = mIn <= thr ? 0 : suave(thr, thr + sm, mIn);
        }
        valor = Math.max(0, Math.min(1, src * dentro));
        break;
      }
      case "terraco": {
        const v = entrada(bioma, id, "In", wx, wy, seed, pilha, ctx, cache);
        const d = Math.max(1, Number(no.degrau) || 1);
        valor = Math.round(v / d) * d;
        break;
      }
      case "achatar": {
        const v = entrada(bioma, id, "In", wx, wy, seed, pilha, ctx, cache);
        const alvo = Number(no.alvo) || 0;
        const forca = Math.max(0, Math.min(1, Number(no.forca) || 0));
        valor = v + (alvo - v) * forca;
        break;
      }
      case "limitar": {
        const v = entrada(bioma, id, "In", wx, wy, seed, pilha, ctx, cache);
        const minimo = Number(no.minimo);
        const maximo = Number(no.maximo);
        const lo = Number.isFinite(minimo) ? minimo : 0;
        const hi = Number.isFinite(maximo) ? maximo : 40;
        valor = Math.max(lo, Math.min(hi, v));
        break;
      }
      case "cratera": {
        const v = entrada(bioma, id, "In", wx, wy, seed, pilha, ctx, cache);
        const limiar = Number(no.limiar);
        const t = Number.isFinite(limiar) ? limiar : 18;
        if (v <= t) valor = v;
        else {
          const prof = Number(no.profundidade);
          const p = Number.isFinite(prof) ? prof : 1;
          valor = t - (v - t) * p;
        }
        break;
      }
      case "saida": {
        const v = entrada(bioma, id, "In", wx, wy, seed, pilha, ctx, cache);
        valor = no.semNormalizar ? v : Math.max(0, Math.min(1, v));
        break;
      }
      default:
        valor = 0;
    }
    const amp = Number(no.amplitude);
    const resultado = valor * (Number.isFinite(amp) ? amp : 1);
    if (cache) cache.set(id, resultado);
    return resultado;
  } finally {
    pilha.delete(id);
  }
}

/**
 * Avalia cada nó numa grade. Cada ponto calcula o grafo uma vez.
 * passo pode ser um número ou { x, y, origemX, origemY } em blocos.
 * @returns {Map<string, Float32Array>}
 */
export function amostrarNos(bioma, largura, altura, seed, ctx, passo = 10) {
  const buffers = new Map();
  const nos = bioma?.nos;
  if (!nos?.length) return buffers;
  const w = Math.max(1, largura | 0);
  const h = Math.max(1, altura | 0);
  const passoX = typeof passo === "number" ? passo : Number(passo?.x) || 10;
  const passoY = typeof passo === "number" ? passo : Number(passo?.y) || passoX;
  const origemX = typeof passo === "number" ? 0 : Number(passo?.origemX) || 0;
  const origemY = typeof passo === "number" ? 0 : Number(passo?.origemY) || 0;
  for (let i = 0; i < nos.length; i++) {
    buffers.set(nos[i].id, new Float32Array(w * h));
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cache = new Map();
      const pilha = new Set();
      const wx = origemX + x * passoX;
      const wy = origemY + y * passoY;
      for (let i = 0; i < nos.length; i++) {
        const id = nos[i].id;
        buffers.get(id)[y * w + x] = avaliarNo(bioma, id, wx, wy, seed, pilha, ctx, cache);
      }
    }
  }
  return buffers;
}

function suave(a, b, x) {
  if (b <= a) return x >= b ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
