import * as THREE from "three";

/** Mesma geometria unitária do asaDeltaVisual 2D (nariz = +X). */
const VELA = [
  [1.28, 0],
  [-0.52, -1.18],
  [-0.52, 1.18],
];

const QUILHA = [
  [-0.42, 0],
  [1.12, 0],
];

const TRAVES = [
  [-0.22, -0.55, 1.12, 0],
  [-0.22, 0.55, 1.12, 0],
];

const PERSPECTIVA_Y = 0.44;
const ESCALA = 0.9;
const ATTACH = Object.freeze({ x: 0, y: 1.05, z: -0.05 });

function shapeVela() {
  const s = new THREE.Shape();
  s.moveTo(VELA[0][0], VELA[0][1]);
  s.lineTo(VELA[1][0], VELA[1][1]);
  s.lineTo(VELA[2][0], VELA[2][1]);
  s.closePath();
  return s;
}

function shapeHighlight() {
  const s = new THREE.Shape();
  s.moveTo(VELA[1][0], VELA[1][1]);
  s.lineTo(VELA[0][0], VELA[0][1]);
  s.lineTo(-0.12, 0);
  s.closePath();
  return s;
}

/**
 * Asa-delta teal com yaw/bank/bob — port do visual 2D.
 */
export function criarAsaDelta3d() {
  const grupo = new THREE.Group();
  grupo.name = "asa-delta";
  grupo.visible = false;
  grupo.position.set(ATTACH.x, ATTACH.y, ATTACH.z);
  grupo.scale.set(ESCALA, ESCALA * PERSPECTIVA_Y, ESCALA);

  // Shape no XY; deita no XZ (top-down legível)
  const geoVela = new THREE.ShapeGeometry(shapeVela());
  geoVela.rotateX(-Math.PI / 2);
  const matVela = new THREE.MeshBasicMaterial({
    color: 0x5ec8c0,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const meshVela = new THREE.Mesh(geoVela, matVela);
  meshVela.renderOrder = 4;
  grupo.add(meshVela);

  const geoHi = new THREE.ShapeGeometry(shapeHighlight());
  geoHi.rotateX(-Math.PI / 2);
  const matHi = new THREE.MeshBasicMaterial({
    color: 0x8fdad4,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const meshHi = new THREE.Mesh(geoHi, matHi);
  meshHi.position.y = 0.002;
  meshHi.renderOrder = 4;
  grupo.add(meshHi);

  const posQuilha = [
    QUILHA[0][0],
    0.004,
    QUILHA[0][1],
    QUILHA[1][0],
    0.004,
    QUILHA[1][1],
  ];
  const geoLinhas = new THREE.BufferGeometry();
  geoLinhas.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(posQuilha, 3),
  );
  const matQuilha = new THREE.LineBasicMaterial({
    color: 0x8b5a2b,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const linhasQuilha = new THREE.LineSegments(geoLinhas, matQuilha);
  linhasQuilha.renderOrder = 5;

  const posTraves = [];
  for (const t of TRAVES) {
    posTraves.push(t[0], 0.006, t[1], t[2], 0.006, t[3]);
  }
  const geoTraves = new THREE.BufferGeometry();
  geoTraves.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(posTraves, 3),
  );
  const matTraves = new THREE.LineBasicMaterial({
    color: 0xc4894a,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const linhasTraves = new THREE.LineSegments(geoTraves, matTraves);
  linhasTraves.renderOrder = 5;

  grupo.add(linhasQuilha);
  grupo.add(linhasTraves);

  // Contorno da vela
  const contorno = [
    VELA[0][0],
    0.003,
    VELA[0][1],
    VELA[1][0],
    0.003,
    VELA[1][1],
    VELA[1][0],
    0.003,
    VELA[1][1],
    VELA[2][0],
    0.003,
    VELA[2][1],
    VELA[2][0],
    0.003,
    VELA[2][1],
    VELA[0][0],
    0.003,
    VELA[0][1],
  ];
  const geoContorno = new THREE.BufferGeometry();
  geoContorno.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(contorno, 3),
  );
  const matContorno = new THREE.LineBasicMaterial({
    color: 0x2f4a46,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const linhasContorno = new THREE.LineSegments(geoContorno, matContorno);
  linhasContorno.renderOrder = 5;
  grupo.add(linhasContorno);

  return {
    grupo,
    atualizar(corpoEstado) {
      const planando = !!corpoEstado.planando;
      const voando = !!corpoEstado.voando;
      grupo.visible = planando || voando;
      if (!grupo.visible) return;

      const tempo = corpoEstado._glideTempo ?? performance.now() * 0.001;
      const bob = Math.sin(tempo * 7.2) * 0.035;
      grupo.position.y = ATTACH.y + bob;

      let yaw;
      if (planando && Number.isFinite(corpoEstado._glideYaw)) {
        yaw = corpoEstado._glideYaw;
      } else {
        const vx = corpoEstado.vx ?? 0;
        const vy = corpoEstado.vy ?? 0;
        if (Math.hypot(vx, vy) >= 0.08) yaw = Math.atan2(vy, vx);
        else yaw = Math.atan2(corpoEstado.dirY || 1, corpoEstado.dirX || 0);
      }
      // yaw 2D = atan2(vy,vx); nariz local +X → direção no XZ
      grupo.rotation.y = -yaw;
      const bank = corpoEstado._glideBank ?? 0;
      grupo.rotation.z = bank * 0.22;
      grupo.rotation.x = voando && !planando ? -0.12 : 0;

      if (voando && !planando) {
        matVela.color.setHex(0xffe080);
        matHi.color.setHex(0xfff0b0);
        matVela.opacity = 0.55;
        matHi.opacity = 0.5;
      } else {
        matVela.color.setHex(0x5ec8c0);
        matHi.color.setHex(0x8fdad4);
        matVela.opacity = 0.92;
        matHi.opacity = 0.88;
      }
    },
    liberar() {
      geoVela.dispose();
      geoHi.dispose();
      geoLinhas.dispose();
      geoTraves.dispose();
      geoContorno.dispose();
      matVela.dispose();
      matHi.dispose();
      matQuilha.dispose();
      matTraves.dispose();
      matContorno.dispose();
    },
  };
}
