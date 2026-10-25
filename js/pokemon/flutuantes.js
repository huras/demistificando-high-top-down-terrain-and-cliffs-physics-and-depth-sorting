/**
 * Texto de combate flutuante estilo Ragnarok / Pokémon AI:
 * pop de escala, arco com gravidade, drift e fade só no fim.
 */

const ESTILO = {
  super: { cor: "#fb923c", escala: 1.45 },
  resist: { cor: "#7dd3fc", escala: 1.05 },
  immune: { cor: "#94a3b8", escala: 1 },
  miss: { cor: "#cbd5e1", escala: 1 },
  heal: { cor: "#4ade80", escala: 1.2 },
  move: { cor: "#e2e8f0", escala: 1.05 },
  default: { cor: "#f8fafc", escala: 1.2 },
};

const VIDA = 0.9;
const SUBIDA = 3.1;
const GRAVIDADE = 4.2;
const DERIVA = 0.85;
const JITTER = 0.4;
const ALTURA_PADRAO = 1.7;
const MAX = 28;

const lista = [];
const pilhaPorAlvo = new WeakMap();

function estiloDe(opts, texto) {
  if (opts.efeito && ESTILO[opts.efeito]) return ESTILO[opts.efeito];
  if (opts.miss) return ESTILO.miss;
  if (opts.heal) return ESTILO.heal;
  const t = String(texto || "");
  if (/^(errou|miss|rolou|cobriu|imune|falhou)$/i.test(t)) return ESTILO.miss;
  if (t.startsWith("+")) return ESTILO.heal;
  if (t && !/^[+\-]?\d+(\.\d+)?!?$/.test(t) && t.length > 2) return ESTILO.move;
  return ESTILO.default;
}

/**
 * @param {object} alvo
 * @param {string|number} texto
 * @param {string} [cor]
 * @param {{
 *   efeito?: string,
 *   miss?: boolean,
 *   heal?: boolean,
 *   escala?: number,
 *   escalaMul?: number,
 *   altura?: number,
 * }} [opts]
 */
export function flutuar(alvo, texto, cor, opts = {}) {
  if (!alvo || texto == null) return;
  if (!Number.isFinite(alvo.x) || !Number.isFinite(alvo.y)) return;
  if (lista.length >= MAX) lista.shift();

  const estilo = estiloDe(opts, texto);
  let pilha = 1;
  if (alvo && typeof alvo === "object") {
    pilha = (pilhaPorAlvo.get(alvo) || 0) + 1;
    pilhaPorAlvo.set(alvo, pilha);
  }
  const stackN = ((pilha - 1) % 5) - 2;
  const baseZ = Number.isFinite(alvo.z)
    ? alvo.z
    : Number.isFinite(alvo.elevacao)
      ? alvo.elevacao
      : 0;
  const ehGolpe = estilo === ESTILO.move;
  const altura = Number.isFinite(opts.altura)
    ? opts.altura
    : ehGolpe
      ? ALTURA_PADRAO + 0.55
      : ALTURA_PADRAO;
  const escalaEstilo = Number.isFinite(opts.escala) ? opts.escala : estilo.escala;
  const escalaMul = Number.isFinite(opts.escalaMul) ? opts.escalaMul : 1;
  const deriva = ehGolpe ? DERIVA * 0.4 : DERIVA;

  lista.push({
    x: alvo.x + (Math.random() - 0.5) * JITTER + stackN * 0.18,
    y: alvo.y + (Math.random() - 0.5) * (JITTER * 0.35),
    z: baseZ + altura,
    vx: (Math.random() - 0.5) * deriva,
    vy: (Math.random() - 0.5) * deriva,
    vz: SUBIDA * (0.85 + Math.random() * 0.35),
    life: VIDA,
    maxLife: VIDA,
    texto: String(texto),
    cor: cor || estilo.cor,
    escala: escalaEstilo * escalaMul,
    pop: 1.45,
  });
}

export function tickFlutuantes(dt) {
  if (lista.length === 0) return;
  const passo = dt > 0 ? dt : 0;
  for (let i = lista.length - 1; i >= 0; i--) {
    const f = lista[i];
    f.life -= passo;
    f.vz -= GRAVIDADE * passo;
    f.x += f.vx * passo;
    f.y += f.vy * passo;
    f.z += f.vz * passo;
    // Punch-in rápido, depois assenta (pop RO).
    if (f.pop > 1) f.pop = Math.max(1, f.pop - passo * 3.2);
    if (f.life <= 0) lista.splice(i, 1);
  }
}

export function flutuantes() {
  return lista;
}

export function limparFlutuantes() {
  lista.length = 0;
}
