/**
 * Trava semântica de input na escalada (UX estilo BOTW).
 *
 * Attach com tecla segurada: componente pra dentro da parede = subir
 * (ex.: andando com S numa face norte → S continua subindo).
 *
 * Press já agarrado: into wall = sobe (todas as faces).
 * Enquanto segurar: mantém o significado (canto não remapeia).
 * Ao soltar tudo: limpa; próximo press reavalia na face atual.
 *
 * Pós-mantle: base da face continua no chão até soltar WASD —
 * subir→platô, descer→beirada, lateral→lado a lado (não tudo pro platô).
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
    // climb “subir” com tecla que into-wall lê como descer → inverte eixo vertical
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
 * Reprojeta WASD nos eixos do climb → mundo:
 * subida → platô (−normal), −subida → beirada, lateral → lat da face.
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
 * No attach: tecla ainda segurada da caminhada vira continuidade pra cima.
 * Into-wall → sobe; se a tecla seria “descer” no esquema da face, ainda sobe
 * (ex.: andando com S e grudar). Strafe puro → só lateral.
 */
export function capturarTravaNoAttach(corpo, eixos, dx = 0, dy = 0) {
  limparTravaEscalada(corpo);
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;

  const into = dx * -eixos.normalX + dy * -eixos.normalY;
  let lateral = dx * eixos.latX + dy * eixos.latY;
  if (Math.abs(lateral) < LIMIAR) lateral = 0;

  let subida;
  if (into > LIMIAR) {
    subida = into;
  } else if (
    Math.abs(lateral) > LIMIAR &&
    Math.abs(lateral) >= Math.abs(into) - 1e-6
  ) {
    // strafe na hora do grab
    subida = 0;
  } else {
    // continuidade: segurando direção ao grudar = subir (não remapeia pra descer)
    subida = 1;
    lateral = 0;
  }

  if (subida < LIMIAR) subida = 0;
  if (subida === 0 && lateral === 0) return;

  const m = Math.hypot(subida, lateral);
  if (m > 1) {
    subida /= m;
    lateral /= m;
  }
  corpo.travaEscalada = { subida, lateral };
}

/**
 * @param {object} corpo
 * @param {{ lado:string, normalX:number, normalY:number, latX:number, latY:number }} eixos
 * @param {number} dx
 * @param {number} dy
 * @returns {{ subida:number, lateral:number }}
 */
export function resolverInputEscaladaTravado(corpo, eixos, dx, dy) {
  const temInput = Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01;
  if (!temInput) {
    limparTravaEscalada(corpo);
    return { subida: 0, lateral: 0 };
  }

  if (!corpo.travaEscalada) {
    const proj = projetarNosEixos(eixos, dx, dy);
    if (proj.subida === 0 && proj.lateral === 0) {
      return proj;
    }
    corpo.travaEscalada = {
      subida: proj.subida,
      lateral: proj.lateral,
    };
  }

  const t = corpo.travaEscalada;
  const magTecla = Math.min(1, Math.hypot(dx, dy));
  const magTrava = Math.hypot(t.subida, t.lateral) || 1;
  return {
    subida: (t.subida / magTrava) * magTecla,
    lateral: (t.lateral / magTrava) * magTecla,
  };
}

function projetarNosEixos(eixos, dx, dy) {
  // Into wall = sobe (norte inclusive — sem espelhar o sul)
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
