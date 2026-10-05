/**
 * Trava semântica de input na escalada (UX estilo BOTW).
 *
 * Attach com tecla segurada: componente pra dentro da parede = subir
 * (ex.: andando com S numa face norte → S continua subindo).
 *
 * Press já agarrado: N/S = W↑ S↓ A← D→; E/W = into sobe.
 * Enquanto segurar: mantém o significado (canto não remapeia).
 * Ao soltar tudo: limpa; próximo press reavalia na face atual.
 */

const LIMIAR = 0.12;

export function limparTravaEscalada(corpo) {
  corpo.travaEscalada = null;
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
  let subida;
  let lateral;

  if (eixos.lado === "n" || eixos.lado === "s") {
    // Norte espelha o sul: W↑ S↓ A← D→ (mundo) — só após soltar e apertar de novo
    subida = -dy;
    lateral = eixos.lado === "n" ? -dx : dx;
  } else {
    const paraParedeX = -eixos.normalX;
    const paraParedeY = -eixos.normalY;
    subida = dx * paraParedeX + dy * paraParedeY;
    lateral = dx * eixos.latX + dy * eixos.latY;
  }

  if (Math.abs(subida) < LIMIAR) subida = 0;
  if (Math.abs(lateral) < LIMIAR) lateral = 0;

  const m = Math.hypot(subida, lateral);
  if (m > 1) {
    subida /= m;
    lateral /= m;
  }
  return { subida, lateral };
}
