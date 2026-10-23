/**
 * A caixa do editor, no mesmo deite do cartão 2D.
 * Posição no chão usa metrosPorBloco; a arte usa ESCALA_Y_CASA.
 */
import * as THREE from "three";
import { ESCALA_Y_CASA } from "../../config.js";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { yDoBloco } from "./escalaVertical.js";

const ALTURA = 3;
const _t = new THREE.Matrix4();
const _sp = new THREE.Matrix4().makeScale(1, ESCALA_Y_CASA, 1);
const _r = new THREE.Matrix4().makeRotationX(-Math.PI / 4);
const _tl = new THREE.Matrix4();
const _s = new THREE.Matrix4();
const _v = new THREE.Vector3();

export function matrizCartao(caixa, destino) {
  const m = destino || new THREE.Matrix4();
  _t.makeTranslation(caixa.px, yDoBloco(ALTURA_PRACA), caixa.py);
  _tl.makeTranslation(caixa.x, ALTURA * 0.5, caixa.y);
  _s.makeScale(Math.max(0.05, caixa.lx), ALTURA, Math.max(0.05, caixa.ly));
  return m.copy(_t).multiply(_sp).multiply(_r).multiply(_tl).multiply(_s);
}

export function escreverArestasCartao(pos, o, arestas, caixa) {
  const m = matrizCartao(caixa);
  for (let e = 0; e < arestas.length; e++) {
    const a = arestas[e];
    _v.set(a[0], a[1], a[2]).applyMatrix4(m);
    pos[o++] = _v.x;
    pos[o++] = _v.y;
    pos[o++] = _v.z;
    _v.set(a[3], a[4], a[5]).applyMatrix4(m);
    pos[o++] = _v.x;
    pos[o++] = _v.y;
    pos[o++] = _v.z;
  }
  return o;
}
