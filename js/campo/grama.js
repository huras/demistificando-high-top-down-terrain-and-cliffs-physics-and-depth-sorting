/**
 * Tufo de grama: acende no raio, some e volta. Não encadeia fora do círculo.
 */

import { propPorId, vegetacaoNaArea } from "../mundo/bioma/propsBioma.js";
import { emitirFagulha } from "./fx.js";
import {
  FASE,
  apagarEstado,
  cadaEstado,
  confirmar,
  encerrarMudancas,
  mudarEstado,
  preparar,
} from "./estadoProps.js";

export const RAIO_GRAMA = 0.72;
const FOGO_MS = 9000;
const REBROTA_MS = 90000;

let acumFagulha = 0;

function acenderUm(prop, agora) {
  preparar(prop);
  if (prop.tipo !== "grama") return false;
  if (prop.fase === FASE.QUEIMANDO || prop.fase === FASE.REMOVIDO) return false;
  prop.fase = FASE.QUEIMANDO;
  prop.inicioMs = agora;
  prop.apagaMs = agora + FOGO_MS;
  prop.voltaMs = agora + FOGO_MS + REBROTA_MS;
  confirmar(prop);
  emitirFagulha(prop.x, prop.y, false, 6, true);
  return true;
}

export function acenderGramaEm(x, y, agora, incluir) {
  const props = vegetacaoNaArea(x - 1.2, y - 1.2, x + 1.2, y + 1.2);
  let n = 0;
  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    if (p.tipo !== "grama") continue;
    if (p !== incluir && Math.hypot(p.x - x, p.y - y) > RAIO_GRAMA) continue;
    if (acenderUm(p, agora)) n++;
  }
  return n;
}

export function tickGrama(dt, agora) {
  const tocados = [];
  let mudou = false;
  cadaEstado((id, e) => {
    if (e.tipo !== "grama") return;
    if (e.fase === FASE.QUEIMANDO && e.apagaMs && agora >= e.apagaMs) {
      const p = mudarEstado(id, { fase: FASE.REMOVIDO, hp: 0 });
      if (p) tocados.push(p);
      mudou = true;
      return;
    }
    if (e.fase === FASE.REMOVIDO && e.voltaMs && agora >= e.voltaMs) {
      const p = apagarEstado(id);
      if (p) tocados.push(p);
      mudou = true;
    }
  });
  if (mudou) encerrarMudancas(tocados);

  acumFagulha += dt > 0 ? dt : 0;
  if (acumFagulha < 0.12) return;
  acumFagulha = 0;
  cadaEstado((id, e) => {
    if (e.tipo !== "grama" || e.fase !== FASE.QUEIMANDO) return;
    const p = propPorId(id);
    if (p) emitirFagulha(p.x, p.y, false, 1, false);
  });
}
