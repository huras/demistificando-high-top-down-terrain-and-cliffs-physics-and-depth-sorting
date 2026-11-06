/**
 * Impactos de chuva no chão.
 * Pool fixo, sem alocação no quadro. Os fios da precipitação não colidem:
 * o orçamento nasce em disco em volta do jogador e o anel cabe na célula.
 */
import { CLIMA_CFG } from "../../../clima/config.js";
import { alturaEm } from "../../../mundo/altura.js";
import { colunaAgua } from "../../../mundo/agua/fluxo.js";

const CAP = 96;
const PASSO_AUREO = Math.PI * (3 - Math.sqrt(5));
const TENTATIVAS = 12;
/** >0.5 puxa os impactos para perto do jogador. */
const VIES_DISCO = 0.8;

const amostra = { ok: false, x: 0, y: 0 };

function hash01(n) {
  let x = Math.imul(n | 0, 747796405) + 2891336453;
  x = Math.imul(x ^ (x >>> 16), 2246822519);
  x = (x ^ (x >>> 13)) >>> 0;
  return x / 4294967296;
}

function criarSlot() {
  return {
    viva: false,
    x: 0,
    y: 0,
    z: 0,
    ang: 0,
    alonga: 1,
    raio: 0.18,
    idade: 0,
    dur: 0.4,
  };
}

export function criarPingosChao() {
  const cfg = CLIMA_CFG;
  const slots = Array.from({ length: CAP }, criarSlot);
  let vivos = 0;
  let resto = 0;
  let giro = 0;
  let semente = 1;
  const amostraVento = { ang: 0, alonga: 1 };

  function aposentar(i) {
    vivos -= 1;
    const morto = slots[i];
    morto.viva = false;
    const ultimo = slots[vivos];
    slots[i] = ultimo;
    slots[vivos] = morto;
  }

  function zerar() {
    for (let i = 0; i < vivos; i++) slots[i].viva = false;
    vivos = 0;
    resto = 0;
  }

  function ventoDo(vento) {
    const vx = vento?.x || 0;
    const vz = vento?.y || 0;
    const mag = Math.hypot(vx, vz);
    if (mag < 1e-4) {
      amostraVento.ang = 0;
      amostraVento.alonga = 1;
      return amostraVento;
    }
    const ref = cfg.galeWindHudRef ?? 0.9;
    const w = ref > 0 ? Math.min(1, mag / ref) : 0;
    const extra = cfg.pingoAlongaVento ?? 0.35;
    amostraVento.ang = Math.atan2(vx, -vz);
    amostraVento.alonga = 1 + extra * w;
    return amostraVento;
  }

  function pontoNoDisco(ox, oz, raioDisco) {
    const rNorm = Math.pow(Math.random(), VIES_DISCO);
    const ang = giro * PASSO_AUREO;
    giro += 1;
    const r = rNorm * raioDisco;
    amostra.ok = true;
    amostra.x = ox + Math.cos(ang) * r;
    amostra.y = oz + Math.sin(ang) * r;
    return amostra;
  }

  /**
   * Topo exposto. O anel pode cruzar a célula se o vizinho está na mesma cota;
   * degrau ou água no alcance rejeita, para não pendurar no penhasco.
   */
  function chaoDoAnel(x, y, alcance) {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    const z = alturaEm(cx, cy);
    if (z <= 0) return false;
    if (colunaAgua(cx, cy).superficie > 0) return false;
    const x0 = Math.floor(x - alcance);
    const x1 = Math.floor(x + alcance);
    const y0 = Math.floor(y - alcance);
    const y1 = Math.floor(y + alcance);
    for (let iy = y0; iy <= y1; iy++) {
      for (let ix = x0; ix <= x1; ix++) {
        if (ix === cx && iy === cy) continue;
        if (alturaEm(ix, iy) !== z) return false;
        if (colunaAgua(ix, iy).superficie > 0) return false;
      }
    }
    return z;
  }

  function nascer(ox, oz, vento) {
    if (vivos >= CAP) return false;
    semente = (semente + 1) | 0;
    const h = hash01(semente);
    const h2 = hash01(semente + 0x9e3779b9);
    const raioMin = cfg.pingoRaioMin ?? 0.24;
    const raioMax = cfg.pingoRaioMax ?? 0.52;
    const durMin = cfg.pingoDurMin ?? 0.5;
    const durMax = cfg.pingoDurMax ?? 0.85;
    const raio = raioMin + (raioMax - raioMin) * h;
    const dur = durMin + (durMax - durMin) * h2;
    const alcance = raio * vento.alonga;
    const raioDisco = cfg.pingoRaioDisco ?? 14;
    for (let t = 0; t < TENTATIVAS; t++) {
      const p = pontoNoDisco(ox, oz, raioDisco);
      if (!p.ok) continue;
      const z = chaoDoAnel(p.x, p.y, alcance);
      if (!z) continue;
      const slot = slots[vivos];
      slot.viva = true;
      slot.x = p.x;
      slot.y = p.y;
      slot.z = z;
      slot.ang = vento.ang;
      slot.alonga = vento.alonga;
      slot.raio = raio;
      slot.idade = 0;
      slot.dur = dur;
      vivos += 1;
      return true;
    }
    return false;
  }

  /**
   * @param {number} dt
   * @param {number} chuva 0..1
   * @param {{x:number,y:number}} vento vx/vz do mundo (ventoPrecip)
   * @param {{x:number,y:number,z:number}|null} alvo âncora do céu (y = altura)
   * @param {boolean} interior sala 3D — sem impacto
   */
  function atualizar(dt, chuva, vento, alvo, interior) {
    const seguro = Math.min(Math.max(dt || 0, 0), 0.05);
    if (interior) {
      zerar();
      return 0;
    }

    for (let i = 0; i < vivos; ) {
      const p = slots[i];
      p.idade += seguro;
      if (p.idade >= p.dur) aposentar(i);
      else i += 1;
    }

    const c = Math.max(0, Math.min(1, chuva || 0));
    if (c < 0.02 || vivos >= CAP) return vivos;
    if (!alvo || !Number.isFinite(alvo.x) || !Number.isFinite(alvo.z)) return vivos;

    const pow = cfg.pingoDensidadePow ?? 1.15;
    const taxa = cfg.pingoTaxaCheia ?? 34;
    resto += taxa * Math.pow(c, pow) * seguro;
    let falta = Math.floor(resto);
    resto -= falta;
    if (falta <= 0) return vivos;

    ventoDo(vento);
    const querer = Math.min(falta, CAP - vivos);
    for (let n = 0; n < querer; n++) nascer(alvo.x, alvo.z, amostraVento);
    return vivos;
  }

  function listar() {
    return slots;
  }

  function contar() {
    return vivos;
  }

  return { atualizar, listar, contar };
}
