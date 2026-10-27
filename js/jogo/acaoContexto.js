/**
 * Uma tecla E, um aviso. Porta, cura, PC, cápsula, placa e escalada
 * disputam o mesmo letreiro. Quem ganha consome o E; escalar deixa
 * a tecla pro movimento.
 */
import { encontrarFacePerto } from "../mundo/facesCliff.js";
import { ORIGEM_LAB_X, ORIGEM_LAB_Y } from "../mundo/cidade/laboratorio.js";
import { placaPerto } from "../mundo/placas.js";
import { paraLocalKanto } from "../mundo/bounds.js";
import { AREA_KANTO, zonaNoMundo } from "../mundo/regiao/grafoKanto.js";
import { predioNoLayout } from "../mundo/regiao/volumesCidade.js";
import { ancoraDoHub } from "./hub.js";
import { arbustoMaduroPerto } from "../campo/colherBerry.js";
import { plotMaduroPerto } from "./campo.js";
import { promptSantuario, santuarioPerto } from "../santuario/interagir.js";
import { puzzleSantuarioAberto } from "../santuario/puzzleModal.js";
import { totemPerto } from "../santuario/interior.js";
import { especie } from "../pokemon/dados.js";

const FOLGA_ESCALADA_MS = 160;
let escaladaAte = 0;

function faceDePredio(face) {
  const x = face.cx + 0.5;
  const y = face.cy + 0.5;
  const zona = zonaNoMundo(x, y);
  if (!zona || zona.tipo !== "cidade" || !zona.layout) return false;
  const local = paraLocalKanto(x, y);
  return !!predioNoLayout(local.x - zona.ax * AREA_KANTO, local.y - zona.ay * AREA_KANTO, zona.layout);
}

function faceAgora(corpo) {
  if ((corpo.stamina ?? 0) <= 1e-4) {
    escaladaAte = 0;
    return false;
  }
  const zRef = corpo.noChao ? corpo.z : (corpo.elevacao ?? corpo.z);
  const face = encontrarFacePerto(corpo.x, corpo.y, zRef);
  if (face && faceDePredio(face)) {
    escaladaAte = 0;
    return false;
  }
  if (face) escaladaAte = performance.now() + FOLGA_ESCALADA_MS;
  return !!face;
}

function folgaEscalada() {
  return performance.now() < escaladaAte;
}

export function acaoContexto(ctx) {
  const { corpo, entrarPorta, curaPerto, alvoLab, alvoHub, papelHub, interior } = ctx;
  if (!corpo) return null;
  if (puzzleSantuarioAberto()) return null;

  if (interior?.papel === "santuario") {
    const totem = totemPerto(corpo.x, corpo.y);
    if (totem) {
      return {
        id: "totemSantuario",
        rotulo: totem.cleared ? "Vazio" : "Tocar",
        ancora: { x: totem.x, y: totem.y, z: corpo.z || 0 },
        totem,
      };
    }
  }

  if (entrarPorta) {
    escaladaAte = 0;
    return { id: "entrar", rotulo: "Entrar", ancora: null };
  }

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

  if (alvoHub?.tipo === "pc") {
    escaladaAte = 0;
    return { id: "pc", rotulo: "PC", ancora: ancoraDoHub(papelHub, alvoHub) };
  }

  if (alvoHub?.tipo === "loja") {
    escaladaAte = 0;
    return { id: "loja", rotulo: "Balcão", ancora: ancoraDoHub(papelHub, alvoHub) };
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

  if (alvoLab?.tipo === "inicial") {
    const bola = alvoLab.ref;
    const esp = especie(bola?.especie);
    const nome = esp?.nome || bola?.especie || "Pokémon";
    return {
      id: "inicial",
      rotulo: `Pegar ${nome}`,
      ancora: {
        x: ORIGEM_LAB_X + (bola?.x || 0),
        y: ORIGEM_LAB_Y + (bola?.y || 0),
        z: corpo.z || 0,
      },
    };
  }

  const noMundo = !interior && !corpo.voando && !corpo.mantle;
  if (noMundo && corpo.escalando) return { id: "soltar", rotulo: "Soltar", ancora: null };
  if (noMundo && faceAgora(corpo)) return { id: "escalar", rotulo: "Escalar", ancora: null };

  if (!interior && !corpo.escalando) {
    const stone = santuarioPerto(corpo.x, corpo.y);
    if (stone) {
      const p = promptSantuario(stone);
      if (p) return p;
    }
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

  if (noMundo && !corpo.escalando) {
    const piso = corpo.z || 0;
    const arbusto = arbustoMaduroPerto(corpo.x, corpo.y, piso);
    const plot = plotMaduroPerto(corpo.x, corpo.y, piso);
    let escolha = null;
    if (arbusto && plot) {
      const dArb = Math.hypot(arbusto.x - corpo.x, arbusto.y - corpo.y);
      const dPlot = Math.hypot(plot.x + 0.5 - corpo.x, plot.y + 0.5 - corpo.y);
      escolha = dPlot <= dArb ? { tipo: "plot", plot } : { tipo: "arbusto", arbusto };
    } else if (plot) escolha = { tipo: "plot", plot };
    else if (arbusto) escolha = { tipo: "arbusto", arbusto };
    if (escolha?.tipo === "plot") {
      return {
        id: "colherCanteiro",
        rotulo: "Colher",
        ancora: { x: escolha.plot.x + 0.5, y: escolha.plot.y + 0.5, z: piso },
        plot: escolha.plot,
      };
    }
    if (escolha?.tipo === "arbusto") {
      return {
        id: "colher",
        rotulo: "Colher",
        ancora: { x: escolha.arbusto.x, y: escolha.arbusto.y, z: escolha.arbusto.z },
        arbusto: escolha.arbusto,
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
