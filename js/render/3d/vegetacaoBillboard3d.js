import * as THREE from "three";
import { aplicarLuzBillboard, yawCartaoSol } from "./ceu/luzBillboard.js";
import { aplicarSombraNuvem } from "./ceu/sombraNuvem.js";
import {
  ALTURA_BLOCO,
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
import { todaVegetacao } from "../../mundo/bioma/propsBioma.js";
import { onDirty } from "../../mundo/voxel/storeMundo.js";

/**
 * Vegetação HD-2D: um InstancedMesh por sprite presente no stream.
 * Quad com pivô no pé e billboard só no yaw (o pitch não deita o sprite).
 */

const CAP_INSTANCIAS = 4096;

function estiloDe(prop) {
  if (prop.tipo === "arvore") return { escala: VEG_ARVORE_ESCALA, pe: VEG_ARVORE_PE };
  if (prop.tipo === "pedra" || prop.tipo === "cristal") return { escala: 1, pe: VEG_MATA_PE };
  return { escala: VEG_MATA_ESCALA, pe: VEG_MATA_PE };
}

function chaveDe(prop) {
  if (!prop || prop.tipo === "placa") return null;
  return prop.sprite || prop.tipo || null;
}

function recolherGrupos() {
  const grupos = new Map();
  function por(prop) {
    const chave = chaveDe(prop);
    if (!chave) return;
    let grupo = grupos.get(chave);
    if (!grupo) {
      const est = estiloDe(prop);
      grupo = {
        chave,
        amostra: prop,
        escala: est.escala,
        pe: est.pe,
        itens: [],
      };
      grupos.set(chave, grupo);
    }
    if (grupo.itens.length < CAP_INSTANCIAS) grupo.itens.push(prop);
  }
  for (let i = 0; i < PROPS.length; i++) por(PROPS[i]);
  const plantas = todaVegetacao();
  for (let i = 0; i < plantas.length; i++) por(plantas[i]);
  return grupos;
}

function medidasDe(img, escala) {
  const pw = img.naturalWidth || img.width || TILE;
  const ph = img.naturalHeight || img.height || TILE;
  return {
    largura: (pw / TILE) * escala,
    altura: (ph / TILE) * escala,
  };
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
  let atlasAtual = null;

  let yawAplicado = null;
  let yawSolAplicado = null;
  let alturasSujas = true;

  function imagemDe(prop) {
    if (!atlasAtual || !prop) return null;
    if (prop.sprite && atlasAtual.sprites?.[prop.sprite]) return atlasAtual.sprites[prop.sprite];
    if (prop.tipo === "arvore") return atlasAtual.arvore || null;
    if (prop.tipo === "mata" || prop.tipo === "grama") return atlasAtual.mata || null;
    return null;
  }

  function soltarLote(lote) {
    grupo.remove(lote.mesh);
    lote.mesh.dispatchEvent({ type: "dispose" });
    if (lote.sombra) {
      grupo.remove(lote.sombra);
      lote.sombra.dispatchEvent({ type: "dispose" });
    }
    lote.material.dispose();
    lote.matSombra?.dispose();
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
    const anterior = lotes.get(def.chave);
    if (anterior) soltarLote(anterior);

    const { largura, altura } = medidasDe(img, def.escala);
    const tex = criarTextura(img);
    const material = aplicarSombraNuvem(aplicarLuzBillboard(new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 1,
      metalness: 0,
      transparent: false,
      alphaTest: VEG_ALPHA_TEST,
      depthWrite: true,
      depthTest: true,
      side: THREE.FrontSide,
    })));
    const depth = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: tex,
      alphaTest: VEG_ALPHA_TEST,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.InstancedMesh(geo, material, CAP_INSTANCIAS);
    mesh.name = `veg-${def.chave}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;
    mesh.count = Math.min(def.itens.length, CAP_INSTANCIAS);
    grupo.add(mesh);

    const matSombra = new THREE.MeshBasicMaterial({
      map: tex,
      alphaTest: VEG_ALPHA_TEST,
      colorWrite: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    // O sol olha a face da frente. O padrão do Three só rasteriza a de trás.
    matSombra.shadowSide = THREE.DoubleSide;
    const sombra = new THREE.InstancedMesh(geo, matSombra, CAP_INSTANCIAS);
    sombra.name = `veg-sombra-${def.chave}`;
    sombra.castShadow = true;
    sombra.receiveShadow = false;
    sombra.customDepthMaterial = depth;
    sombra.frustumCulled = false;
    sombra.count = mesh.count;
    grupo.add(sombra);

    const lote = {
      chave: def.chave,
      mesh,
      sombra,
      material,
      matSombra,
      depth,
      textura: tex,
      img,
      itens: def.itens,
      largura,
      altura,
      pe: def.pe,
    };
    lotes.set(def.chave, lote);
    return lote;
  }

  function sincronizarLotes(grupos) {
    for (const def of grupos.values()) {
      const img = imagemDe(def.amostra);
      let lote = lotes.get(def.chave);
      if (!img) {
        if (lote) {
          lote.mesh.visible = false;
          if (lote.sombra) lote.sombra.visible = false;
        }
        continue;
      }
      if (!lote || lote.img !== img) lote = montarLote(def, img);
      const { largura, altura } = medidasDe(img, def.escala);
      lote.largura = largura;
      lote.altura = altura;
      lote.pe = def.pe;
      lote.itens = def.itens;
      lote.mesh.count = def.itens.length;
      lote.mesh.visible = def.itens.length > 0;
      if (lote.sombra) {
        lote.sombra.count = def.itens.length;
        lote.sombra.visible = def.itens.length > 0;
      }
    }
    for (const [chave, lote] of lotes) {
      if (grupos.has(chave)) continue;
      lote.itens = [];
      lote.mesh.count = 0;
      lote.mesh.visible = false;
      if (lote.sombra) {
        lote.sombra.count = 0;
        lote.sombra.visible = false;
      }
    }
  }

  function escreverMesh(mesh, itens, largura, altura, pe, yaw, limites) {
    if (!mesh) return;
    for (let i = 0; i < itens.length; i++) {
      const p = itens[i];
      const base = alturaEm(Math.floor(p.x), Math.floor(p.y));
      dummy.position.set(p.x, (base - pe) * ALTURA_BLOCO, p.y);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(largura, altura, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    if (itens.length) mesh.instanceMatrix.needsUpdate = true;
    if (limites && itens.length) {
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
    }
  }

  function escrever(yaw, yawSol, recalcularLimites) {
    if (recalcularLimites) sincronizarLotes(recolherGrupos());
    for (const lote of lotes.values()) {
      const { mesh, sombra, itens, largura, altura, pe } = lote;
      escreverMesh(mesh, itens, largura, altura, pe, yaw, recalcularLimites);
      escreverMesh(sombra, itens, largura, altura, pe, yawSol, recalcularLimites);
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
    atlasAtual = atlas;
    sincronizarLotes(recolherGrupos());
    sincronizarVisivel();
    alturasSujas = true;
    if (grupo.visible && yawAplicado != null) {
      escrever(yawAplicado, yawCartaoSol(), true);
      alturasSujas = false;
    }
  }

  function reconstruir() {
    alturasSujas = true;
    if (!grupo.visible || yawAplicado == null) return;
    escrever(yawAplicado, yawCartaoSol(), true);
    alturasSujas = false;
  }

  function atualizar(yawCam) {
    if (!atlasAtual) return;
    const yaw = Number.isFinite(yawCam) ? yawCam : 0;
    const mudouYaw = yawDiferente(yaw, yawAplicado);
    const yawSol = yawCartaoSol();
    const mudouSol = yawDiferente(yawSol, yawSolAplicado);
    if (!mudouYaw && !mudouSol && !alturasSujas) return;
    const recalcular = alturasSujas || yawAplicado == null;
    yawAplicado = yaw;
    yawSolAplicado = yawSol;
    alturasSujas = false;
    escrever(yaw, yawSol, recalcular);
    sincronizarVisivel();
  }

  const cancelarDirty = onDirty(() => {
    alturasSujas = true;
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
