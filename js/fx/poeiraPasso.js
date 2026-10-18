/**
 * Poeira de passo no chão (andar / correr).
 * Folha de 3 quadros, piscina fixa, sem alocação no quadro.
 */
import { estado } from "../jogo/estado.js";
import { atoresVisiveis } from "../pokemon/sistema.js";

const CAP = 80;
const PERTO2 = 18 * 18;
const VEL_MIN = 0.4;
const VEL_CORRIDA = 3.05;
const EXPANDIR = 0.28;

const ANDAR = Object.freeze({
  intervalo: 0.4,
  bolas: 1,
  tam0: 0.36,
  tam1: 0.86,
  espalha: 0.16,
  dur: 0.58,
  atras: 0.14,
  alfa: 0.55,
});

const CORRER = Object.freeze({
  intervalo: 0.12,
  bolas: 2,
  tam0: 0.42,
  tam1: 1.12,
  espalha: 0.36,
  dur: 0.7,
  atras: 0.22,
  alfa: 0.68,
});

const FOLHA = new URL("../../assets/effects/gas-cloud-fx.png", import.meta.url);

function criarPuff() {
  return {
    viva: false,
    x: 0,
    y: 0,
    z: 0,
    idade: 0,
    dur: 1,
    tam0: 0.3,
    tam1: 0.8,
    alfa: 0.5,
  };
}

const puffs = Array.from({ length: CAP }, criarPuff);
let cursor = 0;

const rastros = new WeakMap();
const fila = [];
const amostra = { tam: 0, quadro: 0, alfa: 0 };

let pedido = false;
let pronta = false;
const quadros = [null, null, null];

export function puffsPasso() {
  return puffs;
}

export function quadrosPoeira() {
  return quadros;
}

export function poeiraPronta() {
  return pronta;
}

export function amostraPoeira(p) {
  const u = p.dur > 0 ? p.idade / p.dur : 1;
  const exp = p.idade >= EXPANDIR ? 1 : p.idade / EXPANDIR;
  const ease = 1 - (1 - exp) * (1 - exp);
  amostra.tam = p.tam0 + (p.tam1 - p.tam0) * ease;
  amostra.quadro = exp >= 1 ? 2 : (exp * 2.8) | 0;
  const fade = u < 0.35 ? 1 : 1 - (u - 0.35) / 0.65;
  amostra.alfa = p.alfa * (fade > 0 ? fade : 0);
  return amostra;
}

export function garantirPoeira() {
  if (pedido) return;
  pedido = true;
  const img = new Image();
  img.onload = () => {
    const fw = img.width || 16;
    const fh = Math.floor((img.height || 48) / 3) || 16;
    for (let f = 0; f < 3; f++) {
      const c = document.createElement("canvas");
      c.width = fw;
      c.height = fh;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, f * fh, fw, fh, 0, 0, fw, fh);
      const data = g.getImageData(0, 0, fw, fh);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i];
        const gv = px[i + 1];
        const b = px[i + 2];
        const l = r > gv ? (r > b ? r : b) : gv > b ? gv : b;
        px[i] = 255;
        px[i + 1] = 255;
        px[i + 2] = 255;
        px[i + 3] = l;
      }
      g.putImageData(data, 0, 0);
      quadros[f] = c;
    }
    pronta = true;
  };
  img.src = FOLHA.href;
}

function pegarSlot() {
  const p = puffs[cursor];
  cursor = (cursor + 1) % CAP;
  return p;
}

function soltar(e, dx, dy, perfil) {
  const len = Math.hypot(dx, dy) || 1;
  const bx = -dx / len;
  const by = -dy / len;
  const z = e.elevacao ?? e.z ?? 0;
  for (let i = 0; i < perfil.bolas; i++) {
    const p = pegarSlot();
    p.viva = true;
    p.x = e.x + bx * perfil.atras + (Math.random() - 0.5) * perfil.espalha;
    p.y = e.y + by * perfil.atras + (Math.random() - 0.5) * perfil.espalha;
    p.z = z;
    p.idade = 0;
    p.dur = perfil.dur;
    p.tam0 = perfil.tam0;
    p.tam1 = perfil.tam1;
    p.alfa = perfil.alfa;
  }
}

function noChao(e) {
  if (!e || e.morto || e.capturado) return false;
  if (e.voando || e.planando || e.escalando || e.nadando || e.pulando || e.mantle) return false;
  if ((e.hopLift || 0) > 0.12) return false;
  if ((e.aguaProf || 0) > 0.18) return false;
  if ((e.vz || 0) > 0.35) return false;
  if (e.noChao === false) return false;
  return true;
}

function tentar(e, dt) {
  if (!noChao(e)) return;
  let rec = rastros.get(e);
  if (!rec) {
    rec = { x: e.x, y: e.y, acum: 0, parado: true };
    rastros.set(e, rec);
    return;
  }
  const dx = e.x - rec.x;
  const dy = e.y - rec.y;
  const vel = dt > 0 ? Math.hypot(dx, dy) / dt : 0;
  rec.x = e.x;
  rec.y = e.y;
  if (vel > 30) {
    rec.parado = true;
    return;
  }
  if (!e.andando || vel < VEL_MIN) {
    rec.parado = true;
    return;
  }
  const corre = typeof e.correndo === "boolean" ? e.correndo : vel >= VEL_CORRIDA;
  const perfil = corre ? CORRER : ANDAR;
  if (rec.parado) {
    rec.parado = false;
    rec.acum = perfil.intervalo;
  }
  rec.acum += dt;
  if (rec.acum < perfil.intervalo) return;
  rec.acum -= perfil.intervalo;
  if (rec.acum > perfil.intervalo) rec.acum = 0;
  soltar(e, dx, dy, perfil);
}

export function tickPoeiraPasso(dt, corpo, agente) {
  garantirPoeira();
  const passo = dt > 0 ? dt : 0;
  for (let i = 0; i < CAP; i++) {
    const p = puffs[i];
    if (!p.viva) continue;
    p.idade += passo;
    if (p.idade >= p.dur) p.viva = false;
  }
  if (!(passo > 0) || estado.interior) return;

  fila.length = 0;
  if (corpo) fila.push(corpo);
  if (agente && agente !== corpo) fila.push(agente);
  const px = corpo?.x ?? 0;
  const py = corpo?.y ?? 0;
  const atores = atoresVisiveis();
  for (let i = 0; i < atores.length; i++) {
    const a = atores[i];
    const dx = a.x - px;
    const dy = a.y - py;
    if (dx * dx + dy * dy > PERTO2) continue;
    fila.push(a);
  }
  for (let i = 0; i < fila.length; i++) tentar(fila[i], passo);
}
