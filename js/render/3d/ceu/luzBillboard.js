import * as THREE from "three";

/**
 * Cor do billboard como se o cartão olhasse para a luz (sol ou lua),
 * sem depender do yaw da câmera. O cartão que projeta sombra usa o mesmo
 * yaw — não o da câmera.
 */

const PI = Math.PI;
const normalSol = new THREE.Vector3(0, 1, 0);
const uNormalSol = { value: normalSol };
const direta = new THREE.Color(0.55, 0.5, 0.45);
const indireta = new THREE.Color(0.35, 0.32, 0.3);
const _dir = new THREE.Vector3();
const _cor = new THREE.Color();
const _out = new THREE.Color();
const _ind = new THREE.Color();

function direcaoDaLuz(luz, destino) {
  destino.copy(luz.position).sub(luz.target.position);
  if (destino.lengthSq() < 1e-8) destino.set(0, 1, 0);
  else destino.normalize();
  return destino;
}

function somarDireta(luz, ndot) {
  if (!luz || ndot <= 0) return;
  direta.add(_cor.copy(luz.color).multiplyScalar(luz.intensity * ndot));
}

/** Chamado depois que o céu posiciona sol, fill e rim. */
export function atualizarLuzBillboard({ sol, ambient, hemi, fill, rim }) {
  if (sol) direcaoDaLuz(sol, normalSol);

  indireta.set(0, 0, 0);
  if (ambient) {
    indireta.add(_cor.copy(ambient.color).multiplyScalar(ambient.intensity));
  }
  if (hemi) {
    const t = normalSol.y * 0.5 + 0.5;
    _cor.copy(hemi.groundColor).lerp(hemi.color, t).multiplyScalar(hemi.intensity);
    indireta.add(_cor);
  }

  direta.set(0, 0, 0);
  somarDireta(sol, 1);
  if (fill) somarDireta(fill, Math.max(0, normalSol.dot(direcaoDaLuz(fill, _dir))));
  if (rim) somarDireta(rim, Math.max(0, normalSol.dot(direcaoDaLuz(rim, _dir))));

  direta.multiplyScalar(1 / PI);
  indireta.multiplyScalar(1 / PI);
}

/** Yaw do cartão de sombra: plano de frente para o sol, igual a olhar pra ele. */
export function yawCartaoSol() {
  return Math.atan2(normalSol.x, normalSol.z);
}

/**
 * Sprite sem luz de cena (personagem): mesma cor que o cartão virado pro sol,
 * com a sombra de nuvem no mesmo peso do terreno.
 */
export function aplicarCorSprite(material, corBase, sombraNuvem) {
  const s = Math.max(0, Math.min(1, sombraNuvem ?? 1));
  const pesoIndireta = 1 - (1 - s) * 0.42;
  _out.copy(direta).multiplyScalar(s);
  _ind.copy(indireta).multiplyScalar(pesoIndireta);
  _out.add(_ind).multiply(corBase);
  material.color.copy(_out);
}

/** Troca a normal de iluminação. Não mexe no depth/sombra. */
export function aplicarLuzBillboard(material) {
  if (!material || material.userData?.luzBillboard) return material;
  if (!material.userData) material.userData = {};
  material.userData.luzBillboard = true;

  const anterior = material.onBeforeCompile;
  const chaveAnterior = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    if (anterior) anterior.call(material, shader, renderer);
    shader.uniforms.uNormalSol = uNormalSol;
    if (!shader.fragmentShader.includes("uniform vec3 uNormalSol")) {
      shader.fragmentShader = `uniform vec3 uNormalSol;\n${shader.fragmentShader}`;
    }
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      "#include <normal_fragment_maps>\nnormal = normalize( mat3( viewMatrix ) * uNormalSol );",
    );
  };
  material.customProgramCacheKey = function chaveLuzBillboard() {
    const base = typeof chaveAnterior === "function" ? chaveAnterior.call(this) : "";
    return `${base}|luz-billboard`;
  };
  return material;
}
