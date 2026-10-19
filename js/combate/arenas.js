/** Metades da arena e os discos de cobertura. Sem Three e sem DOM. */

const LADOS = ["esquerda", "direita"];

const METADE = {
  esquerda: "normal",
  direita: "normal",
};

const MOLDE = [
  { along: 2.35, ladoY: 1.65, indice: 0 },
  { along: 1.85, ladoY: -1.5, indice: 1 },
  { along: 3.35, ladoY: 0.15, indice: 2 },
];

const ARVORES = [
  { url: "assets/trees/broadleaf.png", r: 0.55 },
  { url: "assets/trees/large-broadleaf.png", r: 0.7 },
  { url: "assets/trees/tall-tree-light-green.png", r: 0.9 },
];

const ROCHAS = [
  { url: "assets/rocks/stone-rock-a.png", r: 0.78 },
  { url: "assets/rocks/stone-rock-b.png", r: 0.42 },
  { url: "assets/rocks/big-rock.png", r: 0.85 },
];

export const CHAO = {
  planta: "assets/terrain/skins/brow-dirt-skin.png",
  pedra: "assets/terrain/centro/stone.png",
};

/** Touceiras da metade planta. Não bloqueiam. `toque` é o raio de contato do fogo futuro. */
const GRAMAS = [
  { url: "assets/vegetation/tuft.png", peso: 1.55 },
  { url: "assets/vegetation/green-grass.png", peso: 0.4 },
  { url: "assets/vegetation/greeny-grass.png", peso: 0.3 },
  { url: "assets/vegetation/grass.png", peso: 0.35 },
  { url: "assets/vegetation/jungle-grass.png", peso: 0.1 },
];

const N_GRAMA = 12;
const TOQUE_GRAMA = 0.32;

const pecas = [];
for (let i = 0; i < 6; i++) {
  pecas.push({ x: 0, y: 0, r: 0, url: "", tipo: "", lado: "" });
}

const gramas = [];
for (let i = 0; i < N_GRAMA * 2; i++) {
  gramas.push({ x: 0, y: 0, toque: TOQUE_GRAMA, url: "", lado: "" });
}

let nPecas = 0;
let nGramas = 0;
let versao = 0;
let semente = 0;

const batida = { x: 0, y: 0 };

function tipoValido(tipo) {
  return tipo === "normal" || tipo === "pedra" || tipo === "planta";
}

function catalogo(tipo) {
  if (tipo === "planta") return ARVORES;
  if (tipo === "pedra") return ROCHAS;
  return null;
}

function aleatorio(s) {
  let a = s | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cabe(x, y, r, n) {
  if (x * x + y * y > 8.4 * 8.4) return false;
  const casa = x < 0 ? -5.2 : 5.2;
  if (Math.hypot(x - casa, y) < r + 1.05) return false;
  for (let i = 0; i < n; i++) {
    const outra = pecas[i];
    if (Math.hypot(x - outra.x, y - outra.y) < r + outra.r + 0.4) return false;
  }
  return true;
}

function plantar(peca, visual, x, y, tipo, lado) {
  peca.x = x;
  peca.y = y;
  peca.r = visual.r;
  peca.url = visual.url;
  peca.tipo = tipo;
  peca.lado = lado;
}

function espalhar(lado, lista, rng) {
  const sinal = lado === "esquerda" ? -1 : 1;
  const ordem = [0, 1, 2];
  for (let i = ordem.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = ordem[i];
    ordem[i] = ordem[j];
    ordem[j] = tmp;
  }
  for (let i = 0; i < ordem.length; i++) {
    const visual = lista[ordem[i]];
    let x = sinal * 2.4;
    let y = (i - 1) * 1.8;
    let achou = false;
    for (let t = 0; t < 40; t++) {
      const along = 1.35 + rng() * 2.75;
      const ladoY = (rng() * 2 - 1) * 3.8;
      if (!cabe(sinal * along, ladoY, visual.r, nPecas)) continue;
      x = sinal * along;
      y = ladoY;
      achou = true;
      break;
    }
    if (!achou) {
      for (let along = 1.4; along <= 4.05 && !achou; along += 0.32) {
        for (let ladoY = -3.6; ladoY <= 3.6; ladoY += 0.32) {
          if (!cabe(sinal * along, ladoY, visual.r, nPecas)) continue;
          x = sinal * along;
          y = ladoY;
          achou = true;
          break;
        }
      }
    }
    plantar(pecas[nPecas], visual, x, y, METADE[lado], lado);
    nPecas += 1;
  }
}

function sortearGrama(rng) {
  let soma = 0;
  for (let i = 0; i < GRAMAS.length; i++) soma += GRAMAS[i].peso;
  let acc = rng() * soma;
  for (let i = 0; i < GRAMAS.length; i++) {
    acc -= GRAMAS[i].peso;
    if (acc <= 0) return GRAMAS[i];
  }
  return GRAMAS[0];
}

function cabeGrama(x, y, sinal) {
  if (x * sinal < 0.55) return false;
  if (x * x + y * y > 8.6 * 8.6) return false;
  if (Math.hypot(x - sinal * 5.2, y) < 1.2) return false;
  for (let i = 0; i < nPecas; i++) {
    const peca = pecas[i];
    if (Math.hypot(x - peca.x, y - peca.y) < peca.r + 0.45) return false;
  }
  for (let i = 0; i < nGramas; i++) {
    const outra = gramas[i];
    if (Math.hypot(x - outra.x, y - outra.y) < 0.95) return false;
  }
  return true;
}

function semearGrama(lado, rng) {
  const sinal = lado === "esquerda" ? -1 : 1;
  for (let i = 0; i < N_GRAMA; i++) {
    const visual = sortearGrama(rng);
    let x = 0;
    let y = 0;
    let achou = false;
    for (let t = 0; t < 36; t++) {
      const along = 0.8 + rng() * 7.2;
      const ladoY = (rng() * 2 - 1) * 7.4;
      if (!cabeGrama(sinal * along, ladoY, sinal)) continue;
      x = sinal * along;
      y = ladoY;
      achou = true;
      break;
    }
    if (!achou) {
      for (let along = 0.9; along <= 8.1 && !achou; along += 0.7) {
        for (let ladoY = -7.2; ladoY <= 7.2; ladoY += 0.7) {
          if (!cabeGrama(sinal * along, ladoY, sinal)) continue;
          x = sinal * along;
          y = ladoY;
          achou = true;
          break;
        }
      }
    }
    if (!achou) continue;
    const tufo = gramas[nGramas];
    tufo.x = x;
    tufo.y = y;
    tufo.toque = TOQUE_GRAMA;
    tufo.url = visual.url;
    tufo.lado = lado;
    nGramas += 1;
  }
}

function remontar() {
  nPecas = 0;
  nGramas = 0;
  const rng = semente === 0 ? null : aleatorio(semente);
  for (let s = 0; s < LADOS.length; s++) {
    const lado = LADOS[s];
    const lista = catalogo(METADE[lado]);
    if (!lista) continue;
    if (!rng) {
      const sinal = lado === "esquerda" ? -1 : 1;
      for (let i = 0; i < MOLDE.length; i++) {
        const molde = MOLDE[i];
        plantar(pecas[nPecas], lista[molde.indice], sinal * molde.along, molde.ladoY, METADE[lado], lado);
        nPecas += 1;
      }
      continue;
    }
    espalhar(lado, lista, rng);
  }
  const rngGrama = aleatorio((semente + 0x9e3779b9) | 0);
  for (let s = 0; s < LADOS.length; s++) {
    const lado = LADOS[s];
    if (METADE[lado] !== "planta") continue;
    semearGrama(lado, rngGrama);
  }
  versao += 1;
}

export function definirSemente(n) {
  const s = Number.isFinite(n) ? n | 0 : 0;
  if (s === semente) return versao;
  semente = s;
  remontar();
  return versao;
}

export function sementeCobertura() {
  return semente;
}

export function definirMetade(lado, tipo) {
  if (!METADE[lado] || !tipoValido(tipo) || METADE[lado] === tipo) return versao;
  METADE[lado] = tipo;
  remontar();
  return versao;
}

export function tipoMetade(lado) {
  return METADE[lado] || "normal";
}

export function versaoCobertura() {
  return versao;
}

export function quantidadeCobertura() {
  return nPecas;
}

export function pecaCobertura(i) {
  return pecas[i];
}

export function quantidadeGrama() {
  return nGramas;
}

export function pecaGrama(i) {
  return gramas[i];
}

function raiz(a, b, c) {
  if (a <= 1e-8) return c <= 0 ? 0 : -1;
  const delta = b * b - 4 * a * c;
  if (delta < 0) return -1;
  const t = (-b - Math.sqrt(delta)) / (2 * a);
  if (t < 0 || t > 1) return -1;
  return t;
}

export function bloqueioNoTrecho(x0, y0, x1, y1, raio) {
  if (nPecas === 0) return null;
  const extra = raio > 0 ? raio : 0;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const a = dx * dx + dy * dy;
  let melhor = 2;
  let hx = x1;
  let hy = y1;
  for (let i = 0; i < nPecas; i++) {
    const peca = pecas[i];
    const fx = x0 - peca.x;
    const fy = y0 - peca.y;
    const dentro = fx * fx + fy * fy <= (peca.r + extra) * (peca.r + extra);
    if (dentro) {
      melhor = 0;
      hx = x0;
      hy = y0;
      break;
    }
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - (peca.r + extra) * (peca.r + extra);
    const t = raiz(a, b, c);
    if (t < 0 || t >= melhor) continue;
    melhor = t;
    hx = x0 + dx * t;
    hy = y0 + dy * t;
  }
  if (melhor > 1) return null;
  batida.x = hx;
  batida.y = hy;
  return batida;
}

export function cortaVisada(x0, y0, x1, y1) {
  if (nPecas === 0) return false;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const a = dx * dx + dy * dy;
  if (a < 1e-6) return false;
  for (let i = 0; i < nPecas; i++) {
    const peca = pecas[i];
    const fx = x0 - peca.x;
    const fy = y0 - peca.y;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - peca.r * peca.r;
    const t = raiz(a, b, c);
    if (t > 0.08 && t < 0.92) return true;
  }
  return false;
}

const CENARIOS = [
  ["normal", "normal"],
  ["normal", "normal"],
  ["normal", "normal"],
  ["normal", "normal"],
  ["planta", "pedra"],
  ["pedra", "planta"],
  ["planta", "planta"],
  ["pedra", "pedra"],
  ["planta", "normal"],
  ["normal", "pedra"],
];

const sonda = { bloqueia: 0, lado: 0, frente: 0, folga: 1, pertoLado: 0 };
const rumo = { x: 0, y: 0, desviou: 0 };

export function definirCenario(esquerda, direita) {
  let mudou = false;
  if (tipoValido(esquerda) && METADE.esquerda !== esquerda) {
    METADE.esquerda = esquerda;
    mudou = true;
  }
  if (tipoValido(direita) && METADE.direita !== direita) {
    METADE.direita = direita;
    mudou = true;
  }
  if (mudou) remontar();
  return versao;
}

export function cenarioIndice(i) {
  const par = CENARIOS[((i % CENARIOS.length) + CENARIOS.length) % CENARIOS.length];
  return definirCenario(par[0], par[1]);
}

export function cenarioAleatorio(rng) {
  definirSemente(1 + Math.floor(rng() * 0x7ffffffe));
  return cenarioIndice(Math.floor(rng() * CENARIOS.length));
}

function ladoDoBloqueio(x, y, x1, y1, fx, fy) {
  const dx = x1 - x;
  const dy = y1 - y;
  const a = dx * dx + dy * dy;
  let melhor = 2;
  let lado = 1;
  for (let i = 0; i < nPecas; i++) {
    const peca = pecas[i];
    const fx0 = x - peca.x;
    const fy0 = y - peca.y;
    const b = 2 * (fx0 * dx + fy0 * dy);
    const c = fx0 * fx0 + fy0 * fy0 - peca.r * peca.r;
    const t = raiz(a, b, c);
    if (t <= 0.08 || t >= 0.92 || t >= melhor) continue;
    melhor = t;
    const lat = (peca.x - x) * -fy + (peca.y - y) * fx;
    lado = lat >= 0 ? -1 : 1;
  }
  return lado;
}

/** Cobertura no referencial de quem olha para o alvo. Objeto reutilizado. */
export function sondarCobertura(x, y, fx, fy, destX, destY, corpo) {
  sonda.bloqueia = 0;
  sonda.lado = 0;
  sonda.frente = 0;
  sonda.folga = 1;
  sonda.pertoLado = 0;
  if (nPecas === 0) return sonda;
  const raio = corpo > 0 ? corpo : 0.34;
  if (destX !== undefined && destY !== undefined && cortaVisada(x, y, destX, destY)) sonda.bloqueia = 1;
  let melhor = 1e9;
  let folgaMin = 99;
  let pertoLat = 0;
  const alcance = 3.6;
  for (let i = 0; i < nPecas; i++) {
    const peca = pecas[i];
    const dx = peca.x - x;
    const dy = peca.y - y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const folga = dist - peca.r - raio;
    if (folga < folgaMin) {
      folgaMin = folga;
      pertoLat = (dx * -fy + dy * fx) / dist;
    }
    const along = dx * fx + dy * fy;
    const lat = dx * -fy + dy * fx;
    const margem = peca.r + raio + 0.28;
    if (along < -0.1 || along > alcance) continue;
    if (Math.abs(lat) > margem && folga > 0.2) continue;
    const urg = Math.max(0, along) + Math.max(0, folga) * 0.4;
    if (urg >= melhor) continue;
    melhor = urg;
    sonda.lado = lat >= 0 ? -1 : 1;
    sonda.frente = Math.max(0, Math.min(1, 1 - Math.max(0, along - peca.r) / alcance));
  }
  if (folgaMin < 99) sonda.folga = Math.max(0, Math.min(1, folgaMin / 2.4));
  sonda.pertoLado = Math.max(-1, Math.min(1, pertoLat));
  if (sonda.lado === 0 && sonda.bloqueia) sonda.lado = ladoDoBloqueio(x, y, destX, destY, fx, fy);
  return sonda;
}

/** Desvia o passo se a reta entra num disco. Objeto reutilizado. */
export function desviarRumo(x, y, wx, wy, corpo) {
  const m = Math.hypot(wx, wy);
  if (m < 1e-6 || nPecas === 0) {
    rumo.x = wx;
    rumo.y = wy;
    rumo.desviou = 0;
    return rumo;
  }
  const fx = wx / m;
  const fy = wy / m;
  const lx = -fy;
  const ly = fx;
  const raio = corpo > 0 ? corpo : 0.34;
  const alcance = 2.8;
  let melhor = 1e9;
  let lado = 0;
  let peso = 0;
  for (let i = 0; i < nPecas; i++) {
    const peca = pecas[i];
    const dx = peca.x - x;
    const dy = peca.y - y;
    const along = dx * fx + dy * fy;
    const lat = dx * lx + dy * ly;
    const margem = peca.r + raio + 0.2;
    if (along < -0.05 || along > alcance + peca.r) continue;
    if (Math.abs(lat) > margem) continue;
    const urg = along + Math.abs(lat) * 0.25;
    if (urg >= melhor) continue;
    melhor = urg;
    lado = lat >= 0 ? -1 : 1;
    const aperto = 1 - Math.max(0, Math.min(1, (along - peca.r) / alcance));
    const cheio = 1 - Math.abs(lat) / margem;
    peso = 0.55 + 0.45 * Math.max(aperto, cheio);
  }
  if (lado === 0) {
    rumo.x = fx;
    rumo.y = fy;
    rumo.desviou = 0;
    return rumo;
  }
  const empurra = Math.max(0, Math.min(1, peso));
  const ox = fx * (1 - empurra * 0.65) + lx * lado * empurra;
  const oy = fy * (1 - empurra * 0.65) + ly * lado * empurra;
  const om = Math.hypot(ox, oy) || 1;
  rumo.x = ox / om;
  rumo.y = oy / om;
  rumo.desviou = 1;
  return rumo;
}

export function empurrarCorpo(ator, raio) {
  if (!ator || nPecas === 0) return;
  const corpo = raio > 0 ? raio : 0.34;
  for (let volta = 0; volta < 2; volta++) {
    for (let i = 0; i < nPecas; i++) {
      const peca = pecas[i];
      let dx = ator.x - peca.x;
      let dy = ator.y - peca.y;
      const lim = peca.r + corpo;
      const dist2 = dx * dx + dy * dy;
      if (dist2 >= lim * lim) continue;
      if (dist2 < 1e-8) {
        dx = 1;
        dy = 0;
      }
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const k = lim / dist;
      ator.x = peca.x + dx * k;
      ator.y = peca.y + dy * k;
    }
  }
}
