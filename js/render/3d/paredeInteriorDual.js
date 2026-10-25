/**
 * Cascas de interior em par: reta (mira) + inclinada −45° (órbita top-down).
 * Lean fixo pro norte da casa (−Z) — igual ao eixo do billboard, sem yaw pra câmera.
 */
import * as THREE from "three";
import { BILLBOARD_INCLINACAO } from "../../config.js";

const LIMIAR_INCLINADA = 0.15;
const LIMIAR_RETA = 0.08;
/** Topo deita pro norte (−Z). Oposto do sinal do cartão que deita no +Z da face. */
const LEAN_NORTE = -BILLBOARD_INCLINACAO;

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
  const paraDentroPositivo = aoLongoX ? czSala - z >= 0 : cxSala - x >= 0;

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

  // Pivot no pé: lean world-X pro norte; filho só orienta a face da parede.
  const pivot = new THREE.Group();
  pivot.name = "parede-inclinada";
  pivot.position.set(0, -h * 0.5, 0);
  pivot.rotation.x = LEAN_NORTE;

  const face = new THREE.Mesh(new THREE.PlaneGeometry(comprimento, h), mat);
  face.geometry.translate(0, h * 0.5, 0);
  if (aoLongoX) {
    face.rotation.y = paraDentroPositivo ? 0 : Math.PI;
    face.position.z = paraDentroPositivo ? d * 0.5 : -d * 0.5;
  } else {
    face.rotation.y = paraDentroPositivo ? -Math.PI / 2 : Math.PI / 2;
    face.position.x = paraDentroPositivo ? w * 0.5 : -w * 0.5;
  }
  face.castShadow = false;
  face.receiveShadow = true;
  pivot.add(face);
  pivot.visible = modoAtual === "inclinada";

  grupo.add(reta);
  grupo.add(pivot);
  faixas.push({ reta, inclinada: pivot });
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
