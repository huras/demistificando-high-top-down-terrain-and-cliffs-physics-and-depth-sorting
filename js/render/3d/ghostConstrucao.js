/**
 * Ghost 3D de construção + outline do claim.
 */
import * as THREE from "three";
import { alturaDoRelevo } from "../../mundo/bioma/catalogo.js";
import { claimRect } from "../../construir/base.js";
import { siteConstrucao } from "../../construir/ritual.js";
import { TIPO_CONSTRUIR } from "../../construir/catalogo.js";
import { pegadaDoModeloSite } from "../../mundo/sites/catalogo.js";
import { carregarMoldeCidade } from "./edificiosCidade.js";

/**
 * @returns {{
 *   grupo: THREE.Group,
 *   atualizar: (preview: object|null, claimPreview: object|null) => void,
 * }}
 */
export function criarGhostConstrucao() {
  const grupo = new THREE.Group();
  grupo.name = "ghost-construcao";

  /** @type {THREE.Object3D|null} */
  let ghost = null;
  /** @type {string|null} */
  let ghostKey = null;
  /** @type {Map<string, THREE.Group>} */
  const moldes = new Map();
  /** @type {THREE.LineSegments|null} */
  let claimLine = null;

  function tintar(obj, cor, opacity) {
    obj.traverse((filho) => {
      if (!filho.isMesh || !filho.material) return;
      const mats = Array.isArray(filho.material) ? filho.material : [filho.material];
      for (let i = 0; i < mats.length; i++) {
        const m = mats[i].clone();
        m.transparent = true;
        m.opacity = opacity;
        m.depthWrite = false;
        if (m.color) m.color.set(cor);
        mats[i] = m;
      }
      filho.material = Array.isArray(filho.material) ? mats : mats[0];
    });
  }

  function garantirMolde(buildingId) {
    if (moldes.has(buildingId)) return moldes.get(buildingId);
    const pegada = pegadaDoModeloSite(buildingId);
    const opts = pegada ? { ladoX: pegada.ladoX, ladoZ: pegada.ladoZ } : null;
    carregarMoldeCidade(buildingId, opts).then((g) => {
      if (g) moldes.set(buildingId, g);
    });
    return null;
  }

  function limparGhost() {
    if (ghost) {
      grupo.remove(ghost);
      ghost = null;
      ghostKey = null;
    }
  }

  function desenharClaim(rect, ok) {
    if (claimLine) {
      grupo.remove(claimLine);
      claimLine.geometry.dispose();
      claimLine.material.dispose();
      claimLine = null;
    }
    if (!rect) return;
    const z = alturaDoRelevo(rect.x0 + rect.cols * 0.5, rect.y0 + rect.rows * 0.5) + 0.08;
    const pts = [
      new THREE.Vector3(rect.x0, z, rect.y0),
      new THREE.Vector3(rect.x1, z, rect.y0),
      new THREE.Vector3(rect.x1, z, rect.y1),
      new THREE.Vector3(rect.x0, z, rect.y1),
      new THREE.Vector3(rect.x0, z, rect.y0),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: ok ? 0x4ade80 : 0xf87171,
      transparent: true,
      opacity: 0.9,
    });
    claimLine = new THREE.Line(geo, mat);
    grupo.add(claimLine);
  }

  function caixaSimples(w, h, d, cor, opacity) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        color: cor,
        transparent: true,
        opacity,
        depthWrite: false,
      })
    );
    mesh.position.y = h * 0.5;
    return mesh;
  }

  return {
    grupo,
    /**
     * @param {{ ok?: boolean, preview?: object, kind?: string, id?: string, progress?: number }|null} buildPreview
     * @param {{ ok?: boolean, rect?: object }|null} flagPreview
     */
    atualizar(buildPreview, flagPreview) {
      const ritual = siteConstrucao();
      const claim = flagPreview?.rect || (!buildPreview && !flagPreview ? claimRect() : null);
      if (flagPreview) {
        desenharClaim(flagPreview.rect, flagPreview.ok !== false);
      } else if (claim && !buildPreview) {
        desenharClaim(claim, true);
      } else if (!flagPreview) {
        desenharClaim(null);
      }

      const src = ritual
        ? {
            ok: true,
            preview: ritual.preview,
            kind: ritual.kind,
            id: ritual.id,
            progress: ritual.progress,
          }
        : buildPreview;

      if (!src?.preview) {
        limparGhost();
        return;
      }

      const p = src.preview;
      const kind = src.kind || (p.buildingId ? TIPO_CONSTRUIR.CASA : p.key ? TIPO_CONSTRUIR.MOVEL : TIPO_CONSTRUIR.CERCA);
      const id = src.id || p.buildingId || p.key || "fence";
      const key = `${kind}:${id}:${p.x ?? p.tx}:${p.y ?? p.ty}`;
      const ok = src.ok !== false;
      const cor = ok ? 0x4ade80 : 0xf87171;
      const opacity = ritual ? 0.35 + 0.45 * (ritual.progress || 0) : 0.45;

      if (key !== ghostKey) {
        limparGhost();
        ghostKey = key;
        if (kind === TIPO_CONSTRUIR.CASA) {
          const molde = garantirMolde(id);
          if (molde) {
            ghost = molde.clone(true);
            tintar(ghost, cor, opacity);
          } else {
            ghost = caixaSimples(p.cols || 6, 3, p.rows || 5, cor, opacity);
          }
        } else if (kind === TIPO_CONSTRUIR.MOVEL) {
          ghost = caixaSimples(0.8, 0.8, 0.8, cor, opacity);
        } else {
          ghost = caixaSimples(0.9, 1.1, 0.25, cor, opacity);
        }
        ghost.userData.ghostOk = ok;
        ghost.userData.ghostOpacity = opacity;
        grupo.add(ghost);
      } else if (
        ghost &&
        (ghost.userData.ghostOk !== ok ||
          Math.abs((ghost.userData.ghostOpacity || 0) - opacity) > 0.04)
      ) {
        tintar(ghost, cor, opacity);
        ghost.userData.ghostOk = ok;
        ghost.userData.ghostOpacity = opacity;
      }

      if (!ghost) return;
      const x = p.x ?? p.tx + 0.5;
      const y = p.y ?? p.ty + 0.5;
      const z = Number.isFinite(p.z) ? p.z : alturaDoRelevo(x, y);
      ghost.position.set(x, z, y);
    },
  };
}
