/**
 * Arco de mira 3D da pokébola (grenade-aim AAA).
 * Top-down: força = distância do cursor; vermelho = fora do alcance (pouso no máximo).
 * Buffer pré-alocado, zero alloc no tick quente.
 */
import * as THREE from "three";
import {
  ALTURA_BLOCO,
  BOLA_ARCO_AMOSTRAS,
  BOLA_DIAMETRO,
} from "../../config.js";
import { alturaSobPes } from "../../fisica/colisao.js";
import { simularTrajetoriaBola } from "../../jogo/rangedFisica.js";

const COR_OK = new THREE.Color(0x7dd3fc);
const COR_IMPACTO_OK = new THREE.Color(0xfde68a);
const COR_FORA = new THREE.Color(0xf87171);
const COR_FORA_ESCURO = new THREE.Color(0x991b1b);

/**
 * @returns {{
 *   grupo: THREE.Group,
 *   atualizar: (corpo: object, camera3d: object | null, opts?: object) => void,
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
    color: COR_OK,
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
    color: COR_IMPACTO_OK,
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
    color: COR_IMPACTO_OK,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const disco = new THREE.Mesh(geoDisco, matDisco);
  disco.position.y = 0.01;
  anel.add(disco);

  // Anel fantasma no cursor quando o alvo está fora do alcance.
  const geoGhost = new THREE.RingGeometry(BOLA_DIAMETRO * 0.35, BOLA_DIAMETRO * 0.85, 22);
  geoGhost.rotateX(-Math.PI / 2);
  const matGhost = new THREE.MeshBasicMaterial({
    color: COR_FORA,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const anelGhost = new THREE.Mesh(geoGhost, matGhost);
  anelGhost.visible = false;
  anelGhost.frustumCulled = false;
  grupo.add(anelGhost);

  // Cruz no máximo (fora de alcance).
  const geoCruz = new THREE.BufferGeometry();
  const cruzPos = new Float32Array([
    -0.28, 0.04, 0, 0.28, 0.04, 0,
    0, 0.04, -0.28, 0, 0.04, 0.28,
  ]);
  geoCruz.setAttribute("position", new THREE.BufferAttribute(cruzPos, 3));
  const matCruz = new THREE.LineBasicMaterial({
    color: COR_FORA,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const cruz = new THREE.LineSegments(geoCruz, matCruz);
  cruz.visible = false;
  anel.add(cruz);

  function ocultar() {
    grupo.visible = false;
    anelGhost.visible = false;
    cruz.visible = false;
  }

  /**
   * @param {object} corpo
   * @param {object | null} camera3d
   * @param {{ ativo?: boolean, mostrar?: boolean, carga?: number, mira?: { x: number, y: number } | null }} [opts]
   */
  function atualizar(corpo, camera3d, opts = {}) {
    const ativo = !!opts.ativo;
    const mostrar = !!(opts.mostrar ?? opts.mirando);
    const carga = Math.min(1, Math.max(0, Number(opts.carga) || 0));
    if (!ativo || !mostrar || !corpo || !camera3d) {
      ocultar();
      return;
    }

    const { posicoes, count, impacto, alcancavel, miraCursor } = simularTrajetoriaBola(
      corpo,
      camera3d,
      carga,
      opts.mira || null,
    );
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

    const fora = alcancavel === false;
    const corArco = fora ? COR_FORA : COR_OK;
    const corAnel = fora ? COR_FORA : COR_IMPACTO_OK;
    matLinha.color.copy(corArco);
    matAnel.color.copy(corAnel);
    matDisco.color.copy(fora ? COR_FORA_ESCURO : COR_IMPACTO_OK);
    matCruz.color.copy(COR_FORA);

    const pulso = 1 + Math.sin(performance.now() * 0.008) * 0.06;
    anel.position.set(impacto.x, impacto.z * ALTURA_BLOCO + 0.03, impacto.y);
    anel.scale.setScalar(pulso * (fora ? 1.05 : 0.9 + carga * 0.25));
    matLinha.opacity = fora ? 0.85 : 0.55 + carga * 0.4;
    matAnel.opacity = fora ? 0.9 : 0.55 + carga * 0.35;
    cruz.visible = fora;

    if (fora && miraCursor && Number.isFinite(miraCursor.x) && Number.isFinite(miraCursor.y)) {
      const solo = alturaSobPes(miraCursor.x, miraCursor.y, (corpo.elevacao ?? corpo.z ?? 0) + 2) || 0;
      anelGhost.visible = true;
      anelGhost.position.set(miraCursor.x, solo * ALTURA_BLOCO + 0.04, miraCursor.y);
      anelGhost.scale.setScalar(0.95 + Math.sin(performance.now() * 0.012) * 0.08);
      matGhost.opacity = 0.4 + Math.sin(performance.now() * 0.01) * 0.1;
    } else {
      anelGhost.visible = false;
    }

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
      geoGhost.dispose();
      matGhost.dispose();
      geoCruz.dispose();
      matCruz.dispose();
    },
  };
}
