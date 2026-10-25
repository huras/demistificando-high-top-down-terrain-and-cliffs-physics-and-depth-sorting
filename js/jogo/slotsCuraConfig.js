/**
 * Layout 3D das bolas na máquina de cura (suporte + 6 slots).
 * Coordenadas em unidades de mundo (mesmo espaço da alturaAlvo do prop).
 * y do slot: posição local Y = -slot.y (convenção antiga do carimbo).
 */

export const URL_SLOTS_CURA = "assets/models/cidade/props/cura/slots.json";
export const QTD_SLOTS_CURA = 6;

const PADRAO = Object.freeze({
  suporte: Object.freeze({ x: 0, y: 1.35, z: 0.2 }),
  slots: Object.freeze([
    Object.freeze({ x: -0.35, y: -0.28, z: 0.05 }),
    Object.freeze({ x: 0.35, y: -0.28, z: 0.05 }),
    Object.freeze({ x: -0.35, y: 0.02, z: 0.05 }),
    Object.freeze({ x: 0.35, y: 0.02, z: 0.05 }),
    Object.freeze({ x: -0.35, y: 0.32, z: 0.05 }),
    Object.freeze({ x: 0.35, y: 0.32, z: 0.05 }),
  ]),
});

/** @type {{ suporte: { x: number, y: number, z: number }, slots: { x: number, y: number, z: number }[] }} */
let atual = clonar(PADRAO);
let carregando = null;

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clonar(cfg) {
  return {
    suporte: {
      x: num(cfg?.suporte?.x, PADRAO.suporte.x),
      y: num(cfg?.suporte?.y, PADRAO.suporte.y),
      z: num(cfg?.suporte?.z, PADRAO.suporte.z),
    },
    slots: Array.from({ length: QTD_SLOTS_CURA }, (_, i) => {
      const s = cfg?.slots?.[i] || PADRAO.slots[i];
      return {
        x: num(s?.x, PADRAO.slots[i].x),
        y: num(s?.y, PADRAO.slots[i].y),
        z: num(s?.z, PADRAO.slots[i].z),
      };
    }),
  };
}

/** Normaliza e valida (também usado pelo POST do servidor via cópia lógica). */
export function normalizarSlotsCura(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("arquivo sem slots da máquina");
  }
  const out = clonar(obj);
  const lim = 64;
  const checar = (rotulo, p) => {
    if (Math.abs(p.x) > lim || Math.abs(p.y) > lim || Math.abs(p.z) > lim) {
      throw new Error(`${rotulo} fora do intervalo`);
    }
  };
  checar("suporte", out.suporte);
  for (let i = 0; i < out.slots.length; i++) checar(`slot ${i}`, out.slots[i]);
  return out;
}

export function slotsCuraPadrao() {
  return clonar(PADRAO);
}

export function slotsCuraAtuais() {
  return clonar(atual);
}

export function definirSlotsCura(obj) {
  atual = normalizarSlotsCura(obj);
  return slotsCuraAtuais();
}

/** Posição local da bola no suporte (Three Y já convertido). */
export function posicaoSlotCura(slot) {
  const s = slot || PADRAO.slots[0];
  return {
    x: num(s.x),
    y: -num(s.y),
    z: num(s.z),
  };
}

export function carregarSlotsCura() {
  if (carregando) return carregando;
  carregando = fetch(URL_SLOTS_CURA, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((obj) => {
      if (obj) atual = normalizarSlotsCura(obj);
      return slotsCuraAtuais();
    })
    .catch(() => slotsCuraAtuais())
    .finally(() => {
      carregando = null;
    });
  return carregando;
}
