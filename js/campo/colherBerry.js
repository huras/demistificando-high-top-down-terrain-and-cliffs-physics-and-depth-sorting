/**
 * Colheita do arbusto maduro e o tempo até ele voltar.
 * O pé fica no lugar: arbusto, flor, maduro.
 */

import { propPorId, vegetacaoNaArea } from "../mundo/bioma/propsBioma.js";
import { ALCANCE_COLHER, MS_ARBUSTO, MS_FLOR, spriteBerry } from "../mundo/bioma/berriesBioma.js";
import {
  apagarEstado,
  cadaEstado,
  confirmar,
  encerrarMudancas,
  mudarEstado,
  preparar,
} from "./estadoProps.js";

export function arbustoMaduroPerto(x, y, z) {
  const props = vegetacaoNaArea(x - ALCANCE_COLHER, y - ALCANCE_COLHER, x + ALCANCE_COLHER, y + ALCANCE_COLHER);
  let melhor = null;
  let dist = ALCANCE_COLHER;
  const piso = z || 0;
  for (let i = 0; i < props.length; i++) {
    const prop = props[i];
    if (prop.tipo !== "berry" || prop.oculto || (prop.estagio || "maduro") !== "maduro") continue;
    if (Math.abs((prop.z || 0) - piso) > 2) continue;
    const d = Math.hypot(prop.x - x, prop.y - y);
    if (d >= dist) continue;
    dist = d;
    melhor = prop;
  }
  return melhor;
}

/** Devolve a chave e a quantidade, ou null se o pé não estava maduro. */
export function colherArbusto(prop) {
  if (!prop || prop.tipo !== "berry") return null;
  preparar(prop);
  if (prop.oculto || (prop.estagio || "maduro") !== "maduro") return null;
  const n = 2 + Math.floor(Math.random() * 4);
  prop.estagio = "arbusto";
  prop.maduraEm = Date.now() + MS_ARBUSTO;
  prop.sprite = spriteBerry(prop.berryKey, "arbusto");
  confirmar(prop);
  return { key: prop.berryKey, n };
}

export function tickBerries(agora) {
  const tocados = [];
  cadaEstado((id, estado) => {
    if (estado.tipo !== "berry" || !estado.maduraEm || agora < estado.maduraEm) return;
    const prop = propPorId(id);
    if (estado.estagio === "arbusto") {
      if (prop) {
        prop.estagio = "flor";
        prop.maduraEm = agora + MS_FLOR;
        prop.sprite = spriteBerry(prop.berryKey, "flor");
        confirmar(prop);
        tocados.push(prop);
      } else {
        mudarEstado(id, { estagio: "flor", maduraEm: agora + MS_FLOR });
      }
      return;
    }
    if (prop) {
      prop.estagio = "maduro";
      prop.maduraEm = 0;
      prop.sprite = spriteBerry(prop.berryKey, "maduro");
      confirmar(prop);
      tocados.push(prop);
    } else {
      apagarEstado(id);
    }
  });
  if (tocados.length) encerrarMudancas(tocados);
}
