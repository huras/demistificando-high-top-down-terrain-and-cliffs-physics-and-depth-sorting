import { entrada, saida } from "./observacao.js";
import { FATIA, PESOS } from "./pesos.js";
import { propagar } from "./rede.js";

const cmd = {
  ix: 0,
  iy: 0,
  querPulo: false,
  querPlanar: false,
  querEscalar: false,
  querVoar: false,
  soltarAsa: false,
  soltarParede: false,
  postoX: 0,
  postoY: 0,
  postoZ: 0,
};

export function calcularHabilidade(nome) {
  propagar(PESOS, FATIA[nome], entrada, saida);
  return saida;
}

/** Direção no mundo. Gate negativo para. Habilidade ilegal nem chega aqui. */
export function aplicarHabilidade(nome, fx, fy) {
  const lx = -fy;
  const ly = fx;
  let ax = Math.tanh(saida[0]);
  let ay = Math.tanh(saida[1]);
  const gate = entrada[15] <= 0.012 ? -1 : Math.tanh(saida[2]);
  const anda = gate >= 0 && ax * ax + ay * ay >= 0.04;
  cmd.querPulo = false;
  cmd.querEscalar = false;
  cmd.soltarParede = false;
  cmd.querVoar = nome === "voar" && anda;
  cmd.querPlanar = nome === "planar" && anda;
  cmd.soltarAsa = !cmd.querVoar && !cmd.querPlanar;
  if (!anda) {
    cmd.ix = 0;
    cmd.iy = 0;
    return cmd;
  }
  const wx = ax * fx + ay * lx;
  const wy = ax * fy + ay * ly;
  const m = Math.hypot(wx, wy) || 1;
  cmd.ix = wx / m;
  cmd.iy = wy / m;
  return cmd;
}

export function comandoSeguir() {
  return cmd;
}
