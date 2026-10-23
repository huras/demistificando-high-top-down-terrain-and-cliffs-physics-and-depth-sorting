/**
 * Luz fake dos totens / pedras elementais — mesmo pipeline dos postes
 * (mapa de chão + pool de point lights), tinta por elemento.
 */
import { ALTURA_BLOCO } from "../config.js";
import { visitarVegetacaoNaArea } from "../mundo/bioma/propsBioma.js";
import { oferecerLuzChao } from "../render/3d/luzes/mapaChao.js";
import { oferecerLuz, obterPesoNoite } from "../render/3d/luzes/pool.js";
import { shrineMapColor } from "./catalogo.js";
import { santuarioAtivo } from "./interior.js";

/** Metros ao redor da câmera (XZ = mundo x/y). */
const ALCANCE = 70;
/** Cap de fontes outdoor por quadro (pool global já é 8). */
const CAP_OUTDOOR = 10;
/** Altura do foco luminoso na pedra (metros). */
const FOCO_Y = 1.45;
/** Raio do flare / point light. */
const RAIO_FLARE = 2.8;

/** @type {{ x: number, y: number, z: number, cor: string, intensidade: number, d2: number }[]} */
const candidatos = [];

function intensidadeDe(cleared, peso) {
  const base = cleared ? 0.55 : 1.2;
  return base * peso;
}

/**
 * Coleta pedras carregadas perto da câmera e o totem do dungeon ativo.
 * @param {number} camX
 * @param {number} camZ
 * @param {{ interior?: boolean }} [opts]
 */
export function oferecerLuzesTotemSantuario(camX, camZ, opts = {}) {
  const peso = obterPesoNoite();
  const interior = !!opts.interior;
  // Interior: totem sempre contribui um pouco (sala escura); outdoor segue a noite.
  if (!interior && peso <= 0.02) return;

  candidatos.length = 0;
  const agoraPeso = interior ? Math.max(0.35, peso) : peso;
  // Pulso só no flare (pool); mapa de chão fica estável p/ não re-stamp todo frame.
  const pulsoFlare = 0.94 + 0.06 * Math.sin(performance.now() * 0.0018);

  if (interior) {
    const hub = santuarioAtivo();
    if (hub?.totem) {
      const t = hub.totem;
      const cor = hub.accent || shrineMapColor(hub.element);
      const inten = intensidadeDe(!!hub.cleared || !!t.cleared, agoraPeso) * 1.15;
      const y = (hub.spawn?.z ?? 1) * ALTURA_BLOCO + FOCO_Y;
      oferecerUma(t.x, y, t.y, cor, inten, `totem:${hub.shrineId}`, pulsoFlare);
    }
    return;
  }

  const x0 = camX - ALCANCE;
  const z0 = camZ - ALCANCE;
  const x1 = camX + ALCANCE;
  const z1 = camZ + ALCANCE;
  visitarVegetacaoNaArea(x0, z0, x1, z1, (p) => {
    if (p?.tipo !== "santuario" || p.oculto) return;
    const dx = p.x - camX;
    const dz = p.y - camZ;
    const d2 = dx * dx + dz * dz;
    if (d2 > ALCANCE * ALCANCE) return;
    candidatos.push({
      x: p.x,
      y: (Number.isFinite(p.z) ? p.z : 0) * ALTURA_BLOCO + FOCO_Y,
      z: p.y,
      cor: shrineMapColor(p.element),
      intensidade: intensidadeDe(!!p.cleared, agoraPeso),
      d2,
      id: p.shrineId || p.id,
    });
  });

  if (candidatos.length > CAP_OUTDOOR) {
    candidatos.sort((a, b) => a.d2 - b.d2);
    candidatos.length = CAP_OUTDOOR;
  }

  for (let i = 0; i < candidatos.length; i++) {
    const c = candidatos[i];
    oferecerUma(c.x, c.y, c.z, c.cor, c.intensidade, c.id, pulsoFlare);
  }
}

function oferecerUma(x, y, z, cor, intensidade, dono, pulsoFlare = 1) {
  if (!(intensidade > 0.04)) return;
  oferecerLuzChao("santuario", x, y, z, cor, intensidade);
  oferecerLuz(dono || "santuario", x, y, z, cor, RAIO_FLARE, intensidade * pulsoFlare);
}
