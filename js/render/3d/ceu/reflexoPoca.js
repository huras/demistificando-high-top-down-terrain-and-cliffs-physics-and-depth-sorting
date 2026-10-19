import * as THREE from "three";
import { uniformsPoca } from "./pocaChao.js";

/** A camada 1 já é a auxiliar da cena. O chão fica só na 0. */
export const CAMADA_REFLEXO = 2;

const LIMIAR = 0.04;
const LARGURA_MAX = 960;
const FOLGA_PLANO = 0.05;

const raizes = new Set();
const lados = new Set();

const virtual = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
virtual.layers.set(CAMADA_REFLEXO);

const alvo = new THREE.WebGLRenderTarget(1, 1, {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  generateMipmaps: false,
  depthBuffer: true,
  stencilBuffer: true,
  samples: 0,
  type: THREE.UnsignedByteType,
});
alvo.texture.name = "reflexo-poca";

const tamanho = new THREE.Vector2();
const ponto = new THREE.Vector3();
const normal = new THREE.Vector3(0, 1, 0);
const cameraMundo = new THREE.Vector3();
const rotacao = new THREE.Matrix4();
const olhar = new THREE.Vector3();
const vista = new THREE.Vector3();
const alvoOlhar = new THREE.Vector3();
const plano = new THREE.Plane();
const clip = new THREE.Vector4();
const q = new THREE.Vector4();
const corLimpa = new THREE.Color();
const domoGuardado = new THREE.Vector3();

let domoEscala = 1;
let domoMovido = false;

uniformsPoca.uReflexoPoca.value = alvo.texture;

/**
 * Entra no passe. A câmera espelhada inverte a ordem dos vértices, então todo
 * material FrontSide vira DoubleSide só enquanto o passe roda. Sprite já olha
 * para a câmera. Piso deitado (rotação X de ±90°) continua de fora: é chão.
 */
export function marcarReflexo(objeto) {
  if (!objeto) return;
  raizes.add(objeto);
  aplicarMarca(objeto);
}

export function marcarLuzReflexo(luz) {
  if (luz) luz.layers.enable(CAMADA_REFLEXO);
}

export function soltarReflexo(objeto) {
  if (!objeto) return;
  raizes.delete(objeto);
  objeto.traverse((filho) => {
    if (!filho.material) return;
    const lista = Array.isArray(filho.material) ? filho.material : [filho.material];
    for (let i = 0; i < lista.length; i++) lados.delete(lista[i]);
  });
}

function aplicarMarca(objeto) {
  objeto.traverse((filho) => {
    if (ehPiso(filho)) return;
    filho.layers.enable(CAMADA_REFLEXO);
    if (filho.isSprite || !filho.material) return;
    const lista = Array.isArray(filho.material) ? filho.material : [filho.material];
    for (let i = 0; i < lista.length; i++) anotarLado(lista[i]);
  });
}

function sincronizarRaizes() {
  for (const raiz of raizes) aplicarMarca(raiz);
}

function ehPiso(filho) {
  if (!filho.isMesh || filho.geometry?.type !== "PlaneGeometry") return false;
  const rx = filho.rotation.x;
  return Math.abs(Math.abs(rx) - Math.PI * 0.5) < 0.25;
}

function anotarLado(mat) {
  if (!mat || mat.side !== THREE.FrontSide || mat.userData?.ladoReflexo != null) return;
  if (!mat.userData) mat.userData = {};
  mat.userData.ladoReflexo = mat.side;
  lados.add(mat);
}

function aplicarLadoDuplo(ativo) {
  for (const mat of lados) {
    mat.side = ativo ? THREE.DoubleSide : mat.userData.ladoReflexo;
  }
}

function ajustarAlvo(renderer) {
  renderer.getDrawingBufferSize(tamanho);
  let w = Math.max(1, tamanho.x >> 1);
  let h = Math.max(1, tamanho.y >> 1);
  if (w > LARGURA_MAX) {
    h = Math.max(1, Math.round((h * LARGURA_MAX) / w));
    w = LARGURA_MAX;
  }
  if (alvo.width !== w || alvo.height !== h) alvo.setSize(w, h);
  virtual.aspect = w / h;
}

function espelhar(camera, planoY) {
  ponto.set(0, planoY, 0);
  normal.set(0, 1, 0);
  cameraMundo.setFromMatrixPosition(camera.matrixWorld);
  vista.subVectors(ponto, cameraMundo);
  if (vista.dot(normal) >= -FOLGA_PLANO) return false;

  vista.reflect(normal).negate();
  vista.add(ponto);

  rotacao.extractRotation(camera.matrixWorld);
  olhar.set(0, 0, -1).applyMatrix4(rotacao).add(cameraMundo);
  alvoOlhar.subVectors(ponto, olhar);
  alvoOlhar.reflect(normal).negate();
  alvoOlhar.add(ponto);

  virtual.position.copy(vista);
  virtual.up.set(0, 1, 0).applyMatrix4(rotacao).reflect(normal);
  virtual.near = camera.near;
  virtual.far = camera.far;
  virtual.lookAt(alvoOlhar);
  virtual.updateMatrixWorld();
  virtual.projectionMatrix.copy(camera.projectionMatrix);
  return true;
}

/**
 * Terceira linha da projeção vira o plano da água (Lengyel).
 * Na ortográfica, e na mistura com ela, essa troca manda o z para fora do NDC
 * e o passe fica só com o céu. Aí o chão já está fora pela camada.
 */
function corteObliquo() {
  const e = virtual.projectionMatrix.elements;
  if (Math.abs(e[11] + 1) > 0.2) return;
  plano.setFromNormalAndCoplanarPoint(normal, ponto);
  plano.applyMatrix4(virtual.matrixWorldInverse);
  clip.set(plano.normal.x, plano.normal.y, plano.normal.z, plano.constant);
  if (Math.abs(e[0]) < 1e-8 || Math.abs(e[5]) < 1e-8 || Math.abs(e[14]) < 1e-8) return;
  q.set((Math.sign(clip.x) + e[8]) / e[0], (Math.sign(clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
  const escala = clip.dot(q);
  if (Math.abs(escala) < 1e-8) return;
  clip.multiplyScalar(2 / escala);
  e[2] = clip.x;
  e[6] = clip.y;
  e[10] = clip.z + 1 - 0.003;
  e[14] = clip.w;
  virtual.projectionMatrixInverse.copy(virtual.projectionMatrix).invert();
}

function posicionarDomo(scene) {
  const domo = scene.getObjectByName("ceu-domo");
  if (!domo) return null;
  domoGuardado.copy(domo.position);
  domoMovido = true;
  domoEscala = domo.scale.x || 1;
  const dist = Math.max(0.5, Math.abs(virtual.position.y - ponto.y));
  const raio = Math.min(virtual.far * 0.85, Math.max(dist + 6, dist * 1.8));
  domo.position.copy(virtual.position);
  domo.scale.setScalar(raio);
  domo.updateMatrixWorld(true);
  return domo;
}

function restaurarDomo(domo) {
  if (!domo || !domoMovido) return;
  domo.position.copy(domoGuardado);
  domo.scale.setScalar(domoEscala);
  domo.updateMatrixWorld(true);
  domoMovido = false;
}

/**
 * Desenha céu, árvore e estrutura no plano dos pés.
 * Sem poça, dentro da sala ou com a câmera abaixo do plano, não roda.
 */
export function desenharReflexo(renderer, scene, camera, planoY, sala) {
  uniformsPoca.uTemReflexo.value = 0;
  uniformsPoca.uPlanoPoca.value = planoY || 0;
  if (sala || !renderer || !scene || !camera) return;
  if (uniformsPoca.uPoca.value < LIMIAR) return;

  sincronizarRaizes();
  if (!espelhar(camera, planoY)) return;

  const autoSombra = renderer.shadowMap.autoUpdate;
  const precisaSombra = renderer.shadowMap.needsUpdate;
  const xr = renderer.xr.enabled;
  const alvoAnt = renderer.getRenderTarget();
  renderer.getClearColor(corLimpa);
  const alfaLimpa = renderer.getClearAlpha();
  let domo = null;

  try {
    ajustarAlvo(renderer);
    uniformsPoca.uMatReflexo.value.multiplyMatrices(virtual.projectionMatrix, virtual.matrixWorldInverse);
    corteObliquo();
    aplicarLadoDuplo(true);
    domo = posicionarDomo(scene);

    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;
    renderer.setRenderTarget(alvo);
    if (scene.background?.isColor) renderer.setClearColor(scene.background, 1);
    renderer.clear(true, true, true);
    renderer.render(scene, virtual);
    uniformsPoca.uTemReflexo.value = 1;
  } finally {
    aplicarLadoDuplo(false);
    restaurarDomo(domo);
    renderer.xr.enabled = xr;
    renderer.shadowMap.autoUpdate = autoSombra;
    renderer.shadowMap.needsUpdate = precisaSombra;
    renderer.setRenderTarget(alvoAnt);
    renderer.setClearColor(corLimpa, alfaLimpa);
    const vistaCam = camera.viewport;
    if (vistaCam !== undefined) renderer.state.viewport(vistaCam);
  }
}
