/**
 * Água no grafo: vau no piso, nado na linha da superfície, queda e subida da cachoeira.
 * A altura de nado é superfície−1, que fica a < 0.85 dos pés (superfície − AGUA_FLUTUA).
 */
import {
  AGUA_CUSTO_NAV,
  AGUA_CUSTO_NAV_RASO,
  AGUA_LIMIAR_VADO,
  ESCALADA_VEL,
  PATH_CUSTO_ESCALADA,
} from "../config.js";

const CARD = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function podeVadear(perfil) {
  return perfil?.podeVadear !== false;
}

export function podeNadar(perfil) {
  return perfil?.podeNadar !== false;
}

export function podeCachoeira(perfil) {
  return perfil?.podeCachoeira !== false;
}

/**
 * Pisos em que o perfil anda ou nada. Coluna caindo não é piso.
 * @param {number[]} pisosBrutos
 */
export function alturasLocomocao(pisosBrutos, agua, perfil) {
  const pisos = pisosBrutos || [];
  if (agua?.caindo) return [];

  if (agua?.superficie > 0 && agua.profundidade > AGUA_LIMIAR_VADO) {
    if (!podeNadar(perfil)) {
      return pisos.filter((z) => z > agua.superficie);
    }
    const swimZ = agua.superficie - 1;
    const out = [];
    let temNado = false;
    for (const z of pisos) {
      if (z <= agua.superficie) {
        if (!temNado) {
          out.push(swimZ);
          temNado = true;
        }
      } else {
        out.push(z);
      }
    }
    if (!out.length) out.push(swimZ);
    return out;
  }

  if (agua?.profundidade > 0.2 && !podeVadear(perfil)) {
    return pisos.filter((z) => z > agua.superficie);
  }

  return pisos;
}

/**
 * Multiplicador da aresta, ou null se o perfil não entra nessa água.
 * Corrente a favor fica mais barata pra o caminho não brigar com o fluxo.
 */
export function multiplicadorAgua(a, b, dx, dy, perfil) {
  if (!a || !b) return 1;
  if (a.caindo || b.caindo) return null;
  const p = Math.max(a.profundidade || 0, b.profundidade || 0);
  let m = 1;
  if (p > AGUA_LIMIAR_VADO) {
    if (!podeNadar(perfil)) return null;
    m = AGUA_CUSTO_NAV;
  } else if (p > 0.2) {
    if (!podeVadear(perfil)) return null;
    m = AGUA_CUSTO_NAV_RASO;
  }
  const fx = b.fluxoX || a.fluxoX || 0;
  const fy = b.fluxoY || a.fluxoY || 0;
  if (fx || fy) {
    const alinhado = dx * fx + dy * fy;
    if (alinhado > 0) m *= 0.75;
    else if (alinhado < 0) m *= 1.35;
  }
  return m;
}

function melhorAltura(alturas) {
  if (!alturas?.length) return null;
  let z = alturas[0];
  for (let i = 1; i < alturas.length; i++) {
    if (alturas[i] > z) z = alturas[i];
  }
  return z;
}

function pousoAFrente(x, y, fx, fy, lerAgua, lerAlturas) {
  let px = x;
  let py = y;
  for (let i = 0; i < 4; i++) {
    const a = lerAgua(px, py);
    if (!a?.caindo) {
      const z = melhorAltura(lerAlturas(px, py));
      if (z == null) return null;
      return { x: px, y: py, z };
    }
    if (!fx && !fy) return null;
    px += fx;
    py += fy;
  }
  return null;
}

/**
 * Links que pulam a coluna da queda: desce nadando, sobe escalando a face.
 * @returns {{cx:number,cy:number,z:number,custo:number,tipo:"nado"|"climb"}[]}
 */
export function linksCachoeira(cx, cy, zA, perfil, lerAgua, lerAlturas) {
  const links = [];
  if (!podeNadar(perfil) && !podeCachoeira(perfil)) return links;
  const aqui = lerAgua(cx, cy);
  if (!aqui || aqui.caindo) return links;

  for (const [dx, dy] of CARD) {
    const nx = cx + dx;
    const ny = cy + dy;
    const queda = lerAgua(nx, ny);
    if (!queda?.caindo) continue;

    let fx = queda.fluxoX | 0;
    let fy = queda.fluxoY | 0;
    if (!fx && !fy) {
      const descendo = zA + 0.5 < queda.superficie - 1;
      fx = descendo ? -dx : dx;
      fy = descendo ? -dy : dy;
    }

    const lipX = nx - fx;
    const lipY = ny - fy;
    const poolX = nx + fx;
    const poolY = ny + fy;

    if (podeNadar(perfil) && cx === lipX && cy === lipY) {
      const pouso = pousoAFrente(poolX, poolY, fx, fy, lerAgua, lerAlturas);
      if (pouso && (pouso.x !== cx || pouso.y !== cy)) {
        const dist = Math.hypot(pouso.x - cx, pouso.y - cy);
        const quedaH = Math.max(0, zA - pouso.z);
        links.push({
          cx: pouso.x,
          cy: pouso.y,
          z: pouso.z,
          custo: dist + quedaH * 0.15,
          tipo: "nado",
        });
      }
    }

    if (podeCachoeira(perfil) && cx === poolX && cy === poolY) {
      const zLip = melhorAltura(lerAlturas(lipX, lipY));
      if (zLip != null && zLip > zA + 0.5) {
        const dz = zLip - zA;
        links.push({
          cx: lipX,
          cy: lipY,
          z: zLip,
          custo:
            PATH_CUSTO_ESCALADA + dz / Math.max(0.25, ESCALADA_VEL),
          tipo: "climb",
        });
      }
    }
  }

  return links;
}
