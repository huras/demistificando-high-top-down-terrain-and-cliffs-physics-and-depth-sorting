import * as THREE from "three";
import { aplicarLuzBillboard, yawCartaoSol } from "./ceu/luzBillboard.js";
import { marcarReflexo, soltarReflexo } from "./ceu/reflexoPoca.js";
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
import { alphaDoProp, tickFadeObstaculo } from "./fadeObstaculo3d.js";
import { FASE } from "../../campo/estadoProps.js";
import { imagemToco } from "../../campo/visualToco.js";
import { amostraSacudida, podarSacudidas, propsSacudindo, temSacudida } from "../../campo/sacudida.js";
import { ESCALA_ARBUSTO, garantirFolhaBerry, imagemArbusto, quadroArbusto } from "./folhaBerry.js";

/**
 * Vegetação HD-2D: um InstancedMesh por sprite presente no stream.
 * Quad com o primeiro pixel opaco da base na origem. O pé encosta no chão.
 * Yaw segue a câmera. Na terceira pessoa o cartão deita no X; na mira fica em pé.
 */

const CAP_INSTANCIAS = 4096;

function estiloDe(prop) {
  if (prop.tipo === "berry") return ESCALA_ARBUSTO;
  if (prop.tipo === "arvore") return VEG_ARVORE_ESCALA;
  if (prop.tipo === "pedra" || prop.tipo === "cristal") return 1;
  return VEG_MATA_ESCALA;
}

function chaveDe(prop) {
  if (!prop || prop.oculto || prop.tipo === "placa") return null;
  if (prop.fase === FASE.REMOVIDO) return null;
  if (prop.tipo === "arvore" && (prop.fase === FASE.TOCO || prop.fase === FASE.CAINDO)) return `toco:${prop.sprite || "arvore"}`;
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
  let geracaoLote = 0;
  let yawSolAplicado = null;
  let inclinacaoAplicada = 0;
  let alturasSujas = true;
  let quadroBerry = -1;

  const corInst = new THREE.Color();

  function imagemBase(prop) {
    if (!atlasAtual || !prop) return null;
    if (prop.sprite && atlasAtual.sprites?.[prop.sprite]) return atlasAtual.sprites[prop.sprite];
    if (prop.tipo === "arvore") return atlasAtual.arvore || null;
    if (prop.tipo === "mata" || prop.tipo === "grama") return atlasAtual.mata || null;
    return null;
  }

  function imagemDe(prop) {
    if (prop?.tipo === "berry") return imagemArbusto(prop.berryKey, prop.estagio || "maduro", 0);
    const base = imagemBase(prop);
    if (!base) return null;
    if (prop.tipo === "arvore" && (prop.fase === FASE.TOCO || prop.fase === FASE.CAINDO)) return imagemToco(base, false);
    if (prop.tipo === "arvore" && prop.fase === FASE.TOCO_QUEIMADO) return imagemToco(base, true);
    return base;
  }

  function ehLoteBerry(chave) {
    return typeof chave === "string" && chave.startsWith("berry:");
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
    soltarReflexo(lote.mesh);
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
    if (lote.texturasAnim) {
      const vistas = new Set();
      for (let i = 0; i < lote.texturasAnim.length; i++) {
        const t = lote.texturasAnim[i];
        if (!t || vistas.has(t)) continue;
        vistas.add(t);
        t.dispose();
      }
    } else {
      lote.textura.dispose();
    }
    lote.geo?.dispose();
  }

  function aplicarMapaBerry(lote, quadro) {
    if (!lote.texturasAnim) return;
    const tex = lote.texturasAnim[quadro & 1];
    if (!tex || lote.textura === tex) return;
    lote.textura = tex;
    lote.material.map = tex;
    lote.matSombra.map = tex;
    lote.depth.map = tex;
    lote.material.needsUpdate = true;
    lote.matSombra.needsUpdate = true;
    lote.depth.needsUpdate = true;
  }

  function sincronizarAnimBerry(agora) {
    const quadro = quadroArbusto(agora);
    if (quadro === quadroBerry) return false;
    quadroBerry = quadro;
    for (const lote of lotes.values()) {
      if (!ehLoteBerry(lote.chave)) continue;
      aplicarMapaBerry(lote, quadro);
    }
    return true;
  }

/** Quad unitário com o pé opaco na origem. A escala não tira o pé do chão. */
  function geometriaNoPe(pivotX, pivotY) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0.5 - pivotX, pivotY - 0.5, 0);
    return geo;
  }

  function aplicarAlfaInstancia(material) {
    const anterior = material.onBeforeCompile;
    const chaveAnterior = material.customProgramCacheKey;
    material.transparent = true;
    material.onBeforeCompile = (shader, renderer) => {
      if (anterior) anterior.call(material, shader, renderer);
      if (shader.vertexShader.includes("alfaPeca")) return;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute float alfaPeca;\nvarying float vAlfaPeca;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvAlfaPeca = alfaPeca;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vAlfaPeca;")
        .replace(
          "#include <opaque_fragment>",
          "#include <opaque_fragment>\ngl_FragColor.a *= vAlfaPeca;",
        );
    };
    material.customProgramCacheKey = function chaveAlfaPeca() {
      const base = typeof chaveAnterior === "function" ? chaveAnterior.call(this) : "";
      return `${base}|alfa-peca`;
    };
    return material;
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
    const berry = def.amostra?.tipo === "berry";
    let texturasAnim = null;
    let tex = criarTextura(img);
    if (berry) {
      const img1 = imagemArbusto(def.amostra.berryKey, def.amostra.estagio || "maduro", 1);
      texturasAnim = [tex, img1 ? criarTextura(img1) : tex];
      const quadro = quadroBerry >= 0 ? quadroBerry : quadroArbusto();
      tex = texturasAnim[quadro & 1];
    }
    const grama = def.amostra?.tipo === "grama" || def.amostra?.tipo === "mata";
    const material = aplicarSombraNuvem(aplicarLuzBillboard(new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 1,
      metalness: 0,
      transparent: !grama,
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
    } else {
      aplicarAlfaInstancia(material);
      if (def.amostra?.tipo === "arvore") marcarStencilSolido(material);
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
    let alfas = null;
    let attrAlfa = null;
    if (!grama) {
      alfas = new Float32Array(CAP_INSTANCIAS);
      alfas.fill(1);
      attrAlfa = new THREE.InstancedBufferAttribute(alfas, 1);
      geo.setAttribute("alfaPeca", attrAlfa);
    }
    const mesh = new THREE.InstancedMesh(geo, material, CAP_INSTANCIAS);
    mesh.name = `veg-${def.chave}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;
    mesh.count = Math.min(def.itens.length, CAP_INSTANCIAS);
    grupo.add(mesh);
    if (!grama) marcarReflexo(mesh);

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
      texturasAnim,
      img,
      itens: def.itens,
      largura,
      altura,
      geo,
      pivotY,
      grama,
      alfas,
      attrAlfa,
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

  function pose(p, largura, altura, yaw, inclinacao, amostra) {
    const base = alturaEm(Math.floor(p.x), Math.floor(p.y));
    const roll = amostra ? amostra.roll : 0;
    const esmaga = amostra ? amostra.esmaga : 0;
    dummy.position.set(p.x, base * ALTURA_BLOCO, p.y);
    dummy.rotation.set(inclinacao, yaw, roll);
    dummy.scale.set(largura * (1 + esmaga * 0.03), altura * (1 - esmaga * 0.045), 1);
    dummy.updateMatrix();
  }

  function escreverAlfas(lote) {
    if (!lote || lote.grama || !lote.alfas || !lote.attrAlfa) return;
    const { itens, alfas, attrAlfa } = lote;
    let mudou = false;
    for (let i = 0; i < itens.length; i++) {
      const a = alphaDoProp(itens[i]);
      if (alfas[i] !== a) {
        alfas[i] = a;
        mudou = true;
      }
    }
    if (mudou) attrAlfa.needsUpdate = true;
  }

  function escreverMesh(mesh, itens, largura, altura, yaw, inclinacao, limites, agora) {
    if (!mesh) return;
    for (let i = 0; i < itens.length; i++) {
      const p = itens[i];
      pose(p, largura, altura, yaw, inclinacao, amostraSacudida(p, agora));
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

  function lembrar(p, itens, mesh, sombra, i, largura, altura) {
    let v = p._veg;
    if (!v) v = p._veg = { itens: null, mesh: null, sombra: null, i: -1, largura: 0, altura: 0, geracao: -1 };
    v.itens = itens;
    v.mesh = mesh;
    v.sombra = sombra;
    v.i = i;
    v.largura = largura;
    v.altura = altura;
    v.geracao = geracaoLote;
  }

  function escrever(yaw, yawSol, inclinacao, recalcularLimites) {
    const agora = performance.now();
    if (recalcularLimites) {
      sincronizarLotes(recolherGrupos());
      geracaoLote += 1;
    }
    const sacode = temSacudida();
    for (const lote of lotes.values()) {
      const { mesh, sombra, itens, largura, altura } = lote;
      escreverMesh(mesh, itens, largura, altura, yaw, inclinacao, recalcularLimites, agora);
      escreverMesh(sombra, itens, largura, altura, yawSol, 0, false, agora);
      if (!sacode) continue;
      for (let i = 0; i < itens.length; i++) {
        const p = itens[i];
        if (p._sacode) lembrar(p, itens, mesh, sombra, i, largura, altura);
      }
    }
  }

  const malhasSujas = [];

  function marcarSuja(mesh) {
    if (!mesh || malhasSujas.includes(mesh)) return;
    malhasSujas.push(mesh);
  }

  function aplicarVinculo(v, p, yaw, yawSol, inclinacao, amostra) {
    if (!v || v.geracao !== geracaoLote || v.i < 0 || !v.mesh || v.itens?.[v.i] !== p) return;
    if (p.fase === FASE.CAINDO || p.fase === FASE.REMOVIDO || p.oculto) return;
    pose(p, v.largura, v.altura, yaw, inclinacao, amostra);
    v.mesh.setMatrixAt(v.i, dummy.matrix);
    marcarSuja(v.mesh);
    if (!v.sombra) return;
    pose(p, v.largura, v.altura, yawSol, 0, amostra);
    v.sombra.setMatrixAt(v.i, dummy.matrix);
    marcarSuja(v.sombra);
  }

  function pulsarSacudidas(yaw, yawSol, inclinacao, agora, acabaram) {
    malhasSujas.length = 0;
    const vivas = propsSacudindo();
    for (let i = 0; i < vivas.length; i++) {
      const p = vivas[i];
      aplicarVinculo(p._veg, p, yaw, yawSol, inclinacao, amostraSacudida(p, agora));
    }
    for (let i = 0; i < acabaram.length; i++) {
      const p = acabaram[i];
      aplicarVinculo(p._veg, p, yaw, yawSol, inclinacao, null);
    }
    for (let i = 0; i < malhasSujas.length; i++) malhasSujas[i].instanceMatrix.needsUpdate = true;
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
    const agora = performance.now();
    const animou = sincronizarAnimBerry(agora);
    const acabaram = podarSacudidas(agora);
    const sacode = temSacudida() || acabaram.length > 0;
    const primeira = yawAplicado == null;
    if (!mudouYaw && !mudouSol && !mudouTilt && !alturasSujas && !sacode && !primeira && !animou) return;
    yawAplicado = yaw;
    yawSolAplicado = yawSol;
    inclinacaoAplicada = tilt;
    if (mudouYaw || mudouSol || mudouTilt || alturasSujas || primeira) {
      const recalcular = alturasSujas || primeira;
      alturasSujas = false;
      escrever(yaw, yawSol, tilt, recalcular);
      sincronizarVisivel();
      return;
    }
    if (sacode) pulsarSacudidas(yaw, yawSol, tilt, agora, acabaram);
  }

  /** Fade de obstáculo: roda todo frame, independente do yaw. */
  function tickFade(foco, dt, camera) {
    tickFadeObstaculo(foco, dt, camera);
    for (const lote of lotes.values()) escreverAlfas(lote);
  }

  const cancelarDirty = onDirty(() => {
    alturasSujas = true;
  });
  garantirFolhaBerry(() => {
    alturasSujas = true;
  });

  return {
    grupo,
    aplicarAtlas,
    reconstruir,
    atualizar,
    tickFade,
    liberar() {
      cancelarDirty();
      for (const lote of lotes.values()) soltarLote(lote);
      lotes.clear();
    },
  };
}
