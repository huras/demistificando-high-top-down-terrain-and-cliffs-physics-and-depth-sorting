import * as THREE from "three";

/**
 * Cápsula legível + indicador de facing + sombra de contato.
 * opts: { nome, cor, emissive, detalhe }
 */
export function criarPersonagem3d(opts = {}) {
  const grupo = new THREE.Group();
  grupo.name = opts.nome || "personagem";

  const corpoMat = new THREE.MeshStandardMaterial({
    color: opts.cor ?? 0xf0d060,
    emissive: opts.emissive ?? 0x3a2a00,
    emissiveIntensity: 0.35,
    roughness: 0.45,
    metalness: 0.1,
  });
  const detalheMat = new THREE.MeshStandardMaterial({
    color: opts.detalhe ?? 0x3a6a9a,
    roughness: 0.5,
    metalness: 0.15,
  });
  const asaMat = new THREE.MeshStandardMaterial({
    color: 0xc8e8ff,
    roughness: 0.35,
    metalness: 0.05,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });

  const corpo = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.42, 4, 10),
    corpoMat,
  );
  corpo.position.y = 0.43;
  corpo.castShadow = true;
  corpo.receiveShadow = true;
  grupo.add(corpo);

  const cabeca = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    corpoMat,
  );
  cabeca.position.y = 0.92;
  cabeca.castShadow = true;
  grupo.add(cabeca);

  const nariz = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.14, 6),
    detalheMat,
  );
  nariz.rotation.x = Math.PI / 2;
  nariz.position.set(0, 0.9, 0.18);
  grupo.add(nariz);

  const asa = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.55), asaMat);
  asa.position.set(0, 0.85, -0.05);
  asa.rotation.x = -0.35;
  asa.visible = false;
  grupo.add(asa);

  const sombra = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 20),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = 0.02;
  grupo.add(sombra);

  return {
    grupo,
    atualizar(corpoEstado) {
      const elev =
        corpoEstado.elevacao ??
        corpoEstado.z + (corpoEstado.hopLift || 0);
      grupo.position.set(corpoEstado.x, elev, corpoEstado.y);

      const ang = Math.atan2(corpoEstado.dirX || 0, corpoEstado.dirY || 1);
      grupo.rotation.y = ang;

      const naParede = !!(corpoEstado.escalando && corpoEstado.escalada);

      // escalada: inclina um pouco pra parede
      if (naParede) {
        const e = corpoEstado.escalada;
        const nx = e.normalX || 0;
        const ny = e.normalY || 0;
        grupo.rotation.x = -0.15;
        if (Math.abs(nx) > Math.abs(ny)) {
          grupo.rotation.z = nx > 0 ? 0.2 : -0.2;
        } else {
          grupo.rotation.x = ny > 0 ? 0.25 : -0.35;
        }
      } else {
        grupo.rotation.x = 0;
        grupo.rotation.z = 0;
      }

      asa.visible = !!corpoEstado.planando;
      if (corpoEstado.planando) {
        asa.rotation.z = Math.sin(performance.now() * 0.004) * 0.08;
      }

      // Na parede: sem cast no cliff; blob no chão da queda (zBase)
      corpo.castShadow = !naParede;
      cabeca.castShadow = !naParede;

      if (naParede) {
        const e = corpoEstado.escalada;
        const zChao = e.zBase > 0 ? e.zBase : 0;
        sombra.visible = true;
        sombra.material.opacity = 0.3;
        // local Y: sobe do pivô (elev) até a altura do chão da queda
        sombra.position.set(0, zChao - elev + 0.03, 0);
      } else {
        const solo = corpoEstado.z ?? 0;
        sombra.visible = true;
        sombra.material.opacity = corpoEstado.noChao ? 0.35 : 0.16;
        sombra.position.set(0, solo - elev + 0.03, 0);
      }
    },
    liberar() {
      grupo.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
    },
  };
}
