/**
 * Fade de cobertura só na arena de combate.
 * Mantido separado da vegetação do overworld.
 */
import * as THREE from "three";
import { FADE_COBERTURA_ALPHA, FADE_COBERTURA_VEL } from "../../config.js";

const EPS_OPACO = 0.004;
const _dir = new THREE.Vector3();

/** @type {Map<string, { alpha: number, alvo: number }>} */
const fades = new Map();

/**
 * Atualiza alphas: peças que cobrem algum foco em relação à câmera ficam translúcidas.
 * @param {{ chave: string, x: number, y: number, r?: number, elev?: number }[]} pecas
 * @param {{ x: number, y: number, elevacao?: number, z?: number, hopLift?: number }[]} focos
 * @param {THREE.Camera} camera
 * @param {number} dt
 * @param {(chave: string, alpha: number) => void} aplicar
 */
export function tickFadeArena(pecas, focos, camera, dt, aplicar) {
  if (!camera || !pecas?.length) {
    for (const [chave] of fades) aplicar?.(chave, 1);
    fades.clear();
    return;
  }

  const cobrindo = new Set();
  camera.getWorldDirection(_dir);
  const cam = camera.position;
  const vivos = (focos || []).filter((f) => f && Number.isFinite(f.x) && Number.isFinite(f.y));

  for (let i = 0; i < pecas.length; i++) {
    const peca = pecas[i];
    if (!peca?.chave) continue;
    for (let f = 0; f < vivos.length; f++) {
      if (cobreFoco(peca, vivos[f], cam, _dir)) {
        cobrindo.add(peca.chave);
        break;
      }
    }
  }

  const t = 1 - Math.exp(-FADE_COBERTURA_VEL * Math.max(0, dt));
  const alphaAlvo = FADE_COBERTURA_ALPHA;

  for (const chave of cobrindo) {
    let e = fades.get(chave);
    if (!e) {
      e = { alpha: 1, alvo: alphaAlvo };
      fades.set(chave, e);
    }
    e.alvo = alphaAlvo;
  }

  for (const [chave, e] of fades) {
    if (!cobrindo.has(chave)) e.alvo = 1;
    e.alpha += (e.alvo - e.alpha) * t;
    if (e.alvo === 1 && e.alpha > 1 - EPS_OPACO) {
      e.alpha = 1;
      aplicar?.(chave, 1);
      fades.delete(chave);
      continue;
    }
    aplicar?.(chave, e.alpha);
  }
}

function elevFoco(foco) {
  const base = Number.isFinite(foco.elevacao) ? foco.elevacao : foco.z || 0;
  return base + (foco.hopLift || 0) + 0.55;
}

function cobreFoco(peca, foco, cam, dir) {
  const dx = peca.x - foco.x;
  const dy = peca.y - foco.y;
  const r = (peca.r || 0.6) + 1.15;
  if (dx * dx + dy * dy > r * r) return false;

  const yFoco = elevFoco(foco);
  const yPeca = peca.elev ?? 0.9;

  const distFoco =
    (foco.x - cam.x) * dir.x + (yFoco - cam.y) * dir.y + (foco.y - cam.z) * dir.z;
  const distPeca =
    (peca.x - cam.x) * dir.x + (yPeca - cam.y) * dir.y + (peca.y - cam.z) * dir.z;
  return distPeca < distFoco - 0.05;
}

export function limparFadeArena() {
  fades.clear();
}
