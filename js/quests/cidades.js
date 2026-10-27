/**
 * Zonas de cidade para o quadro (CIDADES_KANTO).
 */

import { CIDADES_KANTO } from "../mundo/regiao/kantoCidades.js";

/**
 * @returns {{ id: string, nome: string, ax: number, ay: number, tier: string }[]}
 */
export function listarCidadesQuadro() {
  const out = [];
  for (let i = 0; i < CIDADES_KANTO.length; i++) {
    const c = CIDADES_KANTO[i];
    out.push({
      id: c.key,
      nome: c.nome,
      ax: c.ax | 0,
      ay: c.ay | 0,
      tier: c.tier || "town",
    });
  }
  return out;
}

export function cidadePorId(cityId) {
  if (!cityId) return null;
  const list = listarCidadesQuadro();
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === cityId) return list[i];
  }
  return null;
}

export function cidadePorCelula(ax, ay) {
  const list = listarCidadesQuadro();
  for (let i = 0; i < list.length; i++) {
    if (list[i].ax === (ax | 0) && list[i].ay === (ay | 0)) return list[i];
  }
  return null;
}
