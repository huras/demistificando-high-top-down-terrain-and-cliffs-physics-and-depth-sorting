/**
 * Injeta discos de casas/móveis/cercas do jogador no índice de obstáculos.
 */
import { indexarBases } from "../fisica/obstaculos.js";
import { propsColisaoCasas, versaoEstruturasJogador } from "./estruturas.js";

const CX = -9997;
const CY = -9997;

let versao = -1;

export function sincronizarColisaoBase() {
  const v = versaoEstruturasJogador();
  if (v === versao) return;
  versao = v;
  indexarBases(CX, CY, propsColisaoCasas());
}

export function invalidarColisaoBase() {
  versao = -1;
}
