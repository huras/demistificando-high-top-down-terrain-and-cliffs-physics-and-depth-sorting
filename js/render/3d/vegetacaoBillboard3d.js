import * as THREE from "three";
import { aplicarLuzBillboard, yawCartaoSol } from "./ceu/luzBillboard.js";
import { marcarReflexo, soltarReflexo } from "./ceu/reflexoPoca.js";
import { aplicarSombraNuvem } from "./ceu/sombraNuvem.js";
import { aplicarVentoVeg } from "./vegetacao/ventoVeg.js";
import {
  ALTURA_BLOCO,
  CHUNK_XZ,
  TILE,
  VEG_ALPHA_TEST,
  VEG_CRISTAL_OPACIDADE,
  VEG_ARVORE_ESCALA,
  VEG_MATA_ESCALA,
  VEG_YAW_EPS,
} from "../../config.js";
import { geometriaNoPe, poseCartao, pivoDoProp, carregarPivosProps } from "./billboard/indice.js";
import { alturaEm } from "../../mundo/altura.js";
import { PROPS } from "../../mundo/mapaDemo.js";
import { visitarVegetacaoNaArea } from "../../mundo/bioma/propsBioma.js";
import { registrarObjetoCena, removerObjetoCena, marcarAuxiliar } from "../../cena/registroCena.js";
import { usarRaycastBillboard } from "../../cena/selecaoCena.js";
import { obterRaioStream, onDirty } from "../../mundo/voxel/storeMundo.js";
import { STENCIL_GRAMA, marcarStencilSolido } from "./silhuetaSprite.js";
import { FASE } from "../../campo/estadoProps.js";
import { imagemToco } from "../../campo/visualToco.js";
import { amostraSacudida, podarSacudidas, propsSacudindo, temSacudida } from "../../campo/sacudida.js";
import { ESCALA_ARBUSTO, garantirFolhaBerry, imagemArbusto, quadroArbusto } from "./folhaBerry.js";
import { ensureShrineArtLoaded, imagemSantuario } from "../../santuario/arte.js";
import { SHRINE_DRAW_SCALE } from "../../santuario/catalogo.js";
import { imagemDoPropSite } from "../../mundo/sites/atlas.js";
import {
  obterCarry,
  obterGrabAction,
  obterThrown,
} from "../../forca/sistemaForca.js";
import { amostrarMotionFalha, ehFalhaGrab } from "../../forca/falhaLevantar.js";

/**
 * Vegetação HD-2D: um InstancedMesh por sprite presente no stream.
 * Quad com o primeiro pixel opaco da base na origem. O pé encosta no chão.
 * Yaw segue a câmera. Na terceira pessoa o cartão deita no X; na mira fica em pé.
 */

const CAP_INSTANCIAS = 4096;

function estiloDe(prop) {
  if (prop.tipo === "santuario") return SHRINE_DRAW_SCALE;
  if (prop.tipo === "berry") return ESCALA_ARBUSTO;
  if (prop.tipo === "site") {
    // Lápide 1×2 tiles — escala 1; resto do yard um pouco maior.
    if (prop.kind === "lapide" || String(prop.propId || "").startsWith("lapide")) {
      return 1;
    }
    return 1.15;
  }
  if (prop.tipo === "arvore") return VEG_ARVORE_ESCALA;
  if (prop.tipo === "pedra" || prop.tipo === "cristal") return 1;
  return VEG_MATA_ESCALA;
}

function chaveDe(prop) {
  // forcaCarregado continua renderizando (anexo na cabeça / arremesso).
  if (!prop || prop.oculto || prop.ocultoBillboard || prop.tipo === "placa") return null;
  if (prop.tipo === "siteCasa") return null;
  if (prop.fase === FASE.REMOVIDO) return null;
  if (prop.tipo === "site") return `site:${prop.propId || prop.sprite || "prop"}`;
  if (prop.tipo === "arvore" && (prop.fase === FASE.TOCO || prop.fase === FASE.CAINDO)) return `toco:${prop.sprite || "arvore"}`;
  if (prop.tipo === "arvore" && prop.fase === FASE.TOCO_QUEIMADO) return `tocoq:${prop.sprite || "arvore"}`;
  return prop.sprite || prop.tipo || null;
}

/** Raio de desenho near = disco do stream (props só existem nos chunks carregados). */
function raioDesenhoVeg() {
  return Math.max(1, obterRaioStream() | 0) * CHUNK_XZ;
}

function recolherGrupos(px = 0, py = 0) {
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
  const r = raioDesenhoVeg();
  const r2 = r * r;
  for (let i = 0; i < PROPS.length; i++) {
    const p = PROPS[i];
    const dx = p.x - px;
    const dy = p.y - py;
    if (dx * dx + dy * dy <= r2) por(p);
  }
  visitarVegetacaoNaArea(px - r, py - r, px + r, py + r, (p) => {
    const dx = p.x - px;
    const dy = p.y - py;
    if (dx * dx + dy * dy <= r2) por(p);
  });
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
  /** @type {Map<string, object>} */
  const lotes = new Map();
  let atlasAtual = null;
  carregarPivosProps().then(() => {
    alturasSujas = true;
  });

  let yawAplicado = null;
  let geracaoLote = 0;
  let yawSolAplicado = null;
  let inclinacaoAplicada = 0;
  let alturasSujas = true;
  /** Coalesce dirty de stream — evita sync+rewrite todo frame ao andar. */
  let proximoRecalcMs = 0;
  const RECALC_MIN_MS = 100;
  /** Yaw-only: no máximo ~8 Hz — 20 ms/frame em 600 cartões era o FPS. */
  let proximoYawMs = 0;
  const YAW_MIN_MS = 120;
  let focoX = 0;
  let focoY = 0;
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
    if (prop?.tipo === "santuario") {
      ensureShrineArtLoaded();
      return imagemSantuario(prop.atlasCol ?? 0);
    }
    if (prop?.tipo === "berry") return imagemArbusto(prop.berryKey, prop.estagio || "maduro", 0);
    if (prop?.tipo === "site") return imagemDoPropSite(prop.propId || prop.sprite);
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
    if (prop.tipo === "santuario" && !prop.cleared) {
      corInst.setRGB(1.15, 1.1, 1.25);
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
    const cristal = def.amostra?.tipo === "cristal";
    const toco = typeof def.chave === "string" && def.chave.startsWith("toco");
    const perfilVento = grama ? "mata" : def.amostra?.tipo === "arvore" && !toco ? "arvore" : null;
    let material = aplicarSombraNuvem(aplicarLuzBillboard(new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 1,
      metalness: 0,
      transparent: cristal,
      opacity: cristal ? VEG_CRISTAL_OPACIDADE : 1,
      alphaTest: VEG_ALPHA_TEST,
      depthWrite: true,
      depthTest: true,
      side: THREE.FrontSide,
    })), { clareia: true });
    if (perfilVento) material = aplicarVentoVeg(material, perfilVento);
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
    let depth = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: tex,
      alphaTest: VEG_ALPHA_TEST,
      side: THREE.DoubleSide,
    });
    if (perfilVento) depth = aplicarVentoVeg(depth, perfilVento);

    const pivo = pivoDoProp(img, def.chave);
    const geo = geometriaNoPe(pivo.x, pivo.y);
    const pivotX = pivo.x;
    const pivotY = pivo.y;
    const opacoY = Number.isFinite(pivo.opacoY) ? pivo.opacoY : 1;
    const dz = pivo.dz || 0;
    const mesh = new THREE.InstancedMesh(geo, material, CAP_INSTANCIAS);
    mesh.name = `veg-${def.chave}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;
    mesh.count = Math.min(def.itens.length, CAP_INSTANCIAS);
    grupo.add(mesh);
    if (!grama) marcarReflexo(mesh);

    let matSombra = new THREE.MeshBasicMaterial({
      map: tex,
      alphaTest: VEG_ALPHA_TEST,
      colorWrite: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    if (perfilVento) matSombra = aplicarVentoVeg(matSombra, perfilVento);
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
      pivotX,
      pivotY,
      opacoY,
      dz,
      grama,
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

  /** Pivot e geo precisam bater — senão o lift sobe o card e o pé fica no ar. */
  function casarPivoLote(lote, img, chave) {
    const pivo = pivoDoProp(img, chave);
    const px = pivo.x;
    const py = pivo.y;
    lote.opacoY = Number.isFinite(pivo.opacoY) ? pivo.opacoY : 1;
    lote.dz = pivo.dz || 0;
    if (lote.pivotX === px && lote.pivotY === py) return;
    lote.pivotX = px;
    lote.pivotY = py;
    const geo = geometriaNoPe(px, py);
    const velha = lote.geo;
    lote.geo = geo;
    lote.mesh.geometry = geo;
    if (lote.sombra) lote.sombra.geometry = geo;
    if (velha && velha !== geo) velha.dispose();
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
      casarPivoLote(lote, img, def.chave);
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

  function pose(p, largura, altura, yaw, inclinacao, amostra, pivotY, dz, opacoY, refrescarAltura) {
    const grab = obterGrabAction();
    // Carry / lift / arremesso: usa z anexado (cabeça / voo), não o solo da célula.
    const anexado =
      !!(p.forcaCarregado || (grab && grab.prop === p)) && Number.isFinite(p.z);
    let base;
    if (anexado) {
      base = p.z;
    } else if (!refrescarAltura && p._veg && Number.isFinite(p._veg.baseY)) {
      base = p._veg.baseY;
    } else {
      base = alturaEm(Math.floor(p.x), Math.floor(p.y));
      if (p._veg) p._veg.baseY = base;
    }
    const roll = amostra ? amostra.roll : 0;
    const esmaga = amostra ? amostra.esmaga : 0;
    let px = p.x;
    let pz = p.y;
    let lift = 0;
    let rollForca = 0;
    if (ehFalhaGrab(grab) && grab.prop === p) {
      const m = amostrarMotionFalha(grab);
      px += m.shakeX;
      pz += m.shakeY;
      lift = m.lift * ALTURA_BLOCO;
      rollForca = m.shakeX * 1.8;
    }
    poseCartao(dummy, {
      x: px,
      y: base * ALTURA_BLOCO + lift,
      z: pz,
      largura: largura * (1 + esmaga * 0.03),
      altura: altura * (1 - esmaga * 0.045),
      yaw,
      inclinacao,
      roll: roll + rollForca,
      pivotY,
      opacoY,
      dz,
      elevado: true,
    });
  }

  function escreverMesh(mesh, itens, largura, altura, yaw, inclinacao, limites, agora, pivotY, dz, opacoY, refrescarAltura) {
    if (!mesh) return;
    for (let i = 0; i < itens.length; i++) {
      const p = itens[i];
      pose(p, largura, altura, yaw, inclinacao, amostraSacudida(p, agora), pivotY, dz, opacoY, refrescarAltura);
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

  function lembrar(p, itens, mesh, sombra, i, largura, altura, pivotY, dz, opacoY) {
    let v = p._veg;
    if (!v) v = p._veg = { itens: null, mesh: null, sombra: null, i: -1, largura: 0, altura: 0, geracao: -1 };
    v.itens = itens;
    v.mesh = mesh;
    v.sombra = sombra;
    v.i = i;
    v.largura = largura;
    v.altura = altura;
    v.pivotY = pivotY;
    v.opacoY = opacoY;
    v.dz = dz;
    v.geracao = geracaoLote;
  }

  function escrever(yaw, yawSol, inclinacao, recalcularLimites, opts = {}) {
    const agora = performance.now();
    if (recalcularLimites) {
      sincronizarLotes(recolherGrupos(focoX, focoY));
      geracaoLote += 1;
    }
    const grab = obterGrabAction();
    const carry = obterCarry();
    const refrescarAltura = !!recalcularLimites;
    const escreverSombra = opts.escreverSombra !== false;
    for (const lote of lotes.values()) {
      const { mesh, sombra, itens, largura, altura, pivotY, dz, opacoY } = lote;
      const pe = Number.isFinite(opacoY) ? opacoY : 1;
      escreverMesh(mesh, itens, largura, altura, yaw, inclinacao, recalcularLimites, agora, pivotY, dz, pe, refrescarAltura);
      if (escreverSombra) {
        escreverMesh(sombra, itens, largura, altura, yawSol, 0, false, agora, pivotY, dz, pe, refrescarAltura);
      }
      for (let i = 0; i < itens.length; i++) {
        const p = itens[i];
        if (
          p._sacode ||
          p.forcaCarregado ||
          (grab && grab.prop === p) ||
          (carry && carry.prop === p)
        ) {
          lembrar(p, itens, mesh, sombra, i, largura, altura, pivotY, dz, pe);
        }
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
    const pe = Number.isFinite(v.opacoY) ? v.opacoY : 1;
    pose(p, v.largura, v.altura, yaw, inclinacao, amostra, v.pivotY, v.dz, pe);
    v.mesh.setMatrixAt(v.i, dummy.matrix);
    marcarSuja(v.mesh);
    if (!v.sombra) return;
    pose(p, v.largura, v.altura, yawSol, 0, amostra, v.pivotY, v.dz, pe);
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
    // Força: lift / carry / arremesso — matriz todo frame (senão a pedra fica no chão).
    const grab = obterGrabAction();
    if (grab?.prop) {
      aplicarVinculo(grab.prop._veg, grab.prop, yaw, yawSol, inclinacao, null);
    }
    const carry = obterCarry();
    if (carry?.prop) {
      aplicarVinculo(carry.prop._veg, carry.prop, yaw, yawSol, inclinacao, null);
    }
    const voos = obterThrown();
    for (let i = 0; i < (voos?.length || 0); i++) {
      const prop = voos[i]?.carry?.prop;
      if (prop) aplicarVinculo(prop._veg, prop, yaw, yawSol, inclinacao, null);
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
    sincronizarLotes(recolherGrupos(focoX, focoY));
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

  function atualizar(yawCam, inclinacao = 0, px = null, py = null) {
    if (!atlasAtual) return;
    if (Number.isFinite(px) && Number.isFinite(py)) {
      const dx = px - focoX;
      const dy = py - focoY;
      if (dx * dx + dy * dy > 36) alturasSujas = true;
      focoX = px;
      focoY = py;
    }
    const yaw = Number.isFinite(yawCam) ? yawCam : 0;
    const tilt = Number.isFinite(inclinacao) ? inclinacao : 0;
    const mudouYaw = yawDiferente(yaw, yawAplicado);
    const yawSol = yawCartaoSol();
    const mudouSol = yawDiferente(yawSol, yawSolAplicado);
    const mudouTilt = Math.abs(tilt - inclinacaoAplicada) > VEG_YAW_EPS;
    const agora = performance.now();
    const animou = sincronizarAnimBerry(agora);
    const acabaram = podarSacudidas(agora);
    const grab = obterGrabAction();
    const carry = obterCarry();
    const voos = obterThrown();
    const anexoForca =
      !!grab?.prop ||
      !!carry?.prop ||
      !!(voos && voos.some((v) => v?.carry?.prop));
    const sacode = temSacudida() || acabaram.length > 0;
    const primeira = yawAplicado == null;
    // Carry/lift/arremesso: reescreve matrizes todo frame (coords do prop mudam).
    // Pulse sozinho falha: _veg só era lembrado em props com _sacode.
    if (anexoForca) {
      yawAplicado = yaw;
      yawSolAplicado = yawSol;
      inclinacaoAplicada = tilt;
      const podeRecalc = alturasSujas && (primeira || agora >= proximoRecalcMs);
      const recalcular = podeRecalc || primeira;
      if (podeRecalc) {
        alturasSujas = false;
        proximoRecalcMs = agora + RECALC_MIN_MS;
      }
      escrever(yaw, yawSol, tilt, recalcular, { escreverSombra: true });
      sincronizarVisivel();
      if (sacode || acabaram.length > 0) {
        pulsarSacudidas(yaw, yawSol, tilt, agora, acabaram);
      }
      return;
    }
    const podeRecalc = alturasSujas && (primeira || agora >= proximoRecalcMs);
    const yawDue = mudouYaw && agora >= proximoYawMs;
    const precisaEscrever =
      podeRecalc || primeira || mudouSol || mudouTilt || yawDue || sacode;
    if (!precisaEscrever && !animou) return;

    if (precisaEscrever) {
      yawAplicado = yaw;
      yawSolAplicado = yawSol;
      inclinacaoAplicada = tilt;
      const recalcular = podeRecalc || primeira;
      if (podeRecalc) {
        alturasSujas = false;
        proximoRecalcMs = agora + RECALC_MIN_MS;
      }
      if (yawDue || primeira || recalcular) proximoYawMs = agora + YAW_MIN_MS;
      // Yaw da câmera sozinho: não reescreve sombra (sol quase parado).
      escrever(yaw, yawSol, tilt, recalcular, {
        escreverSombra: mudouSol || recalcular || primeira,
      });
      sincronizarVisivel();
      if (sacode) pulsarSacudidas(yaw, yawSol, tilt, agora, acabaram);
    }
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
    liberar() {
      cancelarDirty();
      for (const lote of lotes.values()) soltarLote(lote);
      lotes.clear();
    },
  };
}
