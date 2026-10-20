import * as THREE from "three";
import { ALTURA_BLOCO } from "../../config.js";
import { alturaEm } from "../../mundo/altura.js";

/** Knobs alinhados ao GROUND_OVAL_SHADOW do Pokemon AI. */
const RAIO_CEL = 0.46;
const RX = RAIO_CEL * 0.95;
const RY = RAIO_CEL * 0.38;
const RAIO_REDONDO = 0.42;
const BASE_ALPHA = 0.34;
const SHRINK_K = 0.55;
const HOP_REF = 2.4;
const LIFT_Y = 0.02;
const SOUTH_BIAS = 0.08;
const QUEDA_OFF = 0.28;
const ALPHA_BAIXA = 0.22;

function criarOval(alphaBase) {
  const geo = new THREE.CircleGeometry(1, 24);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x0f172a,
    transparent: true,
    opacity: alphaBase,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  return mesh;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function elipseTocaCelula(x, y, cx, cy, rx, ry) {
  const px = clamp(x, cx, cx + 1);
  const py = clamp(y, cy, cy + 1);
  const dx = (px - x) / rx;
  const dy = (py - y) / ry;
  return dx * dx + dy * dy <= 1.05;
}

function coletarToposPerto(x, y, z, rx, ry) {
  const cx0 = Math.floor(x);
  const cy0 = Math.floor(y);
  const altos = [];
  const baixos = [];
  let zBaixo = null;

  for (let cy = cy0 - 1; cy <= cy0 + 1; cy++) {
    for (let cx = cx0 - 1; cx <= cx0 + 1; cx++) {
      const hz = alturaEm(cx, cy);
      if (hz <= 0) continue;
      if (!elipseTocaCelula(x, y, cx, cy, rx, ry)) continue;
      if (hz === z) altos.push({ cx, cy, z: hz });
      else if (hz < z) {
        baixos.push({ cx, cy, z: hz });
        zBaixo = zBaixo === null ? hz : Math.max(zBaixo, hz);
      }
    }
  }

  if (!altos.some((t) => t.cx === cx0 && t.cy === cy0)) {
    const hz = alturaEm(cx0, cy0);
    if (hz === z) altos.push({ cx: cx0, cy: cy0, z: hz });
  }

  if (zBaixo !== null) {
    return {
      baixos: baixos.filter((t) => t.z === zBaixo),
      zBaixo,
    };
  }
  return { baixos: [], zBaixo: null };
}

function projetarNoChaoBaixo(x, y, baixos) {
  let melhor = baixos[0];
  let melhorD = Infinity;
  let mx = x;
  let my = y;
  for (let i = 0; i < baixos.length; i++) {
    const t = baixos[i];
    const px = clamp(x, t.cx, t.cx + 0.999);
    const py = clamp(y, t.cy, t.cy + 0.999);
    const d = (px - x) * (px - x) + (py - y) * (py - y);
    if (d < melhorD) {
      melhorD = d;
      melhor = t;
      mx = px;
      my = py;
    }
  }
  return {
    x: x * 0.35 + mx * 0.65,
    y: y * 0.35 + my * 0.65,
    z: melhor.z,
  };
}

/**
 * XZ ao cair o centro do billboard na vertical até o chão.
 * vistaX/vistaY são o deslocamento do centro em relação ao pé, nos eixos da câmera.
 */
export function projetarCentroNoChao(camera, vistaX, vistaY, destino = { x: 0, z: 0 }) {
  destino.x = 0;
  destino.z = 0;
  if (!camera || (!vistaX && !vistaY)) return destino;
  camera.updateMatrixWorld();
  const e = camera.matrixWorld.elements;
  destino.x = e[0] * vistaX + e[4] * vistaY;
  destino.z = e[2] * vistaX + e[6] * vistaY;
  return destino;
}

/**
 * Sombra de contato (pés + beirada de cliff). Sem cast de shadow map.
 * redonda: disco no ponto em que o centro do sprite cai no chão.
 */
export function criarSombraContato3d(opcoes = {}) {
  const redonda = !!opcoes.redonda;
  const raioX = redonda ? RAIO_REDONDO : RX;
  const raioZ = redonda ? RAIO_REDONDO : RY;
  const grupo = new THREE.Group();
  grupo.name = "sombra-contato";

  const alto = criarOval(BASE_ALPHA);
  const baixo = criarOval(ALPHA_BAIXA);
  baixo.visible = false;
  grupo.add(alto);
  grupo.add(baixo);

  return {
    grupo,
    atualizar(corpoEstado, elevGrupo, desloc) {
      const naParede = !!(corpoEstado.escalando && corpoEstado.escalada);
      const dx = desloc?.x || 0;
      const dz = desloc?.z || 0;
      const bias = redonda ? 0 : SOUTH_BIAS;
      const x = corpoEstado.x + dx;
      const y = corpoEstado.y + dz;

      if (naParede) {
        const e = corpoEstado.escalada;
        const zChao = e.zBase > 0 ? e.zBase : 0;
        if (zChao <= 0) {
          alto.visible = false;
          baixo.visible = false;
          return;
        }
        const sx = (e.normalX || 0) * QUEDA_OFF;
        const sz = (e.normalY || 0) * QUEDA_OFF;
        alto.visible = true;
        baixo.visible = false;
        alto.material.opacity = BASE_ALPHA * 0.85;
        alto.scale.set(raioX, 1, raioZ);
        alto.position.set(
          sx + dx,
          (zChao - elevGrupo) * ALTURA_BLOCO + LIFT_Y,
          sz + dz + bias,
        );
        return;
      }

      const solo = corpoEstado.z ?? 0;
      const elev = elevGrupo;
      const lift = Math.max(0, elev - solo);
      const heightFrac = clamp(lift / HOP_REF, 0, 1);
      const shrink = 1 - heightFrac * SHRINK_K;
      const alpha =
        BASE_ALPHA *
        (1 - heightFrac * SHRINK_K) *
        (corpoEstado.noChao ? 1 : 0.85);

      alto.visible = alpha > 0.04;
      alto.material.opacity = Math.max(0.06, alpha);
      alto.scale.set(raioX * shrink, 1, raioZ * shrink);
      alto.position.set(dx, (solo - elev) * ALTURA_BLOCO + LIFT_Y, dz + bias);

      const { baixos, zBaixo } = coletarToposPerto(x, y, solo, raioX, raioZ);
      if (baixos.length && zBaixo !== null && solo > zBaixo) {
        const proj = projetarNoChaoBaixo(x, y, baixos);
        baixo.visible = true;
        baixo.material.opacity = ALPHA_BAIXA * shrink * (corpoEstado.noChao ? 1 : 0.7);
        baixo.scale.set(raioX * 0.85 * shrink, 1, raioZ * 0.85 * shrink);
        baixo.position.set(
          proj.x - corpoEstado.x,
          (proj.z - elev) * ALTURA_BLOCO + LIFT_Y,
          proj.y - corpoEstado.y + bias,
        );
      } else {
        baixo.visible = false;
      }
    },
    liberar() {
      for (const m of [alto, baixo]) {
        m.geometry.dispose();
        m.material.dispose();
      }
    },
  };
}
