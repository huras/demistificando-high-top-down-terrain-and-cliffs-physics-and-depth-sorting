import * as THREE from "three";
import {
  TILE,
  VEG_ALPHA_TEST,
  VEG_ARVORE_ESCALA,
  VEG_ARVORE_PE,
  VEG_MATA_ESCALA,
  VEG_MATA_PE,
  VEG_YAW_EPS,
} from "../../config.js";
import { alturaEm } from "../../mundo/altura.js";
import { PROPS } from "../../mundo/mapaDemo.js";
import { onDirty } from "../../mundo/voxel/storeMundo.js";

/**
 * Vegetação HD-2D: um InstancedMesh por tipo.
 * Quad com pivô no pé e billboard só no yaw (o pitch não deita o sprite).
 */

const CATALOGO = [
  {
    tipo: "arvore",
    chave: "arvore",
    escala: VEG_ARVORE_ESCALA,
    pe: VEG_ARVORE_PE,
    itens: [],
  },
  {
    tipo: "mata",
    chave: "mata",
    escala: VEG_MATA_ESCALA,
    pe: VEG_MATA_PE,
    itens: [],
  },
];

for (let i = 0; i < PROPS.length; i++) {
  const prop = PROPS[i];
  for (let t = 0; t < CATALOGO.length; t++) {
    if (CATALOGO[t].tipo === prop.tipo) CATALOGO[t].itens.push(prop);
  }
}

function medidasDe(img, escala) {
  const pw = img.naturalWidth || img.width || TILE;
  const ph = img.naturalHeight || img.height || TILE;
  return {
    largura: (pw / TILE) * escala,
    altura: (ph / TILE) * escala,
  };
}

function tocaProp(aabb) {
  if (!aabb || aabb.x0 == null) return true;
  for (let t = 0; t < CATALOGO.length; t++) {
    const itens = CATALOGO[t].itens;
    for (let i = 0; i < itens.length; i++) {
      const cx = Math.floor(itens[i].x);
      const cy = Math.floor(itens[i].y);
      if (cx >= aabb.x0 && cx <= aabb.x1 && cy >= aabb.y0 && cy <= aabb.y1) {
        return true;
      }
    }
  }
  return false;
}

function yawDiferente(atual, aplicado) {
  if (aplicado == null || !Number.isFinite(aplicado)) return true;
  const d = Math.atan2(Math.sin(atual - aplicado), Math.cos(atual - aplicado));
  return Math.abs(d) > VEG_YAW_EPS;
}

export function criarVegetacaoBillboard3d() {
  const grupo = new THREE.Group();
  grupo.name = "vegetacao-billboard";
  grupo.visible = false;

  const geo = new THREE.PlaneGeometry(1, 1);
  geo.translate(0, 0.5, 0);

  const dummy = new THREE.Object3D();
  /** @type {Map<string, object>} */
  const lotes = new Map();

  let yawAplicado = null;
  let alturasSujas = true;

  function soltarLote(lote) {
    grupo.remove(lote.mesh);
    lote.mesh.dispatchEvent({ type: "dispose" });
    lote.material.dispose();
    lote.depth.dispose();
    lote.textura.dispose();
  }

  function criarTextura(img) {
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  function montarLote(def, img) {
    const anterior = lotes.get(def.tipo);
    if (anterior) soltarLote(anterior);

    const { largura, altura } = medidasDe(img, def.escala);
    const tex = criarTextura(img);
    const material = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.92,
      metalness: 0,
      transparent: false,
      alphaTest: VEG_ALPHA_TEST,
      depthWrite: true,
      depthTest: true,
      side: THREE.FrontSide,
    });
    const depth = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: tex,
      alphaTest: VEG_ALPHA_TEST,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.InstancedMesh(geo, material, def.itens.length);
    mesh.name = `veg-${def.tipo}`;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.customDepthMaterial = depth;
    mesh.frustumCulled = true;
    mesh.count = def.itens.length;
    grupo.add(mesh);

    const lote = {
      tipo: def.tipo,
      mesh,
      material,
      depth,
      textura: tex,
      img,
      itens: def.itens,
      largura,
      altura,
      pe: def.pe,
    };
    lotes.set(def.tipo, lote);
    return lote;
  }

  function escrever(yaw, recalcularLimites) {
    for (const lote of lotes.values()) {
      const { mesh, itens, largura, altura, pe } = lote;
      for (let i = 0; i < itens.length; i++) {
        const p = itens[i];
        const base = alturaEm(Math.floor(p.x), Math.floor(p.y));
        dummy.position.set(p.x, base - pe, p.y);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(largura, altura, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (recalcularLimites) {
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
      }
    }
  }

  function sincronizarVisivel() {
    let algum = false;
    for (const lote of lotes.values()) {
      if (lote.mesh.visible) algum = true;
    }
    grupo.visible = algum;
  }

  function aplicarAtlas(atlas) {
    for (let t = 0; t < CATALOGO.length; t++) {
      const def = CATALOGO[t];
      if (!def.itens.length) continue;
      const img = atlas?.[def.chave] || null;
      const lote = lotes.get(def.tipo);
      if (!img) {
        if (lote) lote.mesh.visible = false;
        continue;
      }
      if (lote && lote.img === img) {
        lote.mesh.visible = true;
        continue;
      }
      const novo = montarLote(def, img);
      novo.mesh.visible = true;
    }
    sincronizarVisivel();
    alturasSujas = true;
    if (grupo.visible && yawAplicado != null) {
      escrever(yawAplicado, true);
      alturasSujas = false;
    }
  }

  function reconstruir() {
    alturasSujas = true;
    if (!grupo.visible || yawAplicado == null) return;
    escrever(yawAplicado, true);
    alturasSujas = false;
  }

  function atualizar(yawCam) {
    if (!lotes.size) return;
    const yaw = Number.isFinite(yawCam) ? yawCam : 0;
    const mudouYaw = yawDiferente(yaw, yawAplicado);
    if (!mudouYaw && !alturasSujas) return;
    const recalcular = alturasSujas || yawAplicado == null;
    yawAplicado = yaw;
    alturasSujas = false;
    escrever(yaw, recalcular);
  }

  const cancelarDirty = onDirty((aabb) => {
    if (tocaProp(aabb)) alturasSujas = true;
  });

  return {
    grupo,
    aplicarAtlas,
    reconstruir,
    atualizar,
    liberar() {
      cancelarDirty();
      for (const lote of lotes.values()) soltarLote(lote);
      lotes.clear();
      geo.dispose();
    },
  };
}
