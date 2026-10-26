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
    const modo = cfg.modo || (cfg.textura ? "stretch" : "ribbon");
    const textura = cfg.textura || "";
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
        modo,
        textura,
        lengthScale: cfg.lengthScale || 3,
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
      this.feixe.modo = modo;
      this.feixe.textura = textura;
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

/**
 * Thunder Wave — cone elétrico.
 * Ponta no atirador, base no alvo; vários Thunders stretch no leque (não em série).
 */
export class PadraoThunderWave extends PadraoBase {
  iniciar(origem, alvo, def, elemento, opts = {}) {
    super.iniciar(origem, alvo, def, elemento, opts);
    this.cfg = opts.cone || opts.status || {};
    this.duracao = this.cfg.duracao || 0.75;
    this.raios = [];
    this._refez = false;
    this.rebuild();
  }

  rebuild() {
    const a = this.origem;
    if (!a) return;
    for (let i = 0; i < this.raios.length; i++) {
      if (this.raios[i]) this.raios[i].viva = false;
    }
    this.raios.length = 0;

    const z1 = this.peito(a);
    const mira = this.alvo ? { x: this.alvo.x, y: this.alvo.y } : { x: this.mx, y: this.my };
    const z2 = this.alvo ? this.peito(this.alvo) : z1;
    const dx = mira.x - a.x;
    const dy = mira.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const alcance = Math.min(Math.max(dist, 2.5), this.cfg.alcance || 6);
    const ux = dx / dist;
    const uy = dy / dist;
    const px = -uy;
    const py = ux;
    const meioAng = ((this.cfg.angulo || 52) * Math.PI) / 180 / 2;
    const n = Math.max(3, Math.min(9, this.cfg.raios || 7));
    const textura = this.cfg.textura || "Thunder_01";
    const largura = (this.cfg.largura || 0.28) * this.escala;
    const brilho = (this.cfg.brilho || 0.18) * this.escala;

    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const ang = -meioAng + t * meioAng * 2;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const rx = ux * c - uy * s;
      const ry = ux * s + uy * c;
      // Ponta (fina) no atirador → base (aberta) no alvo
      const x1 = a.x + rx * 0.2;
      const y1 = a.y + ry * 0.2;
      const x2 = a.x + rx * alcance + px * Math.sin(ang) * 0.05;
      const y2 = a.y + ry * alcance + py * Math.sin(ang) * 0.05;
      this.raios.push(
        soltarFeixe({
          x1,
          y1,
          z1: z1 + (Math.random() - 0.5) * 0.15,
          x2,
          y2,
          z2: z2 + (t - 0.5) * 0.25,
          largura: largura * (0.75 + Math.random() * 0.45),
          brilho,
          primaria: this.cfg.primaria || this.elemento.primaria,
          secundaria: this.cfg.secundaria || this.elemento.secundaria,
          nucleo: this.cfg.nucleo || this.elemento.nucleo,
          alpha: 0.75 + Math.random() * 0.25,
          modo: "stretch",
          textura,
          lengthScale: 3,
          roll: (t - 0.5) * 0.9 + (Math.random() - 0.5) * 0.35,
        }),
      );
    }

    // Faíscas na base do cone (perto do alvo)
    const bx = a.x + ux * alcance;
    const by = a.y + uy * alcance;
    for (let i = 0; i < 10; i++) {
      const lat = (Math.random() - 0.5) * Math.tan(meioAng) * alcance * 1.2;
      emitir({
        x: bx + px * lat + (Math.random() - 0.5) * 0.3,
        y: by + py * lat + (Math.random() - 0.5) * 0.3,
        z: z2 + Math.random() * 0.4,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        vz: 0.8 + Math.random(),
        cor: this.elemento.nucleo,
        vida: 0.3,
        tam: 0.09,
        modo: "faisca",
        folha: folhaParticula(this.elemento, "faisca"),
      });
    }
  }

  atualizar(dt) {
    if (!this.ativo) return;
    this.tempo += dt;
    const fade =
      this.tempo > this.duracao * 0.6
        ? 1 - (this.tempo - this.duracao * 0.6) / (this.duracao * 0.4)
        : 1;
    for (let i = 0; i < this.raios.length; i++) {
      const r = this.raios[i];
      if (!r) continue;
      r.alpha = Math.max(0, fade * (0.7 + (i % 3) * 0.1));
      if (Math.random() < dt * 18) r.frame = Math.floor(Math.random() * 4);
      r.roll += dt * (i % 2 ? 1.8 : -2.1);
    }
    // Um refresh no meio pra trocar o padrão do leque (sem spam de rebuild)
    if (!this._refez && this.tempo > 0.22) {
      this._refez = true;
      this.rebuild();
    }
    if (this.tempo >= this.duracao) {
      for (let i = 0; i < this.raios.length; i++) if (this.raios[i]) this.raios[i].viva = false;
      this.encerrar();
    }
  }

  encerrar() {
    for (let i = 0; i < this.raios.length; i++) if (this.raios[i]) this.raios[i].viva = false;
    this.raios.length = 0;
    super.encerrar();
  }
}

/**
 * Thunder / Thunder Shock.
 * Um sprite Thunder estica origem→alvo (folha 1×4 horizontal).
 * Várias camadas = mesmo span, só roll em torno do eixo do golpe — nunca pedaços em série.
 */
export class PadraoRaio extends PadraoBase {
  iniciar(origem, alvo, def, elemento, opts = {}) {
    super.iniciar(origem, alvo, def, elemento, opts);
    this.cfg = opts.feixe || {};
    this.raioCfg = opts.raio || {};
    this.duracao = this.cfg.duracao || 0.55;
    this.camadas = [];
    this.rebuild();
    emitirImpacto(elemento, this.mx, this.my, this.peito(alvo || origem), this.escala);
  }

  rebuild() {
    const a = this.origem;
    if (!a) return;
    const z = this.peito(a);
    const ceu = !!this.raioCfg.ceu;
    const x1 = ceu ? this.mx + (Math.random() - 0.5) * 0.35 : a.x;
    const y1 = ceu ? this.my + (Math.random() - 0.5) * 0.35 : a.y;
    const z1 = ceu ? z + 6 : z;
    const x2 = this.mx;
    const y2 = this.my;
    const z2 = this.alvo ? this.peito(this.alvo) : z;

    for (let i = 0; i < this.camadas.length; i++) {
      if (this.camadas[i]) this.camadas[i].viva = false;
    }
    this.camadas.length = 0;

    const textura = this.cfg.textura || (ceu ? "Thunder_02" : "Thunder_03");
    const n = Math.max(1, Math.min(3, this.raioCfg.camadas || 2 + Math.floor(Math.random() * 2)));
    const larguraBase = (this.cfg.largura || 0.32) * this.escala;
    const brilhoBase = (this.cfg.brilho > 0 ? this.cfg.brilho : Math.min(0.4, this.cfg.largura || 0.32)) * this.escala;

    for (let i = 0; i < n; i++) {
      const meio = (n - 1) * 0.5;
      // Roll em torno do eixo do raio — camadas “torcidas”, não enfileiradas
      const roll = (i - meio) * 0.55 + (Math.random() - 0.5) * 0.25;
      this.camadas.push(
        soltarFeixe({
          x1,
          y1,
          z1,
          x2,
          y2,
          z2,
          largura: larguraBase * (0.75 + i * 0.2 + Math.random() * 0.1),
          brilho: brilhoBase,
          primaria: this.cfg.primaria || this.elemento.primaria,
          secundaria: this.cfg.secundaria || this.elemento.secundaria,
          nucleo: this.cfg.nucleo || this.elemento.nucleo,
          alpha: i === 0 ? 1 : 0.55 + Math.random() * 0.25,
          grossuraExtra: false,
          modo: "stretch",
          textura,
          // lengthScale 3 → mul 1 no feixe3d (span já é origem→alvo)
          lengthScale: 3,
          roll,
        }),
      );
    }

    for (let i = 0; i < 14; i++) {
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
        folha: folhaParticula(this.elemento, "faisca"),
      });
    }
  }

  atualizar(dt) {
    if (!this.ativo) return;
    this.tempo += dt;
    const fade =
      this.tempo > this.duracao * 0.55
        ? 1 - (this.tempo - this.duracao * 0.55) / (this.duracao * 0.45)
        : 1;
    for (let i = 0; i < this.camadas.length; i++) {
      const s = this.camadas[i];
      if (!s) continue;
      s.alpha = Math.max(0, fade * (i === 0 ? 1 : 0.65));
      // Flicker: troca o tile da folha, mantendo o mesmo span
      if (Math.random() < dt * 14) s.frame = Math.floor(Math.random() * 4);
      s.roll += dt * (i % 2 ? 2.2 : -1.6);
    }
    if (this.tempo > 0.1 && this.tempo < 0.18 && Math.random() < 0.35) this.rebuild();
    if (this.tempo >= this.duracao) {
      for (let i = 0; i < this.camadas.length; i++) if (this.camadas[i]) this.camadas[i].viva = false;
      this.encerrar();
    }
  }

  encerrar() {
    for (let i = 0; i < this.camadas.length; i++) if (this.camadas[i]) this.camadas[i].viva = false;
    this.camadas.length = 0;
    super.encerrar();
  }
}
