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

export function tickEmocoes(atores, dt) {
  for (let i = 0; i < atores.length; i++) {
    const a = atores[i];
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
  // Uma passada só: presa/vivo não loopa frame (morte usava presa e ficava infinito).
  if (t >= EMOCAO_ANIM) return 7;
  const u = t / EMOCAO_ANIM;
  return Math.min(7, Math.floor(u * 8));
}
