/**
 * Trava semântica de input na escalada (UX estilo BOTW).
 *
 * Attach com tecla segurada: componente pra dentro da parede = subir
 * (ex.: andando com S numa face norte → S continua subindo).
 *
 * Mesma face: reprojeta todo frame → diagonal (subida+lateral) livre.
 * Canto / attach forçado: congela significado até soltar WASD.
 *
 * Pós-mantle: base da face no chão até soltar —
 * subir→platô, descer→beirada, lateral→lado a lado.
 */

const LIMIAR = 0.12;

export function limparTravaEscalada(corpo) {
  corpo.travaEscalada = null;
}

export function limparTravaPosMantle(corpo) {
  corpo.travaPosMantle = null;
}

/**
 * No mantle: guarda eixos da face. Se a tecla de “subir” estava invertida
 * vs into-wall (ex. S no attach sul), flipV corrige até soltar.
 */
export function capturarTravaPosMantle(corpo, face, dx = 0, dy = 0) {
  const temInput = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
  const stickySub = corpo.travaEscalada?.subida ?? 0;
  const tinhaSubida = stickySub > LIMIAR;
  if (!temInput && !tinhaSubida) {
    limparTravaPosMantle(corpo);
    return;
  }

  let flipV = 1;
  if (temInput) {
    const proj = projetarNosEixos(face, dx, dy);
    if (stickySub > LIMIAR && proj.subida < -LIMIAR) flipV = -1;
    else if (stickySub < -LIMIAR && proj.subida > LIMIAR) flipV = -1;
  }

  corpo.travaPosMantle = {
    lado: face.lado,
    normalX: face.normalX,
    normalY: face.normalY,
    latX: face.latX,
    latY: face.latY,
    fwdX: -face.normalX,
    fwdY: -face.normalY,
    flipV,
  };
}

/**
 * Reprojeta WASD nos eixos do climb → mundo.
 */
export function resolverMovimentoPosMantle(corpo, dx, dy) {
  const temInput = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
  if (!temInput) {
    limparTravaPosMantle(corpo);
    return { dx: 0, dy: 0 };
  }
  const t = corpo.travaPosMantle;
  if (!t) return { dx, dy };

  const proj = projetarNosEixos(t, dx, dy);
  const subida = proj.subida * (t.flipV || 1);
  const lateral = proj.lateral;

  let ox = subida * t.fwdX + lateral * t.latX;
  let oy = subida * t.fwdY + lateral * t.latY;
  const m = Math.hypot(ox, oy);
  if (m > 1) {
    ox /= m;
    oy /= m;
  }
  return { dx: ox, dy: oy };
}

/**
 * No attach: direção pra dentro da parede = subir.
 * Continuidade forçada (tecla que seria “descer”) congela até soltar.
 */
export function capturarTravaNoAttach(corpo, eixos, dx = 0, dy = 0) {
  limparTravaEscalada(corpo);
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;

  const into = dx * -eixos.normalX + dy * -eixos.normalY;
  let lateral = dx * eixos.latX + dy * eixos.latY;
  if (Math.abs(lateral) < LIMIAR) lateral = 0;

  let subida;
  let congelar = false;

  if (into > LIMIAR) {
    subida = into;
  } else if (
    Math.abs(lateral) > LIMIAR &&
    Math.abs(lateral) >= Math.abs(into) - 1e-6
  ) {
    subida = 0;
  } else {
    subida = 1;
    lateral = 0;
    congelar = true;
  }

  if (subida < LIMIAR) subida = 0;
  if (subida === 0 && lateral === 0) return;

  const m = Math.hypot(subida, lateral);
  if (m > 1) {
    subida /= m;
    lateral /= m;
  }
  corpo.travaEscalada = {
    subida,
    lateral,
    lado: eixos.lado,
    congelar,
  };
}

/**
 * Mesma face → reprojeta (diagonal OK).
 * Canto ou attach forçado → congela (subida, lateral) até soltar.
 */
export function resolverInputEscaladaTravado(corpo, eixos, dx, dy) {
  const temInput = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
  if (!temInput) {
    limparTravaEscalada(corpo);
    return { subida: 0, lateral: 0 };
  }

  const proj = projetarNosEixos(eixos, dx, dy);

  if (!corpo.travaEscalada) {
    if (proj.subida === 0 && proj.lateral === 0) return proj;
    corpo.travaEscalada = {
      subida: proj.subida,
      lateral: proj.lateral,
      lado: eixos.lado,
      congelar: false,
    };
    return { subida: proj.subida, lateral: proj.lateral };
  }

  const t = corpo.travaEscalada;

  if (t.lado !== eixos.lado) {
    t.congelar = true;
    t.lado = eixos.lado;
  }

  if (t.congelar) {
    const mag = Math.min(1, Math.hypot(dx, dy));
    const magT = Math.hypot(t.subida, t.lateral) || 1;
    return {
      subida: (t.subida / magT) * mag,
      lateral: (t.lateral / magT) * mag,
    };
  }

  // Mesma face: atualiza trava com a projeção atual (W+A = diagonal)
  t.subida = proj.subida;
  t.lateral = proj.lateral;
  t.lado = eixos.lado;
  return { subida: proj.subida, lateral: proj.lateral };
}

function projetarNosEixos(eixos, dx, dy) {
  const paraParedeX = -eixos.normalX;
  const paraParedeY = -eixos.normalY;
  let subida = dx * paraParedeX + dy * paraParedeY;
  let lateral = dx * eixos.latX + dy * eixos.latY;

  if (Math.abs(subida) < LIMIAR) subida = 0;
  if (Math.abs(lateral) < LIMIAR) lateral = 0;

  const m = Math.hypot(subida, lateral);
  if (m > 1) {
    subida /= m;
    lateral /= m;
  }
  return { subida, lateral };
}
