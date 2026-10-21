import * as THREE from "three";
import { ESPACO } from "./config.js";

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
varying vec3 vDir;
uniform float uTempo;
uniform float uRot;

float hash13(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i);
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}

float fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * noise3(p);
    p = p * 2.07 + vec3(1.7, 3.1, 2.3);
    a *= 0.5;
  }
  return s;
}

vec3 rotY(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

void main() {
  vec3 rd = normalize(vDir);
  rd = rotY(rd, uRot + uTempo * 0.008);

  float h = rd.y * 0.5 + 0.5;
  vec3 voido = mix(vec3(0.02, 0.015, 0.07), vec3(0.07, 0.03, 0.14), h);
  voido = mix(voido, vec3(0.03, 0.05, 0.1), smoothstep(0.35, 0.85, abs(rd.x)));

  float nebA = fbm(rd * 2.4 + vec3(uTempo * 0.01, 0.0, 0.2));
  float nebB = fbm(rd * 3.6 + vec3(-0.3, uTempo * 0.007, 1.1));
  float veia = smoothstep(0.38, 0.75, nebA) * smoothstep(0.32, 0.68, nebB);
  vec3 mag = vec3(0.7, 0.16, 0.78);
  vec3 cian = vec3(0.16, 0.55, 0.92);
  vec3 ouro = vec3(0.85, 0.55, 0.22);
  vec3 neb = mix(mag, cian, clamp(nebB * 1.3, 0.0, 1.0));
  neb = mix(neb, ouro, smoothstep(0.55, 0.9, nebA) * 0.55);
  voido += neb * veia * 0.85;

  float banda = exp(-pow(rd.y * 3.2 + sin(rd.x * 2.0) * 0.15, 2.0) * 2.4);
  float poeira = fbm(rd * 5.0 + vec3(2.0, uTempo * 0.005, -1.0));
  voido += vec3(0.45, 0.35, 0.7) * banda * (0.28 + poeira * 0.45);

  vec3 g = floor(rd * 420.0);
  float n = hash13(g);
  float brilho = smoothstep(0.992, 0.9992, n);
  float tam = hash13(g + 17.3);
  float tw = 0.55 + 0.45 * sin(uTempo * (1.2 + tam * 2.4) + n * 40.0);
  float estrela = brilho * tw * (0.55 + tam * 0.9);
  voido += vec3(0.9, 0.93, 1.0) * estrela;

  float n2 = hash13(floor(rd * 180.0) + 9.1);
  float glint = smoothstep(0.997, 0.9997, n2);
  voido += vec3(1.0, 0.92, 0.7) * glint * (0.7 + 0.3 * sin(uTempo * 3.1 + n2 * 20.0));

  float ruido = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  voido += (ruido - 0.5) * 0.004;

  gl_FragColor = vec4(max(voido, 0.0), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * Domo espacial procedural — fundo da abertura.
 * @returns {{ mesh: THREE.Mesh, avancar: (dt: number) => void, liberar: () => void }}
 */
export function criarEspaco() {
  const geo = new THREE.SphereGeometry(ESPACO.raio, 48, 32);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTempo: { value: 0 },
      uRot: { value: 0 },
    },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "espaco-abertura";
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;

  let tempo = 0;

  return {
    mesh,
    avancar(dt) {
      tempo += dt;
      mat.uniforms.uTempo.value = tempo;
      mat.uniforms.uRot.value = tempo * ESPACO.rotacao;
    },
    liberar() {
      geo.dispose();
      mat.dispose();
    },
  };
}
