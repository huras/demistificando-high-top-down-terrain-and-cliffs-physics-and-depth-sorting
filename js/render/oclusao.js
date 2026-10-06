import { alturaEm, quedaSul } from "../mundo/altura.js";
import { chaveEntidade, chaveFaceSul } from "./ordenacaoProfundidade.js";

/**
 * Face sul que o player está “enfrentando”.
 */
export function consultarOclusao(corpo) {
  const sortPlayer = chaveEntidade(corpo.y, corpo.z);
  let melhor = null;
  let melhorScore = Infinity;

  const x0 = Math.floor(corpo.x) - 2;
  const x1 = Math.floor(corpo.x) + 2;
  const y0 = Math.floor(corpo.y) - 8;
  const y1 = Math.floor(corpo.y) + 12;

  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const z = alturaEm(cx, cy);
      if (z <= 0) continue;
      const q = quedaSul(cx, cy);
      if (q <= 0) continue;

      const lipY = cy + 0.99;
      if (corpo.y < cy - 3.5 || corpo.y > cy + q + 1.8) continue;

      const dx = Math.abs(corpo.x - (cx + 0.5));
      if (dx > 2.2) continue;

      const sortFace = chaveFaceSul(cy, q, z);
      const atrasDaFace = corpo.y < lipY;
      const score = atrasDaFace
        ? lipY - corpo.y + dx * 0.25
        : 50 + (corpo.y - lipY) + dx * 0.25;

      if (score < melhorScore) {
        melhorScore = score;
        melhor = { cx, cy, z, q, sortFace, lipY };
      }
    }
  }

  if (!melhor) {
    return { status: "—", sortPlayer, sortFace: null, face: null };
  }

  const status = sortPlayer < melhor.sortFace ? "ATRÁS" : "NA FRENTE";
  return {
    status,
    sortPlayer,
    sortFace: melhor.sortFace,
    face: melhor,
  };
}
