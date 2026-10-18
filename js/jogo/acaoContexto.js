/**
 * Uma tecla E, um aviso. Porta, cura, cápsula, placa e escalada
 * disputam o mesmo letreiro. Quem ganha consome o E; escalar deixa
 * a tecla pro movimento.
 */
import { encontrarFacePerto } from "../mundo/facesCliff.js";
import { ORIGEM_LAB_X, ORIGEM_LAB_Y } from "../mundo/cidade/laboratorio.js";
import { placaPerto } from "../mundo/placas.js";
import { ancoraDoHub } from "./hub.js";

const FOLGA_ESCALADA_MS = 160;
let escaladaAte = 0;

function faceAgora(corpo) {
  if ((corpo.stamina ?? 0) <= 1e-4) {
    escaladaAte = 0;
    return false;
  }
  const zRef = corpo.noChao ? corpo.z : (corpo.elevacao ?? corpo.z);
  const face = encontrarFacePerto(corpo.x, corpo.y, zRef);
  if (face) escaladaAte = performance.now() + FOLGA_ESCALADA_MS;
  return !!face;
}

function folgaEscalada() {
  return performance.now() < escaladaAte;
}

export function acaoContexto(ctx) {
  const { corpo, entrarPorta, curaPerto, alvoLab, alvoHub, papelHub, interior } = ctx;
  if (!corpo) return null;

  if (entrarPorta) return { id: "entrar", rotulo: "Entrar", ancora: null };

  if (curaPerto) {
    const ancora = alvoHub
      ? ancoraDoHub(papelHub, alvoHub)
      : {
          x: ORIGEM_LAB_X + alvoLab.ref.x,
          y: ORIGEM_LAB_Y + alvoLab.ref.footY,
          z: corpo.z,
        };
    return { id: "cura", rotulo: "Recuperar", ancora };
  }

  if (alvoLab?.tipo === "capsula") {
    const tank = alvoLab.ref;
    return {
      id: "capsula",
      rotulo: "Cápsula",
      ancora: {
        x: ORIGEM_LAB_X + tank.x,
        y: ORIGEM_LAB_Y + tank.y,
        z: corpo.z || 0,
      },
    };
  }

  const noMundo = !interior && !corpo.voando && !corpo.mantle;
  if (noMundo && corpo.escalando) return { id: "soltar", rotulo: "Soltar", ancora: null };
  if (noMundo && faceAgora(corpo)) return { id: "escalar", rotulo: "Escalar", ancora: null };

  if (!interior && !corpo.escalando) {
    const placa = placaPerto(corpo.x, corpo.y, corpo.z || 0);
    if (placa) {
      return {
        id: "placa",
        rotulo: "Ler",
        ancora: { x: placa.x, y: placa.y, z: placa.z },
        placa,
      };
    }
  }

  if (!noMundo) escaladaAte = 0;
  else if (folgaEscalada()) return { id: "escalar", rotulo: "Escalar", ancora: null };
  return null;
}

export function acaoConsomeE(acao) {
  return !!acao && acao.id !== "escalar" && acao.id !== "soltar";
}
