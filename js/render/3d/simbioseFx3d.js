/**
 * Glow da simbiose: Points aditivo (pool fixo) e anel dourado no pé.
 * Sem alocação por frame.
 */
import * as THREE from "three";
import { ALTURA_BLOCO } from "../../config.js";
import { cinemaSimbioseAtivo, particulasSimbiose } from "../../jogo/simbioseCinema.js";

const N = 16;
const VERT = `
attribute float aAlpha;
attribute float aScale;
attribute vec3 aColor;
varying vec3 vColor;
varying float vAlpha;
uniform float uSize;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * aScale * (280.0 / max(1.0, -mv.z));
  gl_Position = projectionMatrix * mv;
}
`;
const FRAG = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord - vec2(0.5);
  float d = length(p);
  if (d > 0.5) discard;
  if (vAlpha < 0.02) discard;
  float glow = smoothstep(0.5, 0.05, d);
  float core = smoothstep(0.22, 0.0, d);
  vec3 col = mix(vColor, vec3(1.0), core * 0.85);
  float a = glow * vAlpha;
  gl_FragColor = vec4(col * a, a);
}
`;

function anelNoChao(geo) {
  geo.rotateX(-Math.PI / 2);
  return geo;
}

export function criarSimbioseFx3d() {
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const alfa = new Float32Array(N);
  const escala = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aAlpha", new THREE.BufferAttribute(alfa, 1));
  geo.setAttribute("aScale", new THREE.BufferAttribute(escala, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSize: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    toneMapped: false,
  });
  const pontos = new THREE.Points(geo, mat);
  pontos.name = "simbiose-particulas";
  pontos.frustumCulled = false;
  pontos.visible = false;
  pontos.renderOrder = 8;
  pontos.raycast = () => {};

  const grupo = new THREE.Group();
  grupo.name = "simbiose-anel";
  grupo.visible = false;
  grupo.frustumCulled = false;
  const matAnel = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false,
  });
  const matFill = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false,
  });
  const fill = new THREE.Mesh(anelNoChao(new THREE.CircleGeometry(1, 40)), matFill);
  const anel = new THREE.Mesh(anelNoChao(new THREE.RingGeometry(0.86, 1, 40)), matAnel);
  fill.frustumCulled = false;
  anel.frustumCulled = false;
  fill.raycast = () => {};
  anel.raycast = () => {};
  fill.renderOrder = 2;
  anel.renderOrder = 2;
  grupo.add(fill, anel);
  grupo.scale.set(0.85, 1, 0.35);

  function atualizar(corpo, fundido) {
    const partes = particulasSimbiose();
    const cine = cinemaSimbioseAtivo() && partes;
    let alguma = false;
    if (cine) {
      const elev = ((corpo?.elevacao ?? corpo?.z ?? 0) + 0.55) * ALTURA_BLOCO;
      for (let i = 0; i < N; i++) {
        const p = partes[i];
        const i3 = i * 3;
        if (!p || !p.viva || p.alpha <= 0.02) {
          alfa[i] = 0;
          continue;
        }
        alguma = true;
        pos[i3] = p.x;
        pos[i3 + 1] = elev;
        pos[i3 + 2] = p.y;
        col[i3] = p.r;
        col[i3 + 1] = p.g;
        col[i3 + 2] = p.b;
        alfa[i] = p.alpha;
        escala[i] = 0.65 + p.scale * 0.7;
      }
    }
    pontos.visible = alguma;
    if (alguma) {
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aColor.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
      geo.attributes.aScale.needsUpdate = true;
    }

    const mostraAnel = !!fundido && !!corpo && !cine;
    grupo.visible = mostraAnel;
    if (mostraAnel) {
      const y = (corpo.elevacao ?? corpo.z ?? 0) * ALTURA_BLOCO + 0.06;
      grupo.position.set(corpo.x, y, corpo.y);
    }
  }

  return { pontos, anel: grupo, atualizar };
}
