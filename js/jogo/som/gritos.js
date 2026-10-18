/**
 * Grito da espécie. O PCM fica no LRU do barramento.
 * Envio, encontro, golpe e o ambiente dos selvagens na tela.
 */

import { estado } from "../estado.js";
import { aquecerCaminho, estaQuente, tocarRel, tocarRelEm } from "./barramento.js";

const VOLUME = 0.85;
const ALCANCE = 20;
const INTERVALO_PASSIVO = 12;
const INTERVALO_AGRO = 5;
const RETRY = 0.45;
const MAX_POR_QUADRO = 2;
const RAIO_TELA2 = 18 * 18;

function hash01(id) {
  const s = String(id ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0;
  const n = Math.sin(h * 12.9898) * 43758.5453;
  return n - Math.floor(n);
}

export function caminhoGrito(ator) {
  const dex = ator?.especie?.dex | 0;
  const chave = ator?.especie?.key;
  if (!dex || !chave) return "";
  return `SFX/cries/${String(dex).padStart(3, "0")}-${String(chave).toLowerCase()}.mp3`;
}

export function aquecerGrito(ator) {
  const rel = caminhoGrito(ator);
  if (!rel) return false;
  return aquecerCaminho(rel);
}

export function tocarGrito(ator, opts = {}) {
  const rel = caminhoGrito(ator);
  if (!rel) return false;
  const pedido = {
    volume: opts.volume ?? VOLUME,
    rate: opts.rate,
    exigirQuente: true,
    importante: !!opts.importante,
  };
  if (Number.isFinite(opts.x) && Number.isFinite(opts.y)) {
    return tocarRelEm(rel, { ...pedido, x: opts.x, y: opts.y, alcance: ALCANCE });
  }
  return tocarRel(rel, pedido);
}

function podeAmbiente(ator) {
  if (!ator || ator.faccao !== "selvagem") return false;
  if (ator.morto || ator.capturado || !(ator.hp > 0)) return false;
  if ((ator.dormindo || 0) > 0) return false;
  return true;
}

function intervaloDe(ator) {
  return ator.modo === "agro" ? INTERVALO_AGRO : INTERVALO_PASSIVO;
}

export function tickGritosAmbiente(dt, corpo, selvagens) {
  if (!corpo || !selvagens || estado.interior) return;
  const passo = dt > 0 ? dt : 0;
  if (!(passo > 0)) return;
  let n = 0;
  for (let i = 0; i < selvagens.length; i++) {
    const ator = selvagens[i];
    if (!podeAmbiente(ator)) continue;
    const dx = ator.x - corpo.x;
    const dy = ator.y - corpo.y;
    if (dx * dx + dy * dy > RAIO_TELA2) continue;

    aquecerGrito(ator);
    const intervalo = intervaloDe(ator);
    if (!(ator._gritoAmbiente >= 0)) {
      ator._gritoAmbiente = (0.2 + hash01(ator.id) * 0.8) * intervalo;
    }
    if (ator._gritoAmbiente > intervalo) {
      ator._gritoAmbiente = (0.2 + hash01(ator.id) * 0.8) * intervalo;
    }
    ator._gritoAmbiente -= passo;
    if (ator._gritoAmbiente > 0) continue;
    if (n >= MAX_POR_QUADRO) {
      ator._gritoAmbiente = 0;
      continue;
    }

    const rel = caminhoGrito(ator);
    if (!estaQuente(rel)) {
      ator._gritoAmbiente = RETRY;
      continue;
    }
    const ok = tocarGrito(ator, { x: ator.x, y: ator.y });
    ator._gritoAmbiente = ok ? intervalo : RETRY;
    if (ok) n++;
  }
}
