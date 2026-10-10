import { fbm2 } from "../voxel/ruido.js";

/**
 * Avalia o grafo de um bioma em coordenadas de mundo.
 * A saída é altura contínua em blocos (o degrau entra depois).
 */
export function avaliarGrafo(bioma, wx, wy, seed) {
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
  return avaliarNo(bioma, saida.id, wx, wy, seed, new Set());
}

function acharNo(bioma, id) {
  const nos = bioma.nos;
  for (let i = 0; i < nos.length; i++) {
    if (nos[i].id === id) return nos[i];
  }
  return null;
}

function entrada(bioma, idNo, porta, wx, wy, seed, pilha) {
  const ligacoes = bioma.ligacoes || [];
  for (let i = 0; i < ligacoes.length; i++) {
    const l = ligacoes[i];
    if (l.para === idNo && l.portaPara === porta) {
      return avaliarNo(bioma, l.de, wx, wy, seed, pilha);
    }
  }
  return 0;
}

function avaliarNo(bioma, id, wx, wy, seed, pilha) {
  if (!pilha.add(id)) return 0;
  try {
    const no = acharNo(bioma, id);
    if (!no) return 0;
    switch (no.tipo) {
      case "constante":
        return Number(no.valor) || 0;
      case "ruido": {
        const freq = Number(no.frequencia) || 0.02;
        const oitavas = Math.max(1, Math.min(6, no.oitavas | 0 || 3));
        const ganho = Number(no.ganho);
        const n = fbm2(wx * freq, wy * freq, (seed + (no.semente | 0)) | 0, oitavas);
        return n * (Number.isFinite(ganho) ? ganho : 1);
      }
      case "somar":
        return (
          entrada(bioma, id, "A", wx, wy, seed, pilha) +
          entrada(bioma, id, "B", wx, wy, seed, pilha)
        );
      case "multiplicar":
        return (
          entrada(bioma, id, "A", wx, wy, seed, pilha) *
          entrada(bioma, id, "B", wx, wy, seed, pilha)
        );
      case "terraco": {
        const v = entrada(bioma, id, "In", wx, wy, seed, pilha);
        const d = Math.max(1, Number(no.degrau) || 1);
        return Math.round(v / d) * d;
      }
      case "achatar": {
        const v = entrada(bioma, id, "In", wx, wy, seed, pilha);
        const alvo = Number(no.alvo) || 0;
        const forca = Math.max(0, Math.min(1, Number(no.forca) || 0));
        return v + (alvo - v) * forca;
      }
      case "limitar": {
        const v = entrada(bioma, id, "In", wx, wy, seed, pilha);
        const minimo = Number(no.minimo);
        const maximo = Number(no.maximo);
        const lo = Number.isFinite(minimo) ? minimo : 0;
        const hi = Number.isFinite(maximo) ? maximo : 40;
        return Math.max(lo, Math.min(hi, v));
      }
      case "cratera": {
        const v = entrada(bioma, id, "In", wx, wy, seed, pilha);
        const limiar = Number(no.limiar);
        const t = Number.isFinite(limiar) ? limiar : 18;
        if (v <= t) return v;
        const prof = Number(no.profundidade);
        const p = Number.isFinite(prof) ? prof : 1;
        return t - (v - t) * p;
      }
      case "saida":
        return entrada(bioma, id, "In", wx, wy, seed, pilha);
      default:
        return 0;
    }
  } finally {
    pilha.delete(id);
  }
}
