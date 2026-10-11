import * as THREE from "three";

const SEGMENTOS = 64;

/**
 * Círculo no plano do pivô e linha do pivô até a câmera.
 */
export function criarRigCamera3d() {
  const grupo = new THREE.Group();
  grupo.name = "rig-camera";

  const mat = new THREE.LineBasicMaterial({
    color: 0x7dce6a,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
  });

  const circuloGeo = new THREE.BufferGeometry();
  circuloGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array((SEGMENTOS + 1) * 3), 3),
  );
  const circulo = new THREE.Line(circuloGeo, mat);
  circulo.frustumCulled = false;
  circulo.renderOrder = 6;

  const linhaGeo = new THREE.BufferGeometry();
  linhaGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
  const linha = new THREE.Line(linhaGeo, mat);
  linha.frustumCulled = false;
  linha.renderOrder = 6;

  const raioGeo = new THREE.BufferGeometry();
  raioGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
  const raioLinha = new THREE.Line(raioGeo, mat);
  raioLinha.frustumCulled = false;
  raioLinha.renderOrder = 6;

  grupo.add(circulo, linha, raioLinha);
  grupo.visible = false;

  return {
    grupo,
    atualizar(camera3d) {
      const visivel = !!camera3d?.mostrarRig;
      grupo.visible = visivel;
      if (!visivel || !camera3d?.pivo) return;

      const p = camera3d.pivo;
      const raio = Math.max(
        0.5,
        camera3d.distancia * Math.max(0.15, Math.cos(camera3d.pitchOrbita)),
      );
      const arr = circuloGeo.attributes.position.array;
      for (let i = 0; i <= SEGMENTOS; i++) {
        const a = (i / SEGMENTOS) * Math.PI * 2;
        arr[i * 3] = p.x + Math.sin(a) * raio;
        arr[i * 3 + 1] = p.y;
        arr[i * 3 + 2] = p.z + Math.cos(a) * raio;
      }
      circuloGeo.attributes.position.needsUpdate = true;
      circuloGeo.computeBoundingSphere();

      const la = linhaGeo.attributes.position.array;
      const c = camera3d.cam.position;
      la[0] = p.x;
      la[1] = p.y;
      la[2] = p.z;
      la[3] = c.x;
      la[4] = c.y;
      la[5] = c.z;
      linhaGeo.attributes.position.needsUpdate = true;
      linhaGeo.computeBoundingSphere();

      const yaw = camera3d.yaw;
      const rb = raioGeo.attributes.position.array;
      rb[0] = p.x;
      rb[1] = p.y;
      rb[2] = p.z;
      rb[3] = p.x + Math.sin(yaw) * raio;
      rb[4] = p.y;
      rb[5] = p.z + Math.cos(yaw) * raio;
      raioGeo.attributes.position.needsUpdate = true;
      raioGeo.computeBoundingSphere();
    },
    liberar() {
      circuloGeo.dispose();
      linhaGeo.dispose();
      raioGeo.dispose();
      mat.dispose();
    },
  };
}
