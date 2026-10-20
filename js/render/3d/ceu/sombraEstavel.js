import * as THREE from "three";

/** Resolução do shadow map do sol. Um único dono desta constante. */
export const MAPA_SOMBRA_SOL = 2048;

const _eixoZ = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _offset = new THREE.Vector3();
/** Mesmo up padrão da Camera/Object3D do Three. */
const _mundoY = new THREE.Vector3(0, 1, 0);

/**
 * Abre o volume ortográfico até o disco de blocos e quantiza o half-extent
 * para o mapa não mudar a cada fração de raio do stream.
 * Retorna o meio efetivo usado no frustum.
 */
export function aplicarAlcanceSombra(sol, meio, distLuz = 72) {
  const cam = sol.shadow.camera;
  const mapSize = sol.shadow.mapSize.x || MAPA_SOMBRA_SOL;
  const meioEstavel = Math.max(1, Math.ceil(meio));
  const recuo = Math.max(distLuz, meioEstavel + 16);

  cam.left = -meioEstavel;
  cam.right = meioEstavel;
  cam.top = meioEstavel;
  cam.bottom = -meioEstavel;
  cam.near = 1;
  cam.far = recuo + meioEstavel + 40;
  cam.updateProjectionMatrix();

  const texel = (meioEstavel * 2) / mapSize;
  sol.shadow.normalBias = texel * 1.5;
  sol.shadow.bias = -(texel * 0.35) / (cam.far - cam.near);
  return meioEstavel;
}

/**
 * Ancora sol + target ao grid de texels no espaço da luz.
 * Elimina shadow swimming quando o jogador anda em float contínuo.
 * `dir` aponta do alvo para a luz (mesmo vetor usado em aplicarLuzes).
 *
 * Eixos iguais ao Matrix4.lookAt do Three: Z = eye−target, X = up×Z, Y = Z×X.
 * Se Z // up, aplica o mesmo nudge de 1e-4 do Three antes de montar a base.
 */
export function ancorarSombraSol(sol, alvo, dir) {
  const cam = sol.shadow.camera;
  const mapSize = sol.shadow.mapSize.x || MAPA_SOMBRA_SOL;
  const largura = cam.right - cam.left;
  if (!(largura > 0) || !(mapSize > 0)) return;

  const texel = largura / mapSize;
  if (!(texel > 0)) return;

  _eixoZ.copy(dir);
  if (_eixoZ.lengthSq() < 1e-10) _eixoZ.z = 1;
  _eixoZ.normalize();

  _right.crossVectors(_mundoY, _eixoZ);
  if (_right.lengthSq() < 1e-10) {
    // Parallel to Camera.up — mesmo desempate do Matrix4.lookAt.
    if (Math.abs(_mundoY.z) === 1) _eixoZ.x += 0.0001;
    else _eixoZ.z += 0.0001;
    _eixoZ.normalize();
    _right.crossVectors(_mundoY, _eixoZ);
  }
  if (_right.lengthSq() < 1e-10) return;
  _right.normalize();
  _up.crossVectors(_eixoZ, _right).normalize();

  const cx = alvo.x * _right.x + alvo.y * _right.y + alvo.z * _right.z;
  const cy = alvo.x * _up.x + alvo.y * _up.y + alvo.z * _up.z;
  const snapX = Math.floor(cx / texel) * texel;
  const snapY = Math.floor(cy / texel) * texel;

  _offset
    .copy(_right)
    .multiplyScalar(snapX - cx)
    .addScaledVector(_up, snapY - cy);

  if (_offset.lengthSq() < 1e-20) return;

  sol.position.add(_offset);
  sol.target.position.add(_offset);
  sol.target.updateMatrixWorld();
}
