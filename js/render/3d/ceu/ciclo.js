import * as THREE from "three";
import { CLIMA_CFG } from "../../../clima/config.js";
import { INCLINACAO_SOL_PADRAO, ROTACAO_SOL_PADRAO } from "./parametros.js";

const GRAUS = Math.PI / 180;

function linear(hex) {
  return new THREE.Color(hex).convertSRGBToLinear();
}

function quadro(h, zenite, horizonte, chao, sol, exposicao, ambiente, hemi, estrelas) {
  return {
    h,
    zenite: linear(zenite),
    horizonte: linear(horizonte),
    chao: linear(chao),
    sol: linear(sol),
    exposicao,
    ambiente,
    hemi,
    estrelas,
  };
}

const CHAVES = [
  quadro(0, 0x1c2e4c, 0x4a6a98, 0x344458, 0xd5e4ff, 0.74, 0.2, 0.24, 1),
  quadro(4.6, 0x1e3050, 0x6a5060, 0x3a3038, 0xffa07a, 0.76, 0.2, 0.24, 0.55),
  quadro(6.15, 0x2a4d88, 0xff9468, 0xc88870, 0xffc49a, 0.9, 0.18, 0.28, 0.08),
  quadro(7.6, 0x2d6cba, 0xf0c2a0, 0xd0b8a4, 0xffe2c4, 1.02, 0.24, 0.34, 0),
  quadro(10, 0x2f74c8, 0xb7e2f8, 0xc5c0b0, 0xfff3dd, 1.08, 0.3, 0.4, 0),
  quadro(13, 0x2a6ec2, 0x9ad4f5, 0xb9c6c4, 0xfff7ea, 1.1, 0.32, 0.42, 0),
  quadro(16.3, 0x3a6aab, 0xffc8a0, 0xdcc4a8, 0xffe0b8, 1.12, 0.28, 0.36, 0),
  // Anoitecer: mantém leitura quente e piso de luz mais alto (antes caía demais).
  quadro(18.15, 0x2c5088, 0xffb898, 0xd2a890, 0xffdab0, 1.04, 0.3, 0.36, 0.02),
  quadro(19.7, 0x2e4a70, 0x7a8aa0, 0x4e5868, 0xf0d4e4, 0.92, 0.3, 0.34, 0.28),
  quadro(22.2, 0x1e3250, 0x526e9a, 0x3a4a5c, 0xd5e4ff, 0.8, 0.24, 0.28, 0.85),
  quadro(24, 0x1c2e4c, 0x4a6a98, 0x344458, 0xd5e4ff, 0.74, 0.2, 0.24, 1),
];

const COR_LUA = linear(0xd0def8);
const BRANCO = new THREE.Color(1, 1, 1);
/** Ardósia clara / sombra de tempestade (linear). */
const NUVEM_TEMPESTADE_LUZ = linear(0x7a8694);
const NUVEM_TEMPESTADE_SOMBRA = linear(0x2a323c);

const saida = {
  zenite: new THREE.Color(),
  horizonte: new THREE.Color(),
  chao: new THREE.Color(),
  neblina: new THREE.Color(),
  sol: new THREE.Color(),
  lua: COR_LUA,
  nuvemLuz: new THREE.Color(),
  nuvemSombra: new THREE.Color(),
  dirSol: new THREE.Vector3(),
  dirLua: new THREE.Vector3(),
  dirLuz: new THREE.Vector3(),
  brilhoSol: 1,
  brilhoLua: 0,
  estrelas: 0,
  exposicao: 1,
  ambiente: 0.3,
  hemi: 0.4,
  fill: 0.2,
  rim: 0.2,
  intensidadeSol: 1.5,
  pesoDia: 1,
};

function suave(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function misturar(destino, a, b, t) {
  destino.copy(a).lerp(b, t);
}

function amostrarChaves(hora) {
  let i = 0;
  while (i < CHAVES.length - 2 && CHAVES[i + 1].h <= hora) i++;
  const a = CHAVES[i];
  const b = CHAVES[i + 1];
  const t = suave((hora - a.h) / (b.h - a.h || 1));
  misturar(saida.zenite, a.zenite, b.zenite, t);
  misturar(saida.horizonte, a.horizonte, b.horizonte, t);
  misturar(saida.chao, a.chao, b.chao, t);
  misturar(saida.sol, a.sol, b.sol, t);
  saida.exposicao = a.exposicao + (b.exposicao - a.exposicao) * t;
  saida.ambiente = a.ambiente + (b.ambiente - a.ambiente) * t;
  saida.hemi = a.hemi + (b.hemi - a.hemi) * t;
  saida.estrelas = a.estrelas + (b.estrelas - a.estrelas) * t;
}

/** Arco do dia: nasce e se põe no horizonte; a inclinação é o auge ao meio-dia. */
export function direcaoSol(
  hora,
  destino,
  inclinacao = INCLINACAO_SOL_PADRAO,
  rotacao = ROTACAO_SOL_PADRAO,
) {
  const t = ((hora - 6) / 24) * Math.PI * 2;
  const elev = Math.sin(t) * (inclinacao * GRAUS);
  const az = t + rotacao * GRAUS;
  const ce = Math.cos(elev);
  destino.set(ce * Math.cos(az), Math.sin(elev), ce * Math.sin(az));
  return destino;
}

function passo(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1)));
  return t * t * (3 - 2 * t);
}

/**
 * Quadro do ciclo + grade do clima. Reusa os objetos de `saida`.
 * @param {number} hora
 * @param {object} clima resultado de avaliarClima
 * @param {{ inclinacao?: number, rotacao?: number }} [orbita]
 */
export function avaliarVisual(hora, clima, orbita) {
  amostrarChaves(hora);
  direcaoSol(
    hora,
    saida.dirSol,
    orbita?.inclinacao ?? INCLINACAO_SOL_PADRAO,
    orbita?.rotacao ?? ROTACAO_SOL_PADRAO,
  );
  saida.dirLua.set(-saida.dirSol.x, Math.max(0.15, -saida.dirSol.y), -saida.dirSol.z).normalize();

  const pesoDia = passo(-0.05, 0.28, saida.dirSol.y);
  saida.pesoDia = pesoDia;
  saida.brilhoSol = pesoDia * clima.sol;
  saida.brilhoLua = (1 - passo(-0.35, 0.08, saida.dirSol.y)) * (0.35 + (1 - clima.pesoNeblina) * 0.65);
  saida.estrelas *= 1 - clima.pesoNeblina * 0.85;

  saida.neblina.copy(saida.horizonte).lerp(clima.neblina, clima.pesoNeblina);
  saida.horizonte.lerp(clima.neblina, clima.pesoNeblina * 0.92);
  saida.chao.lerp(clima.neblina, Math.min(1, clima.pesoNeblina * 0.8));
  saida.zenite.lerp(clima.neblina, clima.pesoZenite);

  saida.nuvemLuz.copy(saida.sol).lerp(BRANCO, 0.62);
  saida.nuvemSombra.set(0.1, 0.14, 0.22).lerp(saida.chao, 0.22);
  if (clima.pesoNeblina > 0) {
    saida.nuvemLuz.lerp(clima.neblina, clima.pesoNeblina * 0.35);
    saida.nuvemSombra.lerp(clima.neblina, clima.pesoNeblina * 0.4);
  }
  // Tempestade: manto cinza, sem cumulus branco.
  const tempestade = Math.max(clima.chuva || 0, (clima.umidade || 0) * 0.85);
  if (tempestade > 0.01) {
    const t = Math.min(1, tempestade);
    saida.nuvemLuz.lerp(NUVEM_TEMPESTADE_LUZ, t * 0.92);
    saida.nuvemSombra.lerp(NUVEM_TEMPESTADE_SOMBRA, t * 0.88);
    saida.nuvemLuz.lerp(clima.neblina, t * 0.22);
    saida.nuvemSombra.lerp(clima.neblina, t * 0.18);
  }

  const expMul = CLIMA_CFG.chuvaExposicaoMul ?? 0.16;
  const ambExtra = CLIMA_CFG.chuvaAmbienteExtra ?? 0.08;
  saida.exposicao *= 1 - clima.pesoNeblina * expMul;
  saida.ambiente =
    saida.ambiente * (0.75 + 0.25 * clima.sol) +
    clima.pesoNeblina * 0.05 +
    tempestade * ambExtra;
  saida.hemi *= 0.78 + 0.22 * (1 - clima.pesoNeblina * 0.85);
  saida.fill = 0.06 + pesoDia * 0.24 * clima.sol;
  saida.rim = 0.12 + (1 - Math.min(1, Math.abs(saida.dirSol.y) * 1.4)) * 0.42 * pesoDia;

  const base = 0.72 + pesoDia * 1.01;
  const mulNoite = 1 - pesoDia * (1 - clima.sol);
  saida.intensidadeSol = base * mulNoite * (0.42 + 0.58 * pesoDia);

  if (saida.dirSol.y > 0.02) {
    saida.dirLuz.copy(saida.dirSol);
    if (saida.dirLuz.y < 0.2) {
      saida.dirLuz.y = 0.2;
      saida.dirLuz.normalize();
    }
  } else {
    saida.dirLuz.copy(saida.dirLua);
    if (saida.dirLuz.y < 0.28) {
      saida.dirLuz.y = 0.28;
      saida.dirLuz.normalize();
    }
  }

  return saida;
}
