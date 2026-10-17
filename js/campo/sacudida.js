/**
 * Sacudida curta no pé do sprite. Só as props acertadas entram na lista.
 */

const DUR = 420;
const CAP = 24;

const ativas = [];
const acabaram = [];

export function soltarSacudida(prop) {
  if (!prop?._sacode) return;
  prop._sacode = null;
  const i = ativas.indexOf(prop);
  if (i >= 0) ativas.splice(i, 1);
}

export function sacudir(prop, amp) {
  if (!prop) return;
  let s = prop._sacode;
  if (!s) {
    if (ativas.length >= CAP) {
      const velha = ativas.shift();
      if (velha) velha._sacode = null;
    }
    s = { t0: 0, sinal: 1, amp: 0.08 };
    prop._sacode = s;
    ativas.push(prop);
  }
  s.t0 = performance.now();
  s.amp = amp > 0 ? amp : 0.08;
  s.sinal = s.sinal > 0 ? -1 : 1;
}

export function temSacudida() {
  return ativas.length > 0;
}

/** Tira as que já assentaram. O retorno vale até a próxima chamada. */
export function podarSacudidas(agora) {
  acabaram.length = 0;
  for (let i = ativas.length - 1; i >= 0; i--) {
    const p = ativas[i];
    const s = p._sacode;
    if (s && agora - s.t0 < DUR) continue;
    p._sacode = null;
    ativas.splice(i, 1);
    acabaram.push(p);
  }
  return acabaram;
}

export function propsSacudindo() {
  return ativas;
}

/** Roll no pé e um esmagamento que some. Null se a prop está quieta. */
export function amostraSacudida(prop, agora) {
  const s = prop._sacode;
  if (!s) return null;
  const u = (agora - s.t0) / DUR;
  if (u >= 1) return null;
  const queda = (1 - u) * (1 - u);
  const onda = Math.sin(u * Math.PI * 5);
  return {
    roll: onda * queda * s.amp * s.sinal,
    esmaga: Math.abs(onda) * queda,
  };
}
