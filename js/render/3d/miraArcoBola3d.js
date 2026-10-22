/**
 * Arco de mira 3D da pokébola (grenade-aim AAA).
 * Linha tracejada + anel de impacto; buffer pré-alocado, zero alloc no tick.
 */
import * as THREE from "three";
import {
  ALTURA_BLOCO,
  BOLA_ARCO_AMOSTRAS,
  BOLA_DIAMETRO,
} from "../../config.js";
import { simularTrajetoriaBola } from "../../jogo/rangedFisica.js";

const COR_ARCO = new THREE.Color(0x7dd3fc);
const COR_IMPACTO = new THREE.Color(0xfde68a);

/**
 * @returns {{
 *   grupo: THREE.Group,
 *   atualizar: (corpo: object, camera3d: object | null, opts?: { ativo?: boolean, mirando?: boolean, carga?: number }) => void,
 *   liberar: () => void,
 * }}
 */
export function criarMiraArcoBola3d() {
  const grupo = new THREE.Group();
  grupo.name = "mira-arco-bola";
  grupo.visible = false;
  grupo.renderOrder = 4;

  const pos = new Float32Array(BOLA_ARCO_AMOSTRAS * 3);
  const geoLinha = new THREE.BufferGeometry();
  geoLinha.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geoLinha.setDrawRange(0, 0);

  const matLinha = new THREE.LineDashedMaterial({
    color: COR_ARCO,
    dashSize: 0.18,
    gapSize: 0.12,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const linha = new THREE.Line(geoLinha, matLinha);
  linha.frustumCulled = false;
  grupo.add(linha);

  const geoAnel = new THREE.RingGeometry(BOLA_DIAMETRO * 0.55, BOLA_DIAMETRO * 1.15, 28);
  geoAnel.rotateX(-Math.PI / 2);
  const matAnel = new THREE.MeshBasicMaterial({
    color: COR_IMPACTO,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const anel = new THREE.Mesh(geoAnel, matAnel);
  anel.frustumCulled = false;
  grupo.add(anel);

  const geoDisco = new THREE.CircleGeometry(BOLA_DIAMETRO * 0.5, 20);
  geoDisco.rotateX(-Math.PI / 2);
  const matDisco = new THREE.MeshBasicMaterial({
    color: COR_IMPACTO,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const disco = new THREE.Mesh(geoDisco, matDisco);
  disco.position.y = 0.01;
  anel.add(disco);

  function ocultar() {
    grupo.visible = false;
  }

  /**
   * @param {object} corpo
   * @param {object | null} camera3d
   * @param {{ ativo?: boolean, mirando?: boolean, carga?: number }} [opts]
   */
  function atualizar(corpo, camera3d, opts = {}) {
    const ativo = !!opts.ativo;
    const mirando = !!opts.mirando;
    const carga = Math.min(1, Math.max(0, Number(opts.carga) || 0));
    if (!ativo || !mirando || !corpo || !camera3d) {
      ocultar();
      return;
    }

    const { posicoes, count, impacto } = simularTrajetoriaBola(corpo, camera3d, carga);
    if (count < 2) {
      ocultar();
      return;
    }

    const attr = geoLinha.attributes.position;
    const arr = attr.array;
    for (let i = 0; i < count * 3; i++) arr[i] = posicoes[i];
    attr.needsUpdate = true;
    geoLinha.setDrawRange(0, count);
    geoLinha.computeBoundingSphere();
    linha.computeLineDistances();

    const pulso = 1 + Math.sin(performance.now() * 0.008) * 0.06;
    anel.position.set(impacto.x, impacto.z * ALTURA_BLOCO + 0.03, impacto.y);
    anel.scale.setScalar(pulso * (0.85 + carga * 0.35));
    matLinha.opacity = 0.55 + carga * 0.4;
    matAnel.opacity = 0.55 + carga * 0.35;

    grupo.visible = true;
  }

  return {
    grupo,
    atualizar,
    liberar() {
      geoLinha.dispose();
      matLinha.dispose();
      geoAnel.dispose();
      matAnel.dispose();
      geoDisco.dispose();
      matDisco.dispose();
    },
  };
}
