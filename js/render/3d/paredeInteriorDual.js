/**
 * Cascas de interior em par: reta (mira) + inclinada −45° (órbita top-down).
 * Lean fixo no eixo da parede — sem yaw pra câmera.
 */
import * as THREE from "three";
import { BILLBOARD_INCLINACAO } from "../../config.js";

const LIMIAR_INCLINADA = 0.15;
const LIMIAR_RETA = 0.08;

/** @type {{ reta: THREE.Object3D, inclinada: THREE.Object3D }[]} */
const faixas = [];
/** @type {"inclinada" | "reta"} */
let modoAtual = "inclinada";

/**
 * Face interna do box (índices Three: +x -x +y -y +z -z).
 * @param {THREE.Material | THREE.Material[]} materiais
 * @param {boolean} aoLongoX
 * @param {boolean} paraDentroPositivo
 */
function materialFace(materiais, aoLongoX, paraDentroPositivo) {
  if (!Array.isArray(materiais)) return materiais;
  if (aoLongoX) return paraDentroPositivo ? materiais[4] : materiais[5];
  return paraDentroPositivo ? materiais[0] : materiais[1];
}

/**
 * @param {{
 *   x: number, y: number, z: number,
 *   w: number, d: number, h: number,
 *   materiais: THREE.Material | THREE.Material[],
 *   cxSala: number, czSala: number,
 * }} opts
 */
export function criarFaixaParede(opts) {
  const { x, y, z, w, d, h, materiais, cxSala, czSala } = opts;
  const aoLongoX = w >= d;
  const dx = cxSala - x;
  const dz = czSala - z;
  const paraDentroPositivo = aoLongoX ? dz >= 0 : dx >= 0;

  const grupo = new THREE.Group();
  grupo.position.set(x, y, z);
  grupo.name = "parede-dual";

  const reta = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materiais);
  reta.name = "parede-reta";
  reta.castShadow = false;
  reta.receiveShadow = true;
  reta.visible = modoAtual === "reta";

  const comprimento = aoLongoX ? w : d;
  const mat = materialFace(materiais, aoLongoX, paraDentroPositivo);
  const inclinada = new THREE.Mesh(new THREE.PlaneGeometry(comprimento, h), mat);
  inclinada.name = "parede-inclinada";
  inclinada.geometry.translate(0, h * 0.5, 0);
  inclinada.position.set(
    aoLongoX ? 0 : paraDentroPositivo ? w * 0.5 : -w * 0.5,
    -h * 0.5,
    aoLongoX ? (paraDentroPositivo ? d * 0.5 : -d * 0.5) : 0,
  );
  inclinada.rotation.order = "YXZ";
  if (aoLongoX) inclinada.rotation.y = paraDentroPositivo ? 0 : Math.PI;
  else inclinada.rotation.y = paraDentroPositivo ? -Math.PI / 2 : Math.PI / 2;
  inclinada.rotation.x = BILLBOARD_INCLINACAO;
  inclinada.castShadow = false;
  inclinada.receiveShadow = true;
  inclinada.visible = modoAtual === "inclinada";

  grupo.add(reta);
  grupo.add(inclinada);
  faixas.push({ reta, inclinada });
  return grupo;
}

/** Alterna visibilidade com histerese; nunca desenha as duas sólidas. */
export function atualizarParedesDual(inclinacao = 0) {
  const abs = Math.abs(inclinacao);
  let modo = modoAtual;
  if (abs > LIMIAR_INCLINADA) modo = "inclinada";
  else if (abs < LIMIAR_RETA) modo = "reta";
  if (modo === modoAtual) return;
  modoAtual = modo;
  const showInc = modo === "inclinada";
  for (let i = 0; i < faixas.length; i++) {
    const f = faixas[i];
    f.inclinada.visible = showInc;
    f.reta.visible = !showInc;
  }
}
