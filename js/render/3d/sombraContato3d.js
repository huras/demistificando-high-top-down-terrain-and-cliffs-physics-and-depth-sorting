import * as THREE from "three";
import { alturaEm } from "../../mundo/altura.js";

/** Knobs alinhados ao GROUND_OVAL_SHADOW do Pokemon AI. */
const RAIO_CEL = 0.46;
const RX = RAIO_CEL * 0.95;
const RY = RAIO_CEL * 0.38;
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

function elipseTocaCelula(x, y, cx, cy) {
  const px = clamp(x, cx, cx + 1);
  const py = clamp(y, cy, cy + 1);
  const dx = (px - x) / RX;
  const dy = (py - y) / RY;
  return dx * dx + dy * dy <= 1.05;
}

function coletarToposPerto(x, y, z) {
  const cx0 = Math.floor(x);
  const cy0 = Math.floor(y);
  const altos = [];
  const baixos = [];
  let zBaixo = null;

  for (let cy = cy0 - 1; cy <= cy0 + 1; cy++) {
    for (let cx = cx0 - 1; cx <= cx0 + 1; cx++) {
      const hz = alturaEm(cx, cy);
      if (hz <= 0) continue;
      if (!elipseTocaCelula(x, y, cx, cy)) continue;
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
 * Dual oval de contato (pés + beirada de cliff). Sem cast de shadow map.
 */
export function criarSombraContato3d() {
  const grupo = new THREE.Group();
  grupo.name = "sombra-contato";

  const alto = criarOval(BASE_ALPHA);
  const baixo = criarOval(ALPHA_BAIXA);
  baixo.visible = false;
  grupo.add(alto);
  grupo.add(baixo);

  return {
    grupo,
    atualizar(corpoEstado, elevGrupo) {
      const naParede = !!(corpoEstado.escalando && corpoEstado.escalada);
      const x = corpoEstado.x;
      const y = corpoEstado.y;

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
        alto.scale.set(RX, 1, RY);
        alto.position.set(sx, zChao - elevGrupo + LIFT_Y, sz + SOUTH_BIAS);
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
      alto.scale.set(RX * shrink, 1, RY * shrink);
      alto.position.set(0, solo - elev + LIFT_Y, SOUTH_BIAS);

      const { baixos, zBaixo } = coletarToposPerto(x, y, solo);
      if (baixos.length && zBaixo !== null && solo > zBaixo) {
        const proj = projetarNoChaoBaixo(x, y, baixos);
        baixo.visible = true;
        baixo.material.opacity = ALPHA_BAIXA * shrink * (corpoEstado.noChao ? 1 : 0.7);
        baixo.scale.set(RX * 0.85 * shrink, 1, RY * 0.85 * shrink);
        baixo.position.set(
          proj.x - x,
          proj.z - elev + LIFT_Y,
          proj.y - y + SOUTH_BIAS,
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
