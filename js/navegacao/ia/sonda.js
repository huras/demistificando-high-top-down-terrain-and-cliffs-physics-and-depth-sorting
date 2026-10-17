import { AGUA_LIMIAR_VADO } from "../../config.js";
import { alturaSobPes } from "../../fisica/colisao.js";
import { encherDiscos } from "../../fisica/obstaculos.js";
import { profundidadeRepouso } from "../../mundo/agua/fluxo.js";
import { ALCANCE_RAIO, SONDA_FRENTE } from "./constantes.js";
import { observar, preencherRaios, raios } from "./observacao.js";

const discos = new Float32Array(192);

/** Preenche a observação com árvore, água e queda do mundo. */
export function sondarMundo(agente, px, py, pz, fx, fy, dist, distSeguir, buf) {
  const elev = agente.elevacao ?? agente.z ?? 0;
  const n = encherDiscos(agente.x, agente.y, ALCANCE_RAIO, elev, discos);
  preencherRaios(agente.x, agente.y, fx, fy, discos, n, raios);
  const ax = agente.x + fx * SONDA_FRENTE;
  const ay = agente.y + fy * SONDA_FRENTE;
  const agua = profundidadeRepouso(ax, ay) > AGUA_LIMIAR_VADO ? 1 : 0;
  const z0 = alturaSobPes(agente.x, agente.y, elev + 1.2);
  const z1 = alturaSobPes(ax, ay, elev + 1.2);
  let queda = 0;
  if (z0 > 0 && (z1 <= 0 || z0 - z1 >= 2)) {
    const drop = z1 <= 0 ? 4 : z0 - z1;
    queda = Math.min(1, drop / 4);
  }
  const vel = Math.hypot(agente.vx || 0, agente.vy || 0);
  return observar(dist, pz - elev, raios, agua, queda, vel, distSeguir, agente._slado || 0, buf);
}
