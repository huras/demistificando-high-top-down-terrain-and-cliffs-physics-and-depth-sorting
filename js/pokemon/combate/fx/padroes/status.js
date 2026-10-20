import { ALTURA_BLOCO } from "../../../../config.js";
import { PadraoBase } from "../padraoBase.js";
import { emitir, spritesArco } from "../poolParticulas3d.js";

const QTD_ARCOS = 8;
const DENTES = 7;

const NUVEM = Object.freeze({
  poison: true,
  sleep: true,
  paralysis: true,
  burn: true,
  freeze: true,
});

/**
 * Growl / Tail Whip — arcos sonoros (sawtooth) em sprites, scroll radial.
 * Status major — nuvem / faíscas / brasas / gelo no alvo.
 */
export class PadraoStatus extends PadraoBase {
  iniciar(origem, alvo, def, elemento, opts = {}) {
    super.iniciar(origem, alvo, def, elemento, opts);
    this.variante = opts.variante || "growl";
    this.duracao = NUVEM[this.variante] ? 0.85 : 0.72;
    this.alcance = opts.alcance > 0 ? opts.alcance : 6;
    const dx = this.mx - origem.x;
    const dy = this.my - origem.y;
    this.angulo = Math.atan2(dy, dx);
    this.abertura = this.variante === "tail" ? 0.95 : 1.15;
    this.arcos = [];
    for (let i = 0; i < QTD_ARCOS; i++) {
      this.arcos.push({ raio: 0.4 + i * 0.35, alpha: 1 - i * 0.08 });
    }
    if (NUVEM[this.variante] && alvo) this.estourarNuvem(alvo, elemento);
  }

  estourarNuvem(alvo, elemento) {
    const z = this.peito(alvo);
    const n = this.variante === "paralysis" ? 22 : 28;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.7;
      const base = {
        x: alvo.x + Math.cos(ang) * r,
        y: alvo.y + Math.sin(ang) * r,
        z: z + Math.random() * 0.8,
        cor: i % 2 ? elemento.nucleo : elemento.primaria,
        vida: 0.55 + Math.random() * 0.35,
        tam: 0.14 + Math.random() * 0.12,
      };
      if (this.variante === "sleep") {
        emitir({
          ...base,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          vz: 0.6 + Math.random() * 1.1,
          modo: "poeira",
          grav: -0.55,
          drag: 0.92,
          tam: 0.18 + Math.random() * 0.14,
        });
      } else if (this.variante === "paralysis") {
        emitir({
          ...base,
          vx: (Math.random() - 0.5) * 2.4,
          vy: (Math.random() - 0.5) * 2.4,
          vz: 0.2 + Math.random() * 1.6,
          modo: "faisca",
          grav: 0.4,
          drag: 0.86,
          tam: 0.1 + Math.random() * 0.08,
        });
      } else if (this.variante === "burn") {
        emitir({
          ...base,
          vx: (Math.random() - 0.5) * 0.9,
          vy: (Math.random() - 0.5) * 0.9,
          vz: 0.8 + Math.random() * 1.4,
          modo: "faisca",
          grav: -0.8,
          drag: 0.88,
        });
      } else if (this.variante === "freeze") {
        emitir({
          ...base,
          vx: (Math.random() - 0.5) * 1.1,
          vy: (Math.random() - 0.5) * 1.1,
          vz: 0.1 + Math.random() * 0.7,
          modo: "poeira",
          grav: 0.15,
          drag: 0.9,
          tam: 0.12 + Math.random() * 0.1,
        });
      } else {
        emitir({
          ...base,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2,
          vz: 0.4 + Math.random() * 1.2,
          modo: "poeira",
          grav: -0.35,
          drag: 0.9,
        });
      }
    }
  }

  atualizar(dt) {
    if (!this.ativo || !this.origem || !this.elemento) return;
    this.tempo += dt;
    const t = this.tempo / this.duracao;
    const lista = spritesArco();
    let slot = 0;

    if (!NUVEM[this.variante]) {
      const ox = this.origem.x;
      const oy = this.origem.y;
      const oz = this.peito(this.origem);
      const scroll = this.tempo * 5.4;
      const fade = t < 0.15 ? t / 0.15 : t > 0.7 ? (1 - t) / 0.3 : 1;

      for (let a = 0; a < this.arcos.length; a++) {
        const arco = this.arcos[a];
        const raio = ((arco.raio + scroll) % (this.alcance * 0.85)) + 0.45;
        if (raio < 0.55) continue;
        const alpha = arco.alpha * fade * (1 - raio / (this.alcance + 0.5));
        if (alpha <= 0.04) continue;
        for (let d = 0; d < DENTES; d++) {
          if (slot >= lista.length) break;
          const u = d / (DENTES - 1);
          const ang = this.angulo - this.abertura / 2 + this.abertura * u;
          const serra = ((d % 2) * 2 - 1) * 0.12 * raio;
          const r = raio + serra;
          const spr = lista[slot++];
          spr.visible = true;
          spr.material.color.set(this.variante === "tail" ? this.elemento.secundaria : this.elemento.nucleo);
          spr.material.opacity = Math.max(0, alpha * 0.85);
          const s = 0.16 + (1 - u * 0.3) * 0.08;
          spr.scale.set(s, s * 0.7, 1);
          spr.position.set(
            ox + Math.cos(ang) * r,
            Math.max(0.12, oz * ALTURA_BLOCO + Math.sin(u * Math.PI) * 0.15),
            oy + Math.sin(ang) * r,
          );
        }
      }
    } else if (this.alvo) {
      if (Math.random() < 0.55) {
        const cor =
          this.variante === "sleep"
            ? this.elemento.secundaria
            : this.variante === "paralysis"
              ? this.elemento.nucleo
              : this.elemento.primaria;
        emitir({
          x: this.alvo.x + (Math.random() - 0.5) * 0.9,
          y: this.alvo.y + (Math.random() - 0.5) * 0.9,
          z: this.peito(this.alvo) + Math.random() * 0.5,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          vz:
            this.variante === "burn"
              ? 0.4 + Math.random() * 0.8
              : this.variante === "sleep"
                ? 0.3 + Math.random() * 0.6
                : -0.2 + Math.random() * 0.4,
          cor,
          vida: 0.4,
          tam: 0.12,
          modo: this.variante === "paralysis" || this.variante === "burn" ? "faisca" : "poeira",
          grav: this.variante === "burn" ? -0.6 : this.variante === "freeze" ? 0.2 : -0.2,
        });
      }
    }

    for (let i = slot; i < lista.length; i++) {
      lista[i].visible = false;
      lista[i].material.opacity = 0;
    }
    if (this.tempo >= this.duracao) this.encerrar();
  }
}
