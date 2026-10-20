/** Ciclo de vida de um padrão visual de golpe. */

export class PadraoBase {
  constructor() {
    this.ativo = false;
    this.origem = null;
    this.alvo = null;
    this.def = null;
    this.elemento = null;
    this.tempo = 0;
    this.duracao = 0.5;
    this.escala = 1;
    this.mx = 0;
    this.my = 0;
  }

  /**
   * @param {object} origem
   * @param {object|null} alvo
   * @param {object} def
   * @param {import('./elementos.js').ConfigElemento} elemento
   * @param {object} [opts]
   */
  iniciar(origem, alvo, def, elemento, opts = {}) {
    this.ativo = true;
    this.origem = origem;
    this.alvo = alvo;
    this.def = def;
    this.elemento = elemento;
    this.tempo = 0;
    this.escala = opts.escala > 0 ? opts.escala : 1;
    if (alvo) {
      this.mx = alvo.x;
      this.my = alvo.y;
    } else {
      this.mx = origem.x + (origem.dirX || 0) * 2;
      this.my = origem.y + (origem.dirY || 1) * 2;
    }
  }

  /** @param {number} dt */
  atualizar(dt) {
    if (!this.ativo) return;
    this.tempo += dt;
    if (this.tempo >= this.duracao) this.encerrar();
  }

  encerrar() {
    this.ativo = false;
    this.origem = null;
    this.alvo = null;
  }

  vivo() {
    return this.ativo;
  }

  /** Altura de peito do ator (unidades de elevação). */
  peito(ator) {
    if (!ator) return 1.2;
    return (ator.elevacao ?? ator.z ?? 0) + (ator.hopLift || 0) + 1.15;
  }
}
