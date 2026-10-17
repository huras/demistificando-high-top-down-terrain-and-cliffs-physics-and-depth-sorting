import { AGENTE_DIST_SEGUIR, RAIO_CORPO } from "../js/config.js";
import { ALCANCE_RAIO, FOLGA_PISO, SONDA_FRENTE } from "../js/navegacao/ia/constantes.js";
import { observar, preencherRaios } from "../js/navegacao/ia/observacao.js";
import { escolherHabilidade } from "../js/navegacao/ia/seletor.js";

export const DIST = AGENTE_DIST_SEGUIR;
const VEL = 4.2;
const DT = 0.1;
const PASSOS = 140;

export const A_PE = Object.freeze({ podeNadar: false, podeVoar: false, podePlanar: false });
export const NADA = Object.freeze({ podeNadar: true, podeVoar: false, podePlanar: false });
export const VOA = Object.freeze({ podeNadar: false, podeVoar: true, podePlanar: false });
export const PLANA = Object.freeze({ podeNadar: false, podeVoar: false, podePlanar: true });
export const TUDO = Object.freeze({ podeNadar: true, podeVoar: true, podePlanar: true });

export function especialista(hab, obs, rot) {
  const longe = obs[15] > 0.012;
  const frente = obs[4];
  let ax = 1;
  let ay = obs[2] || 0;
  if (hab === "voar") {
    ay = 0;
  } else if (frente < 0.72) {
    const esq = obs[5];
    const dir = obs[6];
    if (Math.abs(ay) < 0.25 || Math.abs(esq - dir) > 0.2) ay = esq >= dir ? 1 : -1;
    else ay = ay > 0 ? 1 : -1;
    ax = frente < 0.35 ? 0.25 : 0.6;
  } else {
    ay *= 0.2;
  }
  if (hab === "chao" && obs[12] > 0.5) {
    ax = -0.4;
    if (Math.abs(ay) < 0.25) ay = (obs[2] || 1) >= 0 ? 1 : -1;
  } else if (hab === "chao" && obs[13] > 0.5) {
    ax = -0.25;
    if (Math.abs(ay) < 0.25) ay = 1;
  }
  if (!longe) {
    ax = 0;
    ay = 0;
  } else {
    const m = Math.hypot(ax, ay) || 1;
    ax = Math.max(-1, Math.min(1, ax / m));
    ay = Math.max(-1, Math.min(1, ay / m));
  }
  rot[0] = ax;
  rot[1] = ay;
  rot[2] = longe ? 1 : -1;
  return rot;
}

function jitter(rng, a) {
  return (rng() - 0.5) * a;
}

export function montar(tipo, rng) {
  if (tipo === "arvores") {
    return {
      sx: jitter(rng, 0.6),
      sy: jitter(rng, 0.8),
      sz: 1,
      px: 10 + jitter(rng, 0.4),
      py: jitter(rng, 0.4),
      pz: 1,
      zChao: 1,
      vante: null,
      agua: null,
      discos: [
        { x: 3.6 + jitter(rng, 0.3), y: jitter(rng, 0.3), z: 1, r: 0.62 },
        { x: 6.4 + jitter(rng, 0.3), y: 1.55 + jitter(rng, 0.2), z: 1, r: 0.48 },
        { x: 6.2 + jitter(rng, 0.3), y: -1.5 + jitter(rng, 0.2), z: 1, r: 0.48 },
      ],
    };
  }
  if (tipo === "agua") {
    return {
      sx: jitter(rng, 0.4),
      sy: jitter(rng, 0.6),
      sz: 1,
      px: 10,
      py: jitter(rng, 0.4),
      pz: 1,
      zChao: 1,
      vante: null,
      agua: { x0: 3.4, x1: 6.4, y0: -30, y1: 30 },
      discos: [],
    };
  }
  if (tipo === "voo") {
    const discos = [];
    for (let i = -24; i <= 24; i++) discos.push({ x: 4.2, y: i * 0.9, z: 1, r: 0.55 });
    return {
      sx: jitter(rng, 0.3),
      sy: jitter(rng, 0.4),
      sz: 1,
      px: 9.2,
      py: 0,
      pz: 1,
      zChao: 1,
      vante: null,
      agua: null,
      discos,
    };
  }
  return {
    sx: 1 + jitter(rng, 0.3),
    sy: jitter(rng, 0.4),
    sz: 6,
    px: 9,
    py: jitter(rng, 0.3),
    pz: 1,
    zChao: 1,
    zAlto: 6,
    zBaixo: 1,
    vante: 4,
    agua: null,
    discos: [],
  };
}

function alturaChao(cena, x) {
  if (cena.vante == null) return cena.zChao;
  return x < cena.vante ? cena.zAlto : cena.zBaixo;
}

function aguaEm(cena, x, y) {
  const a = cena.agua;
  if (!a) return 0;
  return x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1 ? 1 : 0;
}

function quedaEm(cena, x, fx) {
  const z0 = alturaChao(cena, x);
  const z1 = alturaChao(cena, x + fx * SONDA_FRENTE);
  if (z0 > 0 && (z1 <= 0 || z0 - z1 >= 2)) {
    const drop = z1 <= 0 ? 4 : z0 - z1;
    return Math.min(1, drop / 4);
  }
  return 0;
}

function encher(cena, corpo, dst) {
  let n = 0;
  const lista = cena.discos;
  const limite = ALCANCE_RAIO + 1.2;
  for (let i = 0; i < lista.length; i++) {
    const d = lista[i];
    if (Math.abs(corpo.z - d.z) > FOLGA_PISO) continue;
    const dx = d.x - corpo.x;
    const dy = d.y - corpo.y;
    if (dx * dx + dy * dy > limite * limite) continue;
    if (n >= 48) break;
    const o = n * 4;
    dst[o] = d.x;
    dst[o + 1] = d.y;
    dst[o + 2] = d.z;
    dst[o + 3] = d.r;
    n++;
  }
  return n;
}

function encosta(cena, x, y, z) {
  const lista = cena.discos;
  for (let i = 0; i < lista.length; i++) {
    const d = lista[i];
    if (Math.abs(z - d.z) > FOLGA_PISO) continue;
    const dx = x - d.x;
    const dy = y - d.y;
    const min = d.r + RAIO_CORPO;
    if (dx * dx + dy * dy < min * min) return true;
  }
  return false;
}

function chegou(corpo, posto) {
  if (Math.hypot(posto.x - corpo.x, posto.y - corpo.y) > DIST + 0.25) return false;
  return Math.abs((corpo.z || 0) - posto.z) < 2;
}

function avancar(corpo, posto, cena, perfil, hab, ax, ay, gate, fx, fy) {
  const longe = gate >= 0;
  const voando = hab === "voar" && longe && !!perfil.podeVoar;
  corpo.voando = voando;
  if (!longe) {
    if (corpo.z > alturaChao(cena, corpo.x) + 0.4) corpo.z = alturaChao(cena, corpo.x);
    corpo.voando = false;
    corpo.vx = 0;
    corpo.vy = 0;
    return { batida: 0, ilegal: 0 };
  }
  const lx = -fy;
  const ly = fx;
  let wx = ax * fx + ay * lx;
  let wy = ax * fy + ay * ly;
  const m = Math.hypot(wx, wy) || 1;
  wx /= m;
  wy /= m;
  const nx = corpo.x + wx * VEL * DT;
  const ny = corpo.y + wy * VEL * DT;
  if (voando) {
    corpo.z = corpo.z < 5 ? 5 : corpo.z;
    corpo.x = nx;
    corpo.y = ny;
    corpo.vx = wx * VEL;
    corpo.vy = wy * VEL;
    return { batida: 0, ilegal: perfil.podeVoar ? 0 : 1 };
  }
  if (!perfil.podeNadar && aguaEm(cena, nx, ny)) {
    return { batida: 0, ilegal: aguaEm(cena, corpo.x, corpo.y) ? 1 : 0 };
  }
  const chaoAqui = alturaChao(cena, corpo.x);
  const chaoLa = alturaChao(cena, nx);
  const desce = chaoAqui - chaoLa >= 2;
  if (desce && hab !== "planar" && !perfil.podeVoar) return { batida: 0, ilegal: 0 };
  if (desce && hab === "planar" && !perfil.podePlanar) return { batida: 0, ilegal: 1 };
  const z = hab === "planar" && perfil.podePlanar ? corpo.z + (posto.z - corpo.z) * 0.4 : chaoLa;
  if (encosta(cena, nx, ny, z)) return { batida: 1, ilegal: 0 };
  corpo.x = nx;
  corpo.y = ny;
  corpo.z = z;
  corpo.vx = wx * VEL;
  corpo.vy = wy * VEL;
  return { batida: 0, ilegal: 0 };
}

const discoBuf = new Float32Array(192);
const amostras = new Float32Array(8);
const obs = new Float32Array(16);
const rot = new Float32Array(3);

export function episodio(tipo, perfil, rng, decidir, gravar) {
  const cena = montar(tipo, rng);
  const corpo = { x: cena.sx, y: cena.sy, z: cena.sz, vx: 0, vy: 0, voando: false, lado: 0 };
  const posto = { x: cena.px, y: cena.py, z: cena.pz };
  let batidas = 0;
  let ilegal = 0;
  let passos = 0;
  let voou = 0;
  for (let t = 0; t < PASSOS; t++) {
    const dx = posto.x - corpo.x;
    const dy = posto.y - corpo.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const fx = dx / dist;
    const fy = dy / dist;
    const n = encher(cena, corpo, discoBuf);
    preencherRaios(corpo.x, corpo.y, fx, fy, discoBuf, n, amostras);
    const agua = aguaEm(cena, corpo.x + fx * SONDA_FRENTE, corpo.y + fy * SONDA_FRENTE);
    const queda = quedaEm(cena, corpo.x, fx);
    observar(dist, posto.z - corpo.z, amostras, agua, queda, Math.hypot(corpo.vx, corpo.vy), DIST, corpo.lado || 0, obs);
    const hab = escolherHabilidade(perfil, obs, corpo.voando);
    if (gravar && gravar.hab === hab && gravar.n < gravar.limite) {
      especialista(hab, obs, rot);
      const o = gravar.n;
      for (let i = 0; i < 16; i++) gravar.x[o * 16 + i] = obs[i];
      for (let i = 0; i < gravar.saidas; i++) gravar.y[o * gravar.saidas + i] = rot[i];
      gravar.n++;
    }
    especialista(hab, obs, rot);
    const rede = decidir ? decidir(hab, obs) : null;
    let ax = rede ? rede[0] : rot[0];
    let ay = rede ? rede[1] : rot[1];
    let gate = rede ? rede[2] : rot[2];
    if (obs[15] <= 0.012) gate = -1;
    const passo = avancar(corpo, posto, cena, perfil, hab, ax, ay, gate, fx, fy);
    if (gate >= 0) corpo.lado = ay;
    batidas += passo.batida;
    ilegal += passo.ilegal;
    passos++;
    if (hab === "voar" && corpo.voando) voou++;
    if (chegou(corpo, posto)) {
      return { chegou: true, batidas, ilegal, passos, voou };
    }
  }
  return { chegou: false, batidas, ilegal, passos, voou };
}

export function provaEspecialista(tipo, perfil, rng, n, decidir) {
  let chegou = 0;
  let batidas = 0;
  let ilegal = 0;
  let passos = 0;
  let voou = 0;
  for (let i = 0; i < n; i++) {
    const r = episodio(tipo, perfil, rng, decidir, null);
    if (r.chegou) chegou++;
    batidas += r.batidas;
    ilegal += r.ilegal;
    passos += r.passos;
    voou += r.voou;
  }
  return {
    chegada: chegou / n,
    batida: batidas / n,
    mascara: passos > 0 ? 1 - ilegal / passos : 1,
    voou: voou / n,
  };
}
