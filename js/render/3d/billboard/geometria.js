import * as THREE from "three";

/**
 * Quad com o centro da base da arte na origem local.
 * Em high top-down isso NÃO é o pixel de baixo — é o ponto da textura
 * que representa o centro do contato com o chão (perspectiva da arte).
 * pivotX/pivotY: fração a partir do canto superior esquerdo.
 */
export function geometriaNoPe(pivotX, pivotY, largura = 1, altura = 1) {
  const px = Number.isFinite(pivotX) ? pivotX : 0.5;
  const py = Number.isFinite(pivotY) ? pivotY : 1;
  const w = largura > 0 ? largura : 1;
  const h = altura > 0 ? altura : 1;
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(w * (0.5 - px), h * (py - 0.5), 0);
  ajustarEsferaNoPe(geo);
  return geo;
}

/** Bounding sphere centrada no pivô, cobrindo o cartão inteiro. */
export function ajustarEsferaNoPe(geo) {
  if (!geo) return geo;
  geo.computeBoundingSphere();
  const esfera = geo.boundingSphere;
  if (!esfera) return geo;
  const alcance = esfera.center.length() + esfera.radius;
  esfera.center.set(0, 0, 0);
  esfera.radius = alcance;
  return geo;
}

/** Altura local do centro visual (metade do cartão acima do pivô), gizmos. */
export function centroVisualY(alturaCartao) {
  const h = Number(alturaCartao);
  return h > 0 ? h * 0.5 : 0;
}
