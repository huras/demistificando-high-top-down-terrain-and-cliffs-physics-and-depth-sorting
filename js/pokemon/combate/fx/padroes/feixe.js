import { emitirImpacto } from "../impacto.js";
import { PadraoBase } from "../padraoBase.js";
import { calcularPontaFeixe, soltarFeixe } from "../feixe3d.js";
import { emitir, folhaParticula } from "../poolParticulas3d.js";

/**
 * Feixe contínuo (Solar Beam, Hyper Beam, Water Pulse, Psybeam, Ice Beam…).
 */
export class PadraoFeixe extends PadraoBase {
  iniciar(origem, alvo, def, elemento, opts = {}) {
    super.iniciar(origem, alvo, def, elemento, opts);
    this.cfg = opts.feixe || {};
    this.duracao = this.cfg.duracao || (this.cfg.carga ? this.cfg.carga + 0.55 : 0.85);
    this.fase = this.cfg.carga ? "carga" : "tiro";
    this.feixe = null;
    this.hit = false;
    const z = this.peito(origem);
    emitirImpacto(elemento, origem.x, origem.y, z, 0.5 * this.escala);
  }

  atualizar(dt) {
    if (!this.ativo || !this.origem || !this.elemento) return;
    this.tempo += dt;
    const a = this.origem;
    const z = this.peito(a);
    const cfg = this.cfg;
    const alcance = cfg.alcance || 12;
    const mira = this.alvo ? { x: this.alvo.x, y: this.alvo.y } : { x: this.mx, y: this.my };

    if (this.fase === "carga") {
      const u = Math.min(1, this.tempo / (cfg.carga || 0.5));
      for (let i = 0; i < 3; i++) {
        emitir({
          x: a.x + (Math.random() - 0.5) * 0.4,
          y: a.y + (Math.random() - 0.5) * 0.4,
          z: z + Math.random() * 0.4,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8,
          vz: 0.5 + Math.random(),
          cor: i % 2 ? this.elemento.nucleo : this.elemento.primaria,
          vida: 0.25,
          tam: 0.12 + u * 0.1,
          modo: "faisca",
          folha: folhaParticula(this.elemento),
        });
      }
      if (this.tempo >= (cfg.carga || 0.5)) {
        this.fase = "tiro";
        this.tempoTiro = 0;
      }
      return;
    }

    this.tempoTiro = (this.tempoTiro || 0) + dt;
    const ponta = calcularPontaFeixe({ x: a.x, y: a.y }, mira, alcance);
    const alpha = Math.min(1, this.tempoTiro * 8) * (this.tempo >= this.duracao - 0.15 ? (this.duracao - this.tempo) / 0.15 : 1);
    const largura = (cfg.largura || 0.4) * (cfg.sobrecarga || 1) * this.escala;
    if (!this.feixe) {
      this.feixe = soltarFeixe({
        x1: ponta.x1 + ponta.nx * 0.5,
        y1: ponta.y1 + ponta.ny * 0.5,
        z1: z,
        x2: ponta.x2,
        y2: ponta.y2,
        z2: z,
        largura,
        primaria: cfg.primaria || this.elemento.primaria,
        secundaria: cfg.secundaria || this.elemento.secundaria,
        nucleo: cfg.nucleo || this.elemento.nucleo,
        alpha,
        grossuraExtra: !!cfg.grossuraExtra,
      });
    } else {
      this.feixe.x1 = ponta.x1 + ponta.nx * 0.5;
      this.feixe.y1 = ponta.y1 + ponta.ny * 0.5;
      this.feixe.z1 = z;
      this.feixe.x2 = ponta.x2;
      this.feixe.y2 = ponta.y2;
      this.feixe.z2 = z;
      this.feixe.largura = largura;
      this.feixe.alpha = Math.max(0, alpha);
      this.feixe.pulso += dt;
    }

    if (!this.hit && this.alvo && this.tempoTiro > 0.08) {
      this.hit = true;
      emitirImpacto(this.elemento, this.alvo.x, this.alvo.y, this.peito(this.alvo), this.escala);
      if (cfg.gelo) {
        for (let i = 0; i < 12; i++) {
          emitir({
            x: this.alvo.x + (Math.random() - 0.5) * 0.6,
            y: this.alvo.y + (Math.random() - 0.5) * 0.6,
            z: this.peito(this.alvo),
            vx: (Math.random() - 0.5) * 1.2,
            vy: (Math.random() - 0.5) * 1.2,
            vz: 0.2 + Math.random() * 0.8,
            cor: this.elemento.nucleo,
            vida: 0.5,
            tam: 0.12,
            modo: "poeira",
            grav: 0.2,
          });
        }
      }
    }

    if (this.tempo >= this.duracao) {
      if (this.feixe) this.feixe.viva = false;
      this.encerrar();
    }
  }

  encerrar() {
    if (this.feixe) this.feixe.viva = false;
    this.feixe = null;
    super.encerrar();
  }
}

/** Raios jagged (Thunder / Thunder Shock). */
export class PadraoRaio extends PadraoBase {
  iniciar(origem, alvo, def, elemento, opts = {}) {
    super.iniciar(origem, alvo, def, elemento, opts);
    this.cfg = opts.feixe || {};
    this.raioCfg = opts.raio || {};
    this.duracao = this.cfg.duracao || 0.55;
    this.segmentos = [];
    this.rebuild();
    emitirImpacto(elemento, this.mx, this.my, this.peito(alvo || origem), this.escala);
  }

  rebuild() {
    const a = this.origem;
    if (!a) return;
    const z = this.peito(a);
    const ceu = !!this.raioCfg.ceu;
    const x1 = ceu ? this.mx + (Math.random() - 0.5) * 0.4 : a.x;
    const y1 = ceu ? this.my + (Math.random() - 0.5) * 0.4 : a.y;
    const z1 = ceu ? z + 6 : z;
    const x2 = this.mx;
    const y2 = this.my;
    const z2 = this.alvo ? this.peito(this.alvo) : z;
    const n = 6 + Math.floor(Math.random() * 4);
    // #region agent log
    {
      let orfaos = 0;
      for (let oi = 0; oi < this.segmentos.length; oi++) {
        if (this.segmentos[oi]?.viva) orfaos++;
      }
      fetch("http://127.0.0.1:7578/ingest/2d17c26e-34d3-4e31-ad4f-513a36a051d1", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "b822fd" },
        body: JSON.stringify({
          sessionId: "b822fd",
          runId: "post-fix",
          hypothesisId: "A",
          location: "feixe.js:PadraoRaio.rebuild",
          message: "rebuild raio — matando segs antes de recriar",
          data: {
            segsAntesVivos: orfaos,
            segsAntes: this.segmentos.length,
            nNovo: n,
            golpe: this.def?.key || "",
            origemMorto: !!this.origem?.morto,
            origemHp: this.origem?.hp,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion
    // Sem isso o rebuild órfão deixava feixe.viva=true pra sempre no chão.
    for (let i = 0; i < this.segmentos.length; i++) {
      if (this.segmentos[i]) this.segmentos[i].viva = false;
    }
    this.segmentos.length = 0;
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const jx = (Math.random() - 0.5) * 0.55;
      const jy = (Math.random() - 0.5) * 0.55;
      const jz = (Math.random() - 0.5) * 0.3;
      this.segmentos.push(
        soltarFeixe({
          x1: x1 + (x2 - x1) * t0 + (i === 0 ? 0 : jx),
          y1: y1 + (y2 - y1) * t0 + (i === 0 ? 0 : jy),
          z1: z1 + (z2 - z1) * t0 + (i === 0 ? 0 : jz),
          x2: x1 + (x2 - x1) * t1 + (i === n - 1 ? 0 : (Math.random() - 0.5) * 0.55),
          y2: y1 + (y2 - y1) * t1 + (i === n - 1 ? 0 : (Math.random() - 0.5) * 0.55),
          z2: z1 + (z2 - z1) * t1,
          largura: (this.cfg.largura || 0.28) * (0.7 + Math.random() * 0.5),
          primaria: this.cfg.primaria || this.elemento.primaria,
          secundaria: this.cfg.secundaria || this.elemento.secundaria,
          nucleo: this.cfg.nucleo || this.elemento.nucleo,
          alpha: 1,
          grossuraExtra: false,
        }),
      );
    }
    for (let i = 0; i < 16; i++) {
      emitir({
        x: x2 + (Math.random() - 0.5) * 0.5,
        y: y2 + (Math.random() - 0.5) * 0.5,
        z: z2 + Math.random() * 0.5,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        vz: 1 + Math.random() * 2,
        cor: this.elemento.nucleo,
        vida: 0.28,
        tam: 0.1,
        modo: "faisca",
      });
    }
  }

  atualizar(dt) {
    if (!this.ativo) return;
    this.tempo += dt;
    const fade = this.tempo > this.duracao * 0.55 ? 1 - (this.tempo - this.duracao * 0.55) / (this.duracao * 0.45) : 1;
    for (let i = 0; i < this.segmentos.length; i++) {
      const s = this.segmentos[i];
      if (s) s.alpha = Math.max(0, fade);
    }
    if (this.tempo > 0.12 && this.tempo < 0.2 && Math.random() < 0.4) this.rebuild();
    if (this.tempo >= this.duracao) {
      for (let i = 0; i < this.segmentos.length; i++) if (this.segmentos[i]) this.segmentos[i].viva = false;
      this.encerrar();
    }
  }

  encerrar() {
    for (let i = 0; i < this.segmentos.length; i++) if (this.segmentos[i]) this.segmentos[i].viva = false;
    this.segmentos.length = 0;
    super.encerrar();
  }
}
