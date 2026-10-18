/** Burst de soltar e recolher. Piscina fixa, os mesmos números do Pokémon AI. */

import { tocarEnvioBola, tocarGrito, tocarRecolherBola, tocarShiny } from "../jogo/audio.js";

const CAP_FAISCA = 72;
const CAP_ANEL = 8;
const CAP_FLASH = 4;
const RAIO = 0.4;
const ARRASTO = 3.8;
const DOURADO = [250, 204, 21];
const BRANCO_ENVIO = [255, 252, 240];
const VERMELHO_ENVIO = [248, 113, 113];
const BRANCO_RECOLHER = [255, 248, 230];
const VERMELHO_RECOLHER = [239, 68, 68];

const faiscas = [];
const aneis = [];
const flashes = [];

for (let i = 0; i < CAP_FAISCA; i++) {
  faiscas.push({
    viva: false,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    ox: 0,
    oy: 0,
    puxa: 0,
    vida: 0,
    vidaMax: 0,
    tam: 0,
    r: 255,
    g: 255,
    b: 255,
    traco: false,
    estrela: false,
  });
}

for (let i = 0; i < CAP_ANEL; i++) {
  aneis.push({
    viva: false,
    x: 0,
    y: 0,
    z: 0,
    idade: 0,
    vida: 0,
    vidaMax: 0,
    inicio: 0,
    fim: 0,
    espessura: 0.07,
    r: 255,
    g: 255,
    b: 255,
    branco: true,
    suave: false,
    preenche: false,
  });
}

for (let i = 0; i < CAP_FLASH; i++) {
  flashes.push({
    viva: false,
    x: 0,
    y: 0,
    z: 0,
    raio: RAIO,
    tipo: "envio",
    vida: 0,
    vidaMax: 0.4,
  });
}

function ocupar(lista) {
  let morto = -1;
  let velho = 0;
  let menor = Infinity;
  for (let i = 0; i < lista.length; i++) {
    const item = lista[i];
    if (!item.viva) {
      morto = i;
      break;
    }
    if (item.vida < menor) {
      menor = item.vida;
      velho = i;
    }
  }
  return lista[morto >= 0 ? morto : velho];
}

function rgbDe(cor) {
  if (typeof cor !== "string") return DOURADO;
  const m = /^#?([0-9a-f]{6})$/i.exec(cor.trim());
  if (!m) return DOURADO;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function acentoDe(ator) {
  return rgbDe(ator?.especie?.cor);
}

function pode(ator) {
  return !!(ator && Number.isFinite(ator.x) && Number.isFinite(ator.y) && !ator.capturado);
}

function anel(x, y, z, campos) {
  const slot = ocupar(aneis);
  slot.viva = true;
  slot.x = x;
  slot.y = y;
  slot.z = z;
  slot.idade = campos.idade;
  slot.vida = campos.vida;
  slot.vidaMax = campos.vida;
  slot.inicio = campos.inicio;
  slot.fim = campos.fim;
  slot.espessura = campos.espessura;
  slot.r = campos.r;
  slot.g = campos.g;
  slot.b = campos.b;
  slot.branco = campos.branco;
  slot.suave = !!campos.suave;
  slot.preenche = !!campos.preenche;
}

function faiscaSolta(x, y, z, opt) {
  const [br, bg, bb] = opt.rgb;
  for (let i = 0; i < opt.conta; i++) {
    const ang = Math.random() * Math.PI * 2;
    let dirX = Math.cos(ang);
    let dirY = Math.sin(ang) - opt.sobe;
    const len = Math.hypot(dirX, dirY) || 1;
    dirX /= len;
    dirY /= len;
    const vel = opt.velMin + Math.random() * (opt.velMax - opt.velMin);
    const branco = Math.random() < opt.chanceBranco;
    const slot = ocupar(faiscas);
    slot.viva = true;
    slot.x = x + (Math.random() - 0.5) * 0.12;
    slot.y = y + (Math.random() - 0.5) * 0.12;
    slot.z = z;
    slot.vx = dirX * vel;
    slot.vy = dirY * vel;
    slot.ox = 0;
    slot.oy = 0;
    slot.puxa = 0;
    slot.vidaMax = opt.vida * (0.65 + Math.random() * 0.5);
    slot.vida = slot.vidaMax;
    slot.tam = opt.tamMin + Math.random() * (opt.tamMax - opt.tamMin);
    slot.r = branco ? 255 : br;
    slot.g = branco ? 250 : bg;
    slot.b = branco ? 200 : bb;
    slot.traco = Math.random() < opt.chanceTraco;
    slot.estrela = Math.random() < opt.chanceEstrela;
  }
}

function faiscaPuxa(x, y, z, opt) {
  const [br, bg, bb] = opt.rgb;
  for (let i = 0; i < opt.conta; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = opt.raioMin + Math.random() * Math.max(0.05, opt.raioMax - opt.raioMin);
    const tangente = ang + Math.PI * 0.5;
    const giro = (0.55 + Math.random() * 0.9) * (Math.random() < 0.5 ? -1 : 1);
    const paraDentro = opt.velMin + Math.random() * (opt.velMax - opt.velMin);
    const branco = Math.random() < opt.chanceBranco;
    const slot = ocupar(faiscas);
    slot.viva = true;
    slot.x = x + Math.cos(ang) * rad;
    slot.y = y + Math.sin(ang) * rad;
    slot.z = z;
    slot.vx = Math.cos(tangente) * giro - Math.cos(ang) * paraDentro * 0.35;
    slot.vy = Math.sin(tangente) * giro - Math.sin(ang) * paraDentro * 0.35;
    slot.ox = x;
    slot.oy = y;
    slot.puxa = opt.puxa;
    slot.vidaMax = opt.vida * (0.7 + Math.random() * 0.45);
    slot.vida = slot.vidaMax;
    slot.tam = opt.tamMin + Math.random() * (opt.tamMax - opt.tamMin);
    slot.r = branco ? 255 : br;
    slot.g = branco ? 248 : bg;
    slot.b = branco ? 220 : bb;
    slot.traco = true;
    slot.estrela = Math.random() < opt.chanceEstrela;
  }
}

function flashMundo(x, y, z, raio, tipo, vida) {
  const slot = ocupar(flashes);
  slot.viva = true;
  slot.x = x;
  slot.y = y;
  slot.z = z;
  slot.raio = raio;
  slot.tipo = tipo;
  slot.vida = vida;
  slot.vidaMax = vida;
}

export function soltarFxEnvio(ator) {
  tocarEnvioBola();
  if (ator?.shiny) tocarShiny();
  tocarGrito(ator);
  if (!pode(ator)) return;
  const acento = acentoDe(ator);
  const z = ator.elevacao ?? ator.z ?? 0;
  const x = ator.x;
  const y = ator.y;
  const vidaAnel = 0.45;

  anel(x, y, z, {
    idade: 0,
    vida: 0.32,
    inicio: RAIO * 0.2,
    fim: RAIO * 1.6,
    espessura: 0.16,
    r: 255,
    g: 255,
    b: 255,
    branco: true,
    suave: true,
    preenche: true,
  });
  anel(x, y, z, {
    idade: 0,
    vida: vidaAnel,
    inicio: RAIO * 0.35,
    fim: RAIO * 2.8,
    espessura: 0.07,
    r: BRANCO_ENVIO[0],
    g: BRANCO_ENVIO[1],
    b: BRANCO_ENVIO[2],
    branco: true,
  });
  anel(x, y, z, {
    idade: -0.06,
    vida: vidaAnel + 0.08,
    inicio: RAIO * 0.45,
    fim: RAIO * 2.8 * 1.15,
    espessura: 0.07 * 0.85,
    r: VERMELHO_ENVIO[0],
    g: VERMELHO_ENVIO[1],
    b: VERMELHO_ENVIO[2],
    branco: false,
  });

  faiscaSolta(x, y, z, {
    conta: 18,
    vida: 0.48,
    velMin: 2.8,
    velMax: 7.2,
    tamMin: 0.05,
    tamMax: 0.13,
    rgb: BRANCO_ENVIO,
    chanceBranco: 0.35,
    sobe: 0.15,
    chanceTraco: 0.55,
    chanceEstrela: 0.7,
  });
  faiscaSolta(x, y, z, {
    conta: 10,
    vida: 0.48,
    velMin: 2,
    velMax: 5.4,
    tamMin: 0.04,
    tamMax: 0.1,
    rgb: acento,
    chanceBranco: 0.2,
    sobe: 0.2,
    chanceTraco: 0.35,
    chanceEstrela: 0.45,
  });
  faiscaSolta(x, y, z, {
    conta: 8,
    vida: 0.48 * 0.85,
    velMin: 1.6,
    velMax: 4.2,
    tamMin: 0.035,
    tamMax: 0.09,
    rgb: VERMELHO_ENVIO,
    chanceBranco: 0.1,
    sobe: 0.1,
    chanceTraco: 0.5,
    chanceEstrela: 0.55,
  });

  ator.brilhoBola = Math.max(ator.brilhoBola || 0, 0.4);
  ator.brilhoBolaTipo = "envio";
  flashMundo(x, y, z, RAIO, "envio", 0.4);
}

export function soltarFxRecolher(ator) {
  tocarRecolherBola();
  if (!pode(ator)) return;
  const acento = acentoDe(ator);
  const z = ator.elevacao ?? ator.z ?? 0;
  const x = ator.x;
  const y = ator.y;
  const vidaAnel = 0.42;

  anel(x, y, z, {
    idade: 0,
    vida: vidaAnel,
    inicio: RAIO * 2.6,
    fim: RAIO * 0.25,
    espessura: 0.08,
    r: VERMELHO_RECOLHER[0],
    g: VERMELHO_RECOLHER[1],
    b: VERMELHO_RECOLHER[2],
    branco: false,
  });
  anel(x, y, z, {
    idade: -0.07,
    vida: vidaAnel + 0.06,
    inicio: RAIO * 2.6 * 1.2,
    fim: RAIO * 0.15,
    espessura: 0.08 * 0.9,
    r: BRANCO_RECOLHER[0],
    g: BRANCO_RECOLHER[1],
    b: BRANCO_RECOLHER[2],
    branco: true,
  });
  anel(x, y, z, {
    idade: 0.05,
    vida: 0.28,
    inicio: RAIO * 0.15,
    fim: RAIO * 1.35,
    espessura: 0.14,
    r: 255,
    g: 255,
    b: 255,
    branco: true,
    suave: true,
    preenche: true,
  });

  faiscaPuxa(x, y, z, {
    conta: 20,
    vida: 0.5,
    raioMin: RAIO * 0.7,
    raioMax: RAIO * 2.4,
    velMin: 1.8,
    velMax: 4.6,
    tamMin: 0.04,
    tamMax: 0.11,
    rgb: VERMELHO_RECOLHER,
    chanceBranco: 0.25,
    chanceEstrela: 0.65,
    puxa: 14,
  });
  faiscaPuxa(x, y, z, {
    conta: 10,
    vida: 0.5,
    raioMin: RAIO * 0.55,
    raioMax: RAIO * 2.4 * 0.85,
    velMin: 1.2,
    velMax: 3.4,
    tamMin: 0.035,
    tamMax: 0.09,
    rgb: acento,
    chanceBranco: 0.35,
    chanceEstrela: 0.4,
    puxa: 14 * 0.9,
  });

  ator.brilhoBola = Math.max(ator.brilhoBola || 0, 0.35);
  ator.brilhoBolaTipo = "recolher";
  flashMundo(x, y, z, RAIO, "recolher", 0.35);
}

export function tickFxBola(dt) {
  if (dt <= 0) return;
  const amortece = Math.max(0, 1 - ARRASTO * dt);
  const amortecePuxa = Math.max(0, 1 - 2.2 * dt);

  for (let i = 0; i < faiscas.length; i++) {
    const p = faiscas[i];
    if (!p.viva) continue;
    p.vida -= dt;
    if (p.puxa) {
      const dx = p.ox - p.x;
      const dy = p.oy - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      const forca = p.puxa * (0.65 + 0.9 * (1 - Math.min(1, dist / 2.5)));
      p.vx += (dx / dist) * forca * dt;
      p.vy += (dy / dist) * forca * dt;
      p.vx *= amortecePuxa;
      p.vy *= amortecePuxa;
      if (dist < 0.08) p.vida = Math.min(p.vida, 0.04);
    } else {
      p.vx *= amortece;
      p.vy *= amortece;
      p.vy -= 1.2 * dt;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.vida <= 0) p.viva = false;
  }

  for (let i = 0; i < aneis.length; i++) {
    const an = aneis[i];
    if (!an.viva) continue;
    an.idade += dt;
    if (an.idade >= 0) an.vida -= dt;
    if (an.vida <= 0 && an.idade >= 0) an.viva = false;
  }

  for (let i = 0; i < flashes.length; i++) {
    const f = flashes[i];
    if (!f.viva) continue;
    f.vida -= dt;
    if (f.vida <= 0) f.viva = false;
  }
}

export function faiscasBola() {
  return faiscas;
}

export function aneisBola() {
  return aneis;
}

export function flashesBola() {
  return flashes;
}
