import { ALTURA_BLOCO } from "../../../../config.js";
import { emitirImpacto } from "../impacto.js";
import { PadraoBase } from "../padraoBase.js";
import { emitir, spritesArco } from "../poolParticulas3d.js";
import { emitirRastro } from "../rastro.js";

/** Cast ranged — ki burst + trail hint (projéteis já levam folha). */
export class PadraoCastRanged extends PadraoBase {
  iniciar(origem, alvo, def, elemento, opts = {}) {
    super.iniciar(origem, alvo, def, elemento, opts);
    this.duracao = opts.jato ? 0.55 : 0.32;
    this.jato = !!opts.jato;
    const z = this.peito(origem);
    const dx = this.mx - origem.x;
    const dy = this.my - origem.y;
    const len = Math.hypot(dx, dy) || 1;
    this.dirX = dx / len;
    this.dirY = dy / len;
    emitirImpacto(elemento, origem.x + this.dirX * 0.4, origem.y + this.dirY * 0.4, z, 0.45 * this.escala);
  }

  atualizar(dt) {
    if (!this.ativo || !this.origem || !this.elemento) return;
    this.tempo += dt;
    if (this.jato) {
      const a = this.origem;
      const z = this.peito(a);
      emitirRastro(
        this.elemento,
        a.x + this.dirX * 0.6,
        a.y + this.dirY * 0.6,
        z,
        this.dirX * 10,
        this.dirY * 10,
        dt,
        this.escala * 0.85,
      );
    }
    if (this.tempo >= this.duracao) this.encerrar();
  }
}

/** Water Gun — orbe denso + rastro (além do projétil). */
export class PadraoPistola extends PadraoBase {
  iniciar(origem, alvo, def, elemento, opts = {}) {
    super.iniciar(origem, alvo, def, elemento, opts);
    this.duracao = 0.45;
    const z = this.peito(origem);
    const dx = this.mx - origem.x;
    const dy = this.my - origem.y;
    const len = Math.hypot(dx, dy) || 1;
    this.dirX = dx / len;
    this.dirY = dy / len;
    for (let i = 0; i < 14; i++) {
      emitir({
        x: origem.x + this.dirX * (0.3 + i * 0.08),
        y: origem.y + this.dirY * (0.3 + i * 0.08),
        z: z + Math.sin(i) * 0.05,
        vx: this.dirX * (6 + i * 0.3),
        vy: this.dirY * (6 + i * 0.3),
        vz: 0.5,
        cor: i % 3 === 0 ? elemento.nucleo : elemento.primaria,
        vida: 0.28,
        tam: 0.16,
        modo: "faisca",
      });
    }
  }

  atualizar(dt) {
    if (!this.ativo) return;
    this.tempo += dt;
    if (this.tempo >= this.duracao) this.encerrar();
  }
}

/** Swift — estrelas procedurais nas sprites de arco. */
export class PadraoSwift extends PadraoBase {
  iniciar(origem, alvo, def, elemento, opts = {}) {
    super.iniciar(origem, alvo, def, elemento, opts);
    this.duracao = 0.7;
    this.estrelas = [];
    const dx = this.mx - origem.x;
    const dy = this.my - origem.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;
    const z = this.peito(origem);
    for (let i = 0; i < 5; i++) {
      const lat = (i - 2) * 0.35;
      this.estrelas.push({
        x: origem.x + ux * 0.5 + px * lat,
        y: origem.y + uy * 0.5 + py * lat,
        z: z + (i % 2) * 0.15,
        vx: ux * (9 + i * 0.4),
        vy: uy * (9 + i * 0.4),
        vida: 0.55,
        idade: 0,
        fase: i * 0.7,
      });
    }
  }

  atualizar(dt) {
    if (!this.ativo) return;
    this.tempo += dt;
    const lista = spritesArco();
    let slot = 0;
    for (let i = 0; i < this.estrelas.length; i++) {
      const e = this.estrelas[i];
      e.idade += dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      emitirRastro(this.elemento, e.x, e.y, e.z, e.vx, e.vy, dt, 0.55);
      if (slot < lista.length && e.idade < e.vida) {
        const spr = lista[slot++];
        const t = 1 - e.idade / e.vida;
        const pulso = 0.85 + Math.sin(this.tempo * 14 + e.fase) * 0.2;
        spr.visible = true;
        spr.material.color.set(this.elemento.nucleo);
        spr.material.opacity = t * 0.95;
        spr.material.rotation = this.tempo * 3 + e.fase;
        const s = 0.28 * pulso * t;
        spr.scale.set(s, s, 1);
        spr.position.set(e.x, Math.max(0.1, e.z * ALTURA_BLOCO), e.y);
      }
    }
    for (let i = slot; i < lista.length; i++) {
      lista[i].visible = false;
      lista[i].material.opacity = 0;
    }
    if (this.tempo >= this.duracao) this.encerrar();
  }
}
