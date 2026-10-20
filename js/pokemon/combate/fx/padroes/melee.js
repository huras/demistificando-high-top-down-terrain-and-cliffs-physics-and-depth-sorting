import { emitirImpacto } from "../impacto.js";
import { PadraoBase } from "../padraoBase.js";
import { emitir } from "../poolParticulas3d.js";
import { emitirRastro } from "../rastro.js";

/** Investida / Tackle / Quick Attack — rastro de dash + impacto. */
export class PadraoInvestida extends PadraoBase {
  iniciar(origem, alvo, def, elemento, opts = {}) {
    super.iniciar(origem, alvo, def, elemento, opts);
    this.duracao = opts.rapido ? 0.28 : 0.42;
    this.fase = "dash";
    this.hit = false;
    const dx = this.mx - origem.x;
    const dy = this.my - origem.y;
    const len = Math.hypot(dx, dy) || 1;
    this.dirX = dx / len;
    this.dirY = dy / len;
    // Flash no caster.
    const z = this.peito(origem);
    for (let i = 0; i < 8; i++) {
      emitir({
        x: origem.x,
        y: origem.y,
        z,
        vx: this.dirX * (2 + i * 0.4) + (Math.random() - 0.5),
        vy: this.dirY * (2 + i * 0.4) + (Math.random() - 0.5),
        vz: 1.2 + Math.random(),
        cor: elemento.nucleo,
        vida: 0.22,
        tam: 0.14,
        modo: "faisca",
      });
    }
  }

  atualizar(dt) {
    if (!this.ativo || !this.origem || !this.elemento) return;
    this.tempo += dt;
    const a = this.origem;
    const z = this.peito(a);
    if (this.fase === "dash") {
      emitirRastro(this.elemento, a.x, a.y, z, this.dirX * 8, this.dirY * 8, dt, this.escala);
      // Poeira no chão.
      if (Math.random() < 0.7) {
        emitir({
          x: a.x - this.dirX * 0.3,
          y: a.y - this.dirY * 0.3,
          z: 0.35,
          vx: -this.dirX * 1.2 + (Math.random() - 0.5),
          vy: -this.dirY * 1.2 + (Math.random() - 0.5),
          vz: 0.6,
          cor: "#e7dcc8",
          vida: 0.3,
          tam: 0.18,
          modo: "poeira",
          drag: 0.85,
        });
      }
      if (this.tempo >= this.duracao * 0.55 && !this.hit) {
        this.hit = true;
        this.fase = "hit";
        const ax = this.alvo?.x ?? this.mx;
        const ay = this.alvo?.y ?? this.my;
        const az = this.alvo ? this.peito(this.alvo) : z;
        emitirImpacto(this.elemento, ax, ay, az, this.escala * 1.05);
      }
    }
    if (this.tempo >= this.duracao) this.encerrar();
  }
}

/** Scratch — cortes em X no impacto. */
export class PadraoScratch extends PadraoBase {
  iniciar(origem, alvo, def, elemento, opts = {}) {
    super.iniciar(origem, alvo, def, elemento, opts);
    this.duracao = 0.55;
    this.cortes = [
      { t: 0.18, ang: 0.55 },
      { t: 0.28, ang: -0.55 },
      { t: 0.38, ang: 0.15 },
    ];
    this.feitos = 0;
  }

  atualizar(dt) {
    if (!this.ativo || !this.elemento) return;
    this.tempo += dt;
    const ax = this.alvo?.x ?? this.mx;
    const ay = this.alvo?.y ?? this.my;
    const az = this.alvo ? this.peito(this.alvo) : 1.2;
    while (this.feitos < this.cortes.length && this.tempo >= this.cortes[this.feitos].t) {
      const c = this.cortes[this.feitos];
      this.feitos += 1;
      const ux = Math.cos(c.ang);
      const uy = Math.sin(c.ang);
      for (let i = 0; i < 10; i++) {
        const u = (i / 9 - 0.5) * 1.4;
        emitir({
          x: ax + ux * u,
          y: ay + uy * u,
          z: az + (Math.random() - 0.5) * 0.3,
          vx: ux * 3 + (Math.random() - 0.5) * 2,
          vy: uy * 3 + (Math.random() - 0.5) * 2,
          vz: 1.5 + Math.random(),
          cor: i % 2 ? this.elemento.nucleo : this.elemento.primaria,
          vida: 0.2 + Math.random() * 0.12,
          tam: 0.1 + Math.random() * 0.08,
          modo: "faisca",
        });
      }
    }
    if (this.tempo >= this.duracao) this.encerrar();
  }
}
