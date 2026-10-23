/**
 * Bounds do overworld finito e da ilha authored de Kanto.
 * Kanto vive em coords locais [0, EXTENSAO); o mundo aplica ORIGEM.
 * Sem import de grafoKanto — evita ciclo (grafo e amostra importam daqui).
 */

/** Lado do overworld (4× a área de Kanto). */
export const LADO_MUNDO = 8192;

/** Ilha authored: 32 áreas × 128 blocos. */
export const EXTENSAO_KANTO = 4096;

/** Origem mundial da ilha (Kanto centrado). */
export const ORIGEM_KANTO_X = 2048;
export const ORIGEM_KANTO_Y = 2048;

/** Faixa de costura Kanto ↔ procedural (blocos). */
export const FAIXA_COSTURA = 64;

/**
 * Bolso das salas 3D (casa, centro, loja, lab) — longe do overworld 8192².
 * O streaming precisa carregar chunks aqui; senão a física cai no z=0
 * enquanto o chão decorativo continua flutuando na altura da praça.
 */
export const BOLSO_SALA_X0 = 99936;
export const BOLSO_SALA_Y0 = 99936;
/** Inclui bolso das casas/lab e o dungeon de santuário (~100700+). */
export const BOLSO_SALA_X1 = 100900;
export const BOLSO_SALA_Y1 = 100640;

export function dentroDoMundo(wx, wy) {
  return wx >= 0 && wy >= 0 && wx < LADO_MUNDO && wy < LADO_MUNDO;
}

export function dentroDoBolsoSala(wx, wy) {
  return (
    wx >= BOLSO_SALA_X0 &&
    wy >= BOLSO_SALA_Y0 &&
    wx < BOLSO_SALA_X1 &&
    wy < BOLSO_SALA_Y1
  );
}

export function dentroDoKanto(wx, wy) {
  const lx = wx - ORIGEM_KANTO_X;
  const ly = wy - ORIGEM_KANTO_Y;
  return lx >= 0 && ly >= 0 && lx < EXTENSAO_KANTO && ly < EXTENSAO_KANTO;
}

export function paraLocalKanto(wx, wy) {
  return {
    x: wx - ORIGEM_KANTO_X,
    y: wy - ORIGEM_KANTO_Y,
  };
}

export function deLocalKanto(lx, ly) {
  return {
    x: lx + ORIGEM_KANTO_X,
    y: ly + ORIGEM_KANTO_Y,
  };
}

/**
 * Distância assinada à AABB de Kanto: negativa dentro, positiva fora.
 * 0 = exatamente na borda.
 */
export function distAssinadaKanto(wx, wy) {
  const x0 = ORIGEM_KANTO_X;
  const y0 = ORIGEM_KANTO_Y;
  const x1 = ORIGEM_KANTO_X + EXTENSAO_KANTO;
  const y1 = ORIGEM_KANTO_Y + EXTENSAO_KANTO;
  const dx = wx < x0 ? x0 - wx : wx >= x1 ? wx - (x1 - 1e-9) : 0;
  const dy = wy < y0 ? y0 - wy : wy >= y1 ? wy - (y1 - 1e-9) : 0;
  if (dx > 0 || dy > 0) return Math.hypot(dx, dy);
  const dentro = Math.min(wx - x0, x1 - wx, wy - y0, y1 - wy);
  return -dentro;
}

/**
 * Peso do procedural na costura: 0 = puro Kanto, 1 = puro procedural.
 * Sangria simétrica: começa a misturar FAIXA/2 dentro da ilha.
 */
export function pesoCostura(wx, wy, faixa = FAIXA_COSTURA) {
  const d = distAssinadaKanto(wx, wy);
  const meio = faixa * 0.5;
  if (d <= -meio) return 0;
  if (d >= meio) return 1;
  const t = (d + meio) / faixa;
  return t * t * (3 - 2 * t);
}

/** Chunk (cx,cy) intersecta o overworld ou o bolso das salas 3D. */
export function chunkDentroDoMundo(cx, cy, chunkXz) {
  const x0 = cx * chunkXz;
  const y0 = cy * chunkXz;
  const x1 = x0 + chunkXz;
  const y1 = y0 + chunkXz;
  if (x1 > 0 && y1 > 0 && x0 < LADO_MUNDO && y0 < LADO_MUNDO) return true;
  return (
    x1 > BOLSO_SALA_X0 &&
    y1 > BOLSO_SALA_Y0 &&
    x0 < BOLSO_SALA_X1 &&
    y0 < BOLSO_SALA_Y1
  );
}
