export const EMOCAO = Object.freeze({
  EXCLAMACAO: 0,
  INTERROGACAO: 1,
  MUSICA: 2,
  CORACAO: 3,
  RAIVA: 4,
  SUOR: 5,
  TEIA: 6,
  SILENCIO: 7,
  LAMPADA: 8,
  ZZZ: 9,
});

export const EMOCAO_ANIM = 0.8;
export const EMOCAO_LIMPA = 2;
/** Intervalo entre balões de raiva em agro (início→início). */
export const RAIVA_AGRO_INTERVALO = 2;

let imagem = null;

export function carregarEmocoes() {
  if (imagem) return;
  const img = new Image();
  img.src = "/ref/sprites/ui/emotions.png";
  imagem = img;
}

export function folhaEmocoes() {
  if (!imagem?.complete || imagem.naturalWidth <= 0) return null;
  return imagem;
}

export function definirEmocao(ator, tipo, opts = {}) {
  if (!ator) return;
  ator.emocao = tipo | 0;
  ator.emocaoIdade = 0;
  ator.emocaoPresa = !!opts.presa;
  ator.emocaoAte = opts.duracao > 0 ? opts.duracao : EMOCAO_LIMPA;
}

export function limparEmocao(ator) {
  if (!ator) return;
  ator.emocao = null;
  ator.emocaoPresa = false;
  ator.emocaoIdade = 0;
}

function estaDormindo(ator) {
  return !!(ator.sonoNatural || (ator.dormindo || 0) > 0 || ator.status === "sleep");
}

function ehAgroEstado(ator) {
  return ator.faccao === "selvagem" && !!(ator.hostil || ator.modo === "agro");
}

/** Mantém ZZZ preso; RAIVA em agro pulsa a cada RAIVA_AGRO_INTERVALO. */
export function sincronizarEmocaoEstado(ator) {
  if (!ator || ator.morto || ator.capturado) return;
  // One-shot (EXCLAMACAO, SUOR, raiva em pulso, etc.): deixa expirar.
  if (ator.emocao != null && !ator.emocaoPresa) return;

  if (estaDormindo(ator)) {
    ator._raivaCd = 0;
    if (ator.emocao !== EMOCAO.ZZZ || !ator.emocaoPresa) {
      definirEmocao(ator, EMOCAO.ZZZ, { presa: true });
    }
    return;
  }

  if (ehAgroEstado(ator)) {
    // Sai de ZZZ preso se acordou em agro.
    if (ator.emocaoPresa && ator.emocao === EMOCAO.ZZZ) limparEmocao(ator);
    if ((ator._raivaCd || 0) > 0) return;
    definirEmocao(ator, EMOCAO.RAIVA, { duracao: EMOCAO_ANIM });
    ator._raivaCd = RAIVA_AGRO_INTERVALO;
    return;
  }

  ator._raivaCd = 0;
  if (
    ator.emocaoPresa &&
    (ator.emocao === EMOCAO.ZZZ || ator.emocao === EMOCAO.RAIVA)
  ) {
    limparEmocao(ator);
  }
}

export function tickEmocoes(atores, dt) {
  for (let i = 0; i < atores.length; i++) {
    const a = atores[i];
    if ((a._raivaCd || 0) > 0) {
      a._raivaCd = Math.max(0, a._raivaCd - dt);
    }
    if (a.emocao == null) continue;
    a.emocaoIdade += dt;
    // Morto: suor não fica preso animando — limpa após um ciclo.
    if (a.morto && a.emocaoIdade >= EMOCAO_ANIM) {
      limparEmocao(a);
      continue;
    }
    if (!a.emocaoPresa && a.emocaoIdade >= a.emocaoAte) limparEmocao(a);
  }
}

export function colunaEmocao(ator) {
  if (ator.emocao == null) return 0;
  const t = ator.emocaoIdade;
  // Loop só com presa (estado ZZZ/RAIVA); one-shot congela no último frame.
  if (ator.emocaoPresa) {
    const u = (t % EMOCAO_ANIM) / EMOCAO_ANIM;
    return Math.min(7, Math.floor(u * 8));
  }
  if (t >= EMOCAO_ANIM) return 7;
  const u = t / EMOCAO_ANIM;
  return Math.min(7, Math.floor(u * 8));
}
