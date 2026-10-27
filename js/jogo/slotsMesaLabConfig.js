/**
 * Layout 3D das bolas iniciais na mesa-3 do laboratório (suporte + 3 slots).
 * Coordenadas em unidades de mundo (mesmo espaço da alturaAlvo do prop).
 * Grid no topo: X/Z; y do slot → local Y = -slot.y (0 = plano da mesa).
 */

export const URL_SLOTS_MESA_LAB = "assets/models/cidade/props/mesa-3/slots.json";
export const QTD_SLOTS_MESA_LAB = 3;

const PADRAO = Object.freeze({
  suporte: Object.freeze({ x: 0, y: 0.85, z: 0 }),
  slots: Object.freeze([
    Object.freeze({ x: -0.5, y: 0, z: 0 }),
    Object.freeze({ x: 0, y: 0, z: 0 }),
    Object.freeze({ x: 0.5, y: 0, z: 0 }),
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
    slots: Array.from({ length: QTD_SLOTS_MESA_LAB }, (_, i) => {
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
export function normalizarSlotsMesaLab(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("arquivo sem slots da mesa do lab");
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

export function slotsMesaLabPadrao() {
  return clonar(PADRAO);
}

export function slotsMesaLabAtuais() {
  return clonar(atual);
}

export function definirSlotsMesaLab(obj) {
  atual = normalizarSlotsMesaLab(obj);
  return slotsMesaLabAtuais();
}

/** Posição local da bola no suporte (Three Y já convertido). */
export function posicaoSlotMesaLab(slot) {
  const s = slot || PADRAO.slots[0];
  return {
    x: num(s.x),
    y: -num(s.y),
    z: num(s.z),
  };
}

export function carregarSlotsMesaLab() {
  if (carregando) return carregando;
  carregando = fetch(URL_SLOTS_MESA_LAB, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((obj) => {
      if (obj) atual = normalizarSlotsMesaLab(obj);
      return slotsMesaLabAtuais();
    })
    .catch(() => slotsMesaLabAtuais())
    .finally(() => {
      carregando = null;
    });
  return carregando;
}
