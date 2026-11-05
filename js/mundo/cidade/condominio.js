/**
 * Celadon Condominiums — 4 andares com escada + 9 apartamentos (3 por andar residencial).
 * Andar 0 = hall / saída. Andares 1–3 = corredor + 3 portas cada.
 */
import { ALTURA_PRACA } from "../regiao/amostraKanto.js";
import {
  criarPlantaHub,
  aplicarPlantaNoChunk,
  naSaidaPlanta,
  alvoDaPlanta,
  dentroDoTerrenoHub,
} from "./plantaHub.js";

export const ORIGEM_CONDOMINIO_X = 101024;
export const ORIGEM_CONDOMINIO_Y = 101024;
export const ANDARES_CONDOMINIO = 4;
export const UNIDADES_CONDOMINIO = 9;
/** Deslocamento X entre bolsos de andar (evita overlap no stream). */
const PASSO_ANDAR = 40;

const COLS = 24;
const ROWS = 16;
const DOOR_TX0 = 11;
const DOOR_TX1 = 12;

/** Portas dos 9 aptos: 3 por andar (1–3), posição no corredor norte. */
const PORTAS_UNIDADE = Object.freeze([
  Object.freeze({ unidade: 1, andar: 1, x: 5, y: 4.2 }),
  Object.freeze({ unidade: 2, andar: 1, x: 12, y: 4.2 }),
  Object.freeze({ unidade: 3, andar: 1, x: 19, y: 4.2 }),
  Object.freeze({ unidade: 4, andar: 2, x: 5, y: 4.2 }),
  Object.freeze({ unidade: 5, andar: 2, x: 12, y: 4.2 }),
  Object.freeze({ unidade: 6, andar: 2, x: 19, y: 4.2 }),
  Object.freeze({ unidade: 7, andar: 3, x: 5, y: 4.2 }),
  Object.freeze({ unidade: 8, andar: 3, x: 12, y: 4.2 }),
  Object.freeze({ unidade: 9, andar: 3, x: 19, y: 4.2 }),
]);

const ESCADA = Object.freeze({ x: 20.5, y: 11.5 });

function camadaChao(andar) {
  const g = [];
  for (let y = 0; y < ROWS; y++) {
    const linha = [];
    for (let x = 0; x < COLS; x++) {
      if (andar === 0 && y === ROWS - 1 && (x === DOOR_TX0 || x === DOOR_TX1)) {
        linha.push(2);
      } else if (y <= 3) {
        linha.push(9);
      } else {
        linha.push(1);
      }
    }
    g.push(Object.freeze(linha));
  }
  return Object.freeze(g);
}

function origemDoAndar(andar) {
  return {
    x: ORIGEM_CONDOMINIO_X + (andar | 0) * PASSO_ANDAR,
    y: ORIGEM_CONDOMINIO_Y,
  };
}

function idCasaUnidade(unidade, predioId = "") {
  const base = predioId ? String(predioId) : "celadon:condo";
  return `${base}:apto:${unidade | 0}`;
}

function montarAndar(andar) {
  const o = origemDoAndar(andar);
  const props = [
    { id: "vaso", x: 3.2, y: 2.4, disco: true, raio: 0.4 },
    { id: "vaso", x: 20.8, y: 2.4, disco: true, raio: 0.4 },
  ];
  const alvos = [];

  if (andar === 0) {
    props.push({
      id: "npc",
      peopleId: "pt-gentleman",
      nome: "Porteiro",
      sexo: "male",
      origem: "platinum",
      coluna: 22,
      x: 8.5,
      y: 8.2,
      disco: true,
      raio: 0.38,
    });
    alvos.push({
      tipo: "npc",
      nome: "Porteiro",
      x: 8.5,
      y: 8.2,
      alcance: 1.35,
      ref: {
        nome: "Porteiro",
        x: o.x + 8.5,
        y: o.y + 8.2,
        z: ALTURA_PRACA,
        fala: Object.freeze([
          "Bem-vindo aos Condomínios de Celadon.",
          "Nove prédios no quarteirão. Este tem quatro andares — a escada fica ao fundo.",
        ]),
      },
    });
  }

  if (andar < ANDARES_CONDOMINIO - 1) {
    // Sem disco: o jogador precisa pisar no tile da escada.
    props.push({ id: "estante", x: ESCADA.x, y: ESCADA.y, disco: false });
    alvos.push({
      tipo: "escada",
      nome: "Subir",
      x: ESCADA.x,
      y: ESCADA.y,
      alcance: 1.35,
      dir: 1,
    });
  }
  if (andar > 0) {
    props.push({ id: "mesa", x: ESCADA.x - 2.2, y: ESCADA.y, disco: false });
    alvos.push({
      tipo: "escada",
      nome: "Descer",
      x: ESCADA.x - 2.2,
      y: ESCADA.y,
      alcance: 1.35,
      dir: -1,
    });
  }

  for (let i = 0; i < PORTAS_UNIDADE.length; i++) {
    const u = PORTAS_UNIDADE[i];
    if (u.andar !== andar) continue;
    props.push({ id: "mesa", x: u.x, y: u.y, disco: false });
    alvos.push({
      tipo: "apartamento",
      nome: `Apto ${u.unidade}`,
      x: u.x,
      y: u.y,
      alcance: 1.4,
      unidade: u.unidade,
      // casaId final = predio + unidade (preenchido ao entrar / no alvo).
      casaId: null,
    });
  }

  const saidas =
    andar === 0
      ? [
          { tx: DOOR_TX0, ty: ROWS - 1 },
          { tx: DOOR_TX1, ty: ROWS - 1 },
        ]
      : [];

  const planta = criarPlantaHub({
    papel: "condominio",
    origemX: o.x,
    origemY: o.y,
    tilesX: COLS,
    tilesY: ROWS,
    anel: true,
    camada: camadaChao(andar),
    corParede: "#8a7a68",
    corBalcao: "#d2c4a8",
    saidas,
    props,
    alvos,
  });

  // Sem saída sul nos andares altos: fecha o vão da porta no anel.
  if (andar > 0) {
    planta.doorX0 = COLS;
    planta.doorX1 = 0;
    planta.spawn = {
      x: o.x + ESCADA.x,
      y: o.y + ESCADA.y - 1.4,
      z: ALTURA_PRACA,
    };
  }

  planta.andar = andar;
  planta.stairsUp = andar < ANDARES_CONDOMINIO - 1 ? { ...ESCADA } : null;
  planta.stairsDown = andar > 0 ? { x: ESCADA.x - 2.2, y: ESCADA.y } : null;
  return planta;
}

const PLANTAS = Object.freeze(
  Array.from({ length: ANDARES_CONDOMINIO }, (_, i) => montarAndar(i)),
);

export function plantasCondominio() {
  return PLANTAS;
}

export function plantaCondominio(andar = 0) {
  const i = Math.max(0, Math.min(ANDARES_CONDOMINIO - 1, andar | 0));
  return PLANTAS[i];
}

export function spawnCondominio(andar = 0) {
  return plantaCondominio(andar).spawn;
}

export function aplicarCondominioNoChunk(chunk) {
  let mudou = false;
  for (let i = 0; i < PLANTAS.length; i++) {
    if (aplicarPlantaNoChunk(chunk, PLANTAS[i])) mudou = true;
  }
  return mudou;
}

export function dentroDoTerrenoCondominio(wx, wy) {
  for (let i = 0; i < PLANTAS.length; i++) {
    if (dentroDoTerrenoHub(PLANTAS[i], wx, wy)) return true;
  }
  return false;
}

export function naSaidaCondominio(x, y, andar = 0) {
  if ((andar | 0) !== 0) return false;
  return naSaidaPlanta(plantaCondominio(0), x, y);
}

export function alvoDoCondominio(x, y, andar = 0, predioId = "") {
  const alvo = alvoDaPlanta(plantaCondominio(andar), x, y);
  if (!alvo) return null;
  if (alvo.tipo === "apartamento") {
    return {
      ...alvo,
      casaId: idCasaUnidade(alvo.unidade, predioId),
    };
  }
  return alvo;
}

export function promptDoCondominio(alvo) {
  if (!alvo) return "";
  if (alvo.tipo === "npc") return alvo.nome || "Falar";
  if (alvo.tipo === "escada") return alvo.nome || "Escada";
  if (alvo.tipo === "apartamento") return alvo.nome || "Entrar";
  return "";
}

export function idApartamentoCondominio(unidade, predioId = "") {
  return idCasaUnidade(unidade, predioId);
}

export function ehApartamentoCondominio(casaId) {
  return String(casaId || "").includes(":apto:");
}
