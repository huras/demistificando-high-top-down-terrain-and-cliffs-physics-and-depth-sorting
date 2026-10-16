import * as THREE from "three";
import { aplicarLuzBillboard, yawCartaoSol } from "./ceu/luzBillboard.js";
import { aplicarSombraNuvem } from "./ceu/sombraNuvem.js";
import {
  ALTURA_BLOCO,
  TILE,
  VEG_ALPHA_TEST,
  VEG_ARVORE_ESCALA,
  VEG_MATA_ESCALA,
  VEG_YAW_EPS,
} from "../../config.js";
import { pivoDaImagem } from "../pivoPe.js";
import { alturaEm } from "../../mundo/altura.js";
import { PROPS } from "../../mundo/mapaDemo.js";
import { todaVegetacao } from "../../mundo/bioma/propsBioma.js";
import { registrarObjetoCena, removerObjetoCena, marcarAuxiliar } from "../../cena/registroCena.js";
import { usarRaycastBillboard } from "../../cena/selecaoCena.js";
import { onDirty } from "../../mundo/voxel/storeMundo.js";
import { STENCIL_GRAMA, marcarStencilSolido } from "./silhuetaSprite.js";
import { FASE } from "../../campo/estadoProps.js";
import { imagemToco } from "../../campo/visualToco.js";

/**
 * Vegetação HD-2D: um InstancedMesh por sprite presente no stream.
 * Quad com o primeiro pixel opaco da base na origem. O pé encosta no chão.
 * Yaw segue a câmera. Na terceira pessoa o cartão deita no X; na mira fica em pé.
 */

const CAP_INSTANCIAS = 4096;

function estiloDe(prop) {
  if (prop.tipo === "arvore") return VEG_ARVORE_ESCALA;
  if (prop.tipo === "pedra" || prop.tipo === "cristal") return 1;
  return VEG_MATA_ESCALA;
}

function chaveDe(prop) {
  if (!prop || prop.oculto || prop.tipo === "placa") return null;
  if (prop.fase === FASE.CAINDO || prop.fase === FASE.REMOVIDO) return null;
  if (prop.tipo === "arvore" && prop.fase === FASE.TOCO) return `toco:${prop.sprite || "arvore"}`;
  if (prop.tipo === "arvore" && prop.fase === FASE.TOCO_QUEIMADO) return `tocoq:${prop.sprite || "arvore"}`;
  return prop.sprite || prop.tipo || null;
}

function recolherGrupos() {
  const grupos = new Map();
  function por(prop) {
    const chave = chaveDe(prop);
    if (!chave) return;
    let grupo = grupos.get(chave);
    if (!grupo) {
      grupo = {
        chave,
        amostra: prop,
        escala: estiloDe(prop),
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

  const dummy = new THREE.Object3D();
  dummy.rotation.order = "YXZ";
  dummy.rotation.order = "YXZ";
  /** @type {Map<string, object>} */
  const lotes = new Map();
  let atlasAtual = null;

  let yawAplicado = null;
  let yawSolAplicado = null;
  let inclinacaoAplicada = 0;
  let alturasSujas = true;

  const corInst = new THREE.Color();

  function imagemBase(prop) {
    if (!atlasAtual || !prop) return null;
    if (prop.sprite && atlasAtual.sprites?.[prop.sprite]) return atlasAtual.sprites[prop.sprite];
    if (prop.tipo === "arvore") return atlasAtual.arvore || null;
    if (prop.tipo === "mata" || prop.tipo === "grama") return atlasAtual.mata || null;
    return null;
  }

  function imagemDe(prop) {
    const base = imagemBase(prop);
    if (!base) return null;
    if (prop.tipo === "arvore" && prop.fase === FASE.TOCO) return imagemToco(base, false);
    if (prop.tipo === "arvore" && prop.fase === FASE.TOCO_QUEIMADO) return imagemToco(base, true);
    return base;
  }

  function corDe(prop) {
    if (prop.tipo === "grama" && prop.fase === FASE.QUEIMANDO) {
      corInst.setRGB(1, 0.48, 0.16);
      return corInst;
    }
    if ((prop.tipo === "pedra" || prop.tipo === "cristal") && prop.hpMax > 0 && prop.hp < prop.hpMax - 1e-3) {
      const t = Math.max(0, Math.min(1, prop.hp / prop.hpMax));
      corInst.setRGB(0.42 + 0.58 * t, 0.34 + 0.66 * t, 0.3 + 0.7 * t);
      return corInst;
    }
    corInst.setRGB(1, 1, 1);
    return corInst;
  }

  function soltarLote(lote) {
    removerObjetoCena(lote.mesh?.userData?.cenaId);
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
    lote.geo?.dispose();
  }

/** Quad unitário com o pé opaco na origem. A escala não tira o pé do chão. */
  function geometriaNoPe(pivotX, pivotY) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0.5 - pivotX, pivotY - 0.5, 0);
    return geo;
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
    const grama = def.amostra?.tipo === "grama";
    const material = aplicarSombraNuvem(aplicarLuzBillboard(new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 1,
      metalness: 0,
      transparent: false,
      alphaTest: VEG_ALPHA_TEST,
      depthWrite: true,
      depthTest: true,
      side: THREE.FrontSide,
    })), { clareia: true });
    if (grama) {
      material.stencilWrite = true;
      material.stencilRef = STENCIL_GRAMA;
      material.stencilFunc = THREE.AlwaysStencilFunc;
      material.stencilFail = THREE.KeepStencilOp;
      material.stencilZFail = THREE.KeepStencilOp;
      material.stencilZPass = THREE.ReplaceStencilOp;
    } else if (def.amostra?.tipo === "arvore") {
      marcarStencilSolido(material);
    }
    const depth = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: tex,
      alphaTest: VEG_ALPHA_TEST,
      side: THREE.DoubleSide,
    });

    const pivo = pivoDaImagem(img);
    const geo = geometriaNoPe(pivo.x, pivo.y);
    const pivotY = pivo.y;
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
      geo,
      pivotY,
    };
    lotes.set(def.chave, lote);
    usarRaycastBillboard(mesh, () => lote);
    registrarObjetoCena(mesh, {
      id: mesh.name,
      pasta: "Vegetação",
      rotulo: mesh.name,
      tipo: "instâncias",
      obterInstancia: (i) => lote.itens[i] || null,
    });
    marcarAuxiliar(sombra);
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
      lote.pivotY = pivoDaImagem(img).y;
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

  function escreverMesh(mesh, itens, largura, altura, yaw, inclinacao, limites) {
    if (!mesh) return;
    for (let i = 0; i < itens.length; i++) {
      const p = itens[i];
      const base = alturaEm(Math.floor(p.x), Math.floor(p.y));
      dummy.position.set(p.x, base * ALTURA_BLOCO, p.y);
      dummy.rotation.set(inclinacao, yaw, 0);
      dummy.scale.set(largura, altura, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, corDe(p));
    }
    if (itens.length) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    if (limites && itens.length) {
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
    }
  }

  function escrever(yaw, yawSol, inclinacao, recalcularLimites) {
    if (recalcularLimites) sincronizarLotes(recolherGrupos());
    for (const lote of lotes.values()) {
      const { mesh, sombra, itens, largura, altura } = lote;
      escreverMesh(mesh, itens, largura, altura, yaw, inclinacao, recalcularLimites);
      escreverMesh(sombra, itens, largura, altura, yawSol, 0, recalcularLimites);
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
      escrever(yawAplicado, yawCartaoSol(), inclinacaoAplicada, true);
      alturasSujas = false;
    }
  }

  function reconstruir() {
    alturasSujas = true;
    if (!grupo.visible || yawAplicado == null) return;
    escrever(yawAplicado, yawCartaoSol(), inclinacaoAplicada, true);
    alturasSujas = false;
  }

  function atualizar(yawCam, inclinacao = 0) {
    if (!atlasAtual) return;
    const yaw = Number.isFinite(yawCam) ? yawCam : 0;
    const tilt = Number.isFinite(inclinacao) ? inclinacao : 0;
    const mudouYaw = yawDiferente(yaw, yawAplicado);
    const yawSol = yawCartaoSol();
    const mudouSol = yawDiferente(yawSol, yawSolAplicado);
    const mudouTilt = Math.abs(tilt - inclinacaoAplicada) > VEG_YAW_EPS;
    if (!mudouYaw && !mudouSol && !mudouTilt && !alturasSujas) return;
    const recalcular = alturasSujas || yawAplicado == null;
    yawAplicado = yaw;
    yawSolAplicado = yawSol;
    inclinacaoAplicada = tilt;
    alturasSujas = false;
    escrever(yaw, yawSol, tilt, recalcular);
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
    },
  };
}
