import { COR_TIPO } from "../tipos.js";

/** Conjurações ao mesmo tempo. Cada uma é um núcleo e um anel de orbes. */
const CAP = 8;
export const ORBES_KI = 6;

const auras = [];
for (let i = 0; i < CAP; i++) {
  auras.push({
    viva: false,
    ator: null,
    x: 0,
    y: 0,
    z: 0,
    cor: "#f8fafc",
    u: 0,
    ang: 0,
  });
}

export function aurasVivas() {
  return auras;
}

export function limparKi() {
  for (let i = 0; i < CAP; i++) {
    auras[i].viva = false;
    auras[i].ator = null;
  }
}

function achar(ator) {
  for (let i = 0; i < CAP; i++) {
    if (auras[i].ator === ator) return auras[i];
  }
  return null;
}

export function abrirKi(ator, tipo) {
  let aura = achar(ator);
  if (!aura) {
    for (let i = 0; i < CAP; i++) {
      if (!auras[i].viva) {
        aura = auras[i];
        break;
      }
    }
  }
  if (!aura) aura = auras[0];
  aura.viva = true;
  aura.ator = ator;
  aura.cor = COR_TIPO[tipo] || "#f8fafc";
  aura.u = 0;
  aura.ang = 0;
  aura.x = ator.x;
  aura.y = ator.y;
  aura.z = (ator.z || 0) + (ator.hopLift || 0) + 1.05;
}

export function fecharKi(ator) {
  const aura = achar(ator);
  if (!aura) return;
  aura.viva = false;
  aura.ator = null;
}

export function pulsarKi(ator, u, dt) {
  const aura = achar(ator);
  if (!aura) return;
  aura.u = Math.max(0, Math.min(1, u));
  aura.ang += (dt || 0) * (8 + aura.u * 14);
  aura.x = ator.x;
  aura.y = ator.y;
  aura.z = (ator.z || 0) + (ator.hopLift || 0) + 1.05;
}

export function auraDe(ator) {
  return achar(ator);
}
