import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CHUNK_XZ, TILE } from "../../config.js";
import { obterRaioStream } from "../../mundo/voxel/storeMundo.js";
import { deLocalKanto } from "../../mundo/bounds.js";
import { CIDADES_KANTO } from "../../mundo/regiao/kantoCidades.js";
import { AREA_KANTO } from "../../mundo/regiao/grafoKanto.js";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { postesDeRua } from "../../mundo/regiao/decoracaoKanto.js";
import { montarLayout, pegadaDoPapel } from "../../mundo/regiao/volumesCidade.js";
import { yawDoEdificio } from "../../mundo/cidade/orientacaoEdificio.js";
import { carregarCatalogoLuzes, pontosDoModelo } from "./luzes/catalogo.js";
import { criarCartaoLuz, obterPesoNoite } from "./luzes/pool.js";
import { aplicarLuzCidade, oferecerLuzChao } from "./luzes/mapaChao.js";
import {
  atualizarRoletaJanela,
  brilhoDaInstancia,
  comecarQuadroJanelas,
  ehMaterialJanela,
  materialDaJanela,
  prepararRoletaJanela,
} from "./luzes/janelasCasa.js";
import { aplicarLuzBillboard, aplicarProfundidadeVolume } from "./ceu/luzBillboard.js";
import { marcarReflexo } from "./ceu/reflexoPoca.js";
import { geometriaNoPe } from "./billboard/indice.js";
import { pivoDaImagem } from "../pivoPe.js";
import { idsVisuais, origemDoModelo, urlDoModelo } from "../../mundo/cidade/catalogoCasas.js";
import { anexarCascaSala, anexarDecoracaoCidade, anexarInteriores, carregarSpritesPraca, criarDecoracaoRotas } from "./decoracaoCidade.js";
import { atualizarLaboratorio, montarLaboratorio3d } from "./laboratorio3d.js";
import { atualizarCentro, montarCentro3d } from "./centro3d.js";
import { montarLoja3d } from "./loja3d.js";
import { montarGinasio3d } from "./ginasio3d.js";
import { montarMansao3d } from "./mansao3d.js";
import { montarCondominio3d } from "./condominio3d.js";
import { carregarSpritesPredio, chaveSpritePredio, criarSpritePredio, montarUsina } from "./prediosSprite.js";
import { aplicarEscalaCasa, aplicarEscalaProp, aplicarFatorYCasa } from "./escalaVertical.js";
import { atualizarParedesDual } from "./paredeInteriorDual.js";

const FOLGA = 0.96;
const LADO_X = 6;
const LADO_Z = 5;
const ALFA_SPRITE = 0.12;
const FOLHAS_CASA = 5;
const PX_MUNDO = 1 / TILE;
const ALTURA_POSTE = 3.6;
/** Folga no espaço do pai do molde: evita z-fight do chão/kage com o terreno. */
const LIFT_KAGE = 0.04;
const _ponto = new THREE.Vector3();
let materialFlare = null;
let materialGlobo = null;

function materialDoFlare(mapa) {
  if (materialFlare) {
    if (mapa && materialFlare.map !== mapa) mapa.dispose?.();
    return materialFlare;
  }
  if (mapa) {
    mapa.colorSpace = THREE.SRGBColorSpace;
    mapa.magFilter = THREE.LinearFilter;
    mapa.minFilter = THREE.LinearMipmapLinearFilter;
    mapa.generateMipmaps = true;
    mapa.wrapS = THREE.ClampToEdgeWrapping;
    mapa.wrapT = THREE.ClampToEdgeWrapping;
    mapa.needsUpdate = true;
  }
  materialFlare = new THREE.MeshBasicMaterial({
    name: "tkwa_sl3",
    map: mapa || null,
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  materialFlare.addEventListener("dispose", () => {
    materialFlare = null;
  });
  return materialFlare;
}

function materialDoGlobo(mapa) {
  if (materialGlobo) {
    if (mapa && materialGlobo.map !== mapa) mapa.dispose?.();
    return materialGlobo;
  }
  if (mapa) {
    mapa.colorSpace = THREE.SRGBColorSpace;
    mapa.magFilter = THREE.NearestFilter;
    mapa.minFilter = THREE.NearestFilter;
    mapa.generateMipmaps = false;
    mapa.needsUpdate = true;
  }
  materialGlobo = new THREE.MeshLambertMaterial({
    name: "tkwa_sl2l",
    map: mapa || null,
    color: 0xffffff,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    side: THREE.DoubleSide,
    emissive: 0xfff1c4,
    emissiveMap: mapa || null,
    emissiveIntensity: 0,
  });
  materialGlobo.addEventListener("dispose", () => {
    materialGlobo = null;
  });
  aplicarLuzCidade(materialGlobo);
  return materialGlobo;
}

export const MODELOS_CIDADE = idsVisuais();

/**
 * Blender costuma exportar map_Kd/map_d com path absoluto do Windows.
 * No browser isso quebra a textura; map_d falho deixa o mesh transparente.
 */
function sanitizarMtl(texto) {
  return String(texto || "")
    .split(/\r?\n/)
    .map((linha) => {
      const m = linha.match(/^(map_\w+)\s+(.+)$/i);
      if (!m) return linha;
      if (/^map_d$/i.test(m[1])) return "";
      let path = m[2].trim().replace(/^"(.*)"$/, "$1");
      if (/^[a-zA-Z]:[\\/]/.test(path) || path.includes("\\\\") || /^[\\/]/.test(path)) {
        path = path.split(/[/\\]/).pop() || path;
      }
      return `${m[1]} ${path}`;
    })
    .filter((l) => l.length > 0)
    .join("\n");
}

function carregarGltf(url) {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(
      url,
      (gltf) => resolve(gltf.scene || gltf.scenes?.[0]),
      undefined,
      reject
    );
  });
}

function carregarObj(id) {
  const origem = origemDoModelo(id);
  const base = origem ? urlDoModelo(origem.base) : `assets/models/cidade/${id}/`;
  const arquivo = origem?.arquivo || "modelo.obj";
  const urlArq = `${base}${urlDoModelo(arquivo)}`;

  if (/\.glb$/i.test(arquivo) || /\.gltf$/i.test(arquivo)) {
    return carregarGltf(urlArq);
  }

  const mtl = arquivo.replace(/\.obj$/i, ".mtl");
  const urlMtl = `${base}${urlDoModelo(mtl)}`;

  return fetch(urlMtl)
    .then((res) => {
      if (!res.ok) throw new Error(`mtl ${res.status}`);
      return res.text();
    })
    .then((texto) => {
      const mats = new MTLLoader();
      mats.setResourcePath(base);
      const pronto = mats.parse(sanitizarMtl(texto), base);
      pronto.preload();
      return new Promise((resolve, reject) => {
        const obj = new OBJLoader();
        obj.setMaterials(pronto);
        obj.load(urlArq, resolve, undefined, reject);
      });
    });
}

function consertarNormais(geo) {
  const normal = geo.getAttribute("normal");
  if (!normal) {
    geo.computeVertexNormals();
    return;
  }
  const arr = normal.array;
  for (let i = 0; i < arr.length; i++) {
    if (Number.isFinite(arr[i])) continue;
    geo.computeVertexNormals();
    return;
  }
}

function nomeDoMesh(filho) {
  const mat = filho?.material;
  const doMat = Array.isArray(mat) ? mat[0]?.name : mat?.name;
  return String(doMat || filho?.name || "").toLowerCase();
}

function ehKage(nome) {
  return nome.includes("kage") || nome.includes("shade");
}

function ajustarMaterial(mat) {
  const lista = Array.isArray(mat) ? mat : [mat];
  for (let i = 0; i < lista.length; i++) {
    const m = lista[i];
    if (!m) continue;
    const novo = new THREE.MeshLambertMaterial({
      name: m.name || "",
      map: m.map || null,
      color: 0xffffff,
      alphaTest: 0.2,
      side: THREE.FrontSide,
    });
    if (novo.map) {
      novo.map.colorSpace = THREE.SRGBColorSpace;
      novo.map.magFilter = THREE.NearestFilter;
      novo.map.minFilter = THREE.NearestFilter;
      novo.map.generateMipmaps = false;
      novo.map.needsUpdate = true;
    }
    lista[i] = novo;
    aplicarLuzCidade(novo);
    m.dispose();
  }
  return Array.isArray(mat) ? lista : lista[0];
}

function partirMultiMaterial(mesh) {
  const mats = mesh.material;
  if (!Array.isArray(mats) || !mesh.geometry?.groups?.length || !mesh.parent) return;
  const geo = mesh.geometry;
  const grupos = geo.groups;
  for (let i = 0; i < grupos.length; i++) {
    const grupo = grupos[i];
    const mat = mats[grupo.materialIndex];
    if (!mat) continue;
    const parteGeo = geo.clone();
    parteGeo.clearGroups();
    parteGeo.setDrawRange(grupo.start, grupo.count);
    const parte = new THREE.Mesh(parteGeo, mat);
    parte.name = mat.name || mesh.name;
    parte.position.copy(mesh.position);
    parte.quaternion.copy(mesh.quaternion);
    parte.scale.copy(mesh.scale);
    mesh.parent.add(parte);
  }
  mesh.parent.remove(mesh);
  geo.dispose();
}

function marcarVolume(raiz, yChao) {
  const amostra = new THREE.Vector3();
  raiz.traverse((filho) => {
    if (!filho.isMesh || !filho.visible || !filho.material) return;
    if (filho.renderOrder >= 2) return;
    const mat = filho.material;
    if (mat.depthWrite === false) mat.depthWrite = true;
    amostra.set(0, yChao, 0);
    filho.worldToLocal(amostra);
    aplicarProfundidadeVolume(mat, amostra.y);
  });
}

/**
 * Sobe o molde um pouco no espaço do pai (depois da escala XZ/Y).
 * Compensa o scale local pra LIFT_KAGE ficar estável em todas as casas.
 */
function aplicarFolgaKage(grupo) {
  if (!grupo?.userData?.temKage) return;
  const raiz = grupo.children[0];
  if (!raiz) return;
  const sy = Math.abs(grupo.scale.y) > 1e-8 ? grupo.scale.y : 1;
  raiz.position.y += LIFT_KAGE / sy;
}

function preparar(raiz, volume) {
  const multi = [];
  raiz.traverse((filho) => {
    if (filho.isMesh && Array.isArray(filho.material)) multi.push(filho);
  });
  for (let i = 0; i < multi.length; i++) partirMultiMaterial(multi[i]);
  /** h_kage / shade = blob de sombra baked no OBJ: remove, não só esconde (bbox). */
  const lixoKage = [];
  raiz.traverse((filho) => {
    if (!filho.isMesh) return;
    const nome = nomeDoMesh(filho);
    if (ehKage(nome)) {
      lixoKage.push(filho);
      return;
    }
    if (nome === "tkwa_sl3") {
      const mapa = filho.material?.map || null;
      filho.material?.dispose?.();
      filho.material = materialDoFlare(mapa);
      filho.castShadow = false;
      filho.receiveShadow = false;
      filho.renderOrder = 2;
      return;
    }
    if (ehMaterialJanela(nome)) {
      const mapa = filho.material?.map || null;
      filho.material?.dispose?.();
      filho.material = materialDaJanela(mapa);
      filho.castShadow = true;
      filho.receiveShadow = true;
      return;
    }
    if (nome === "tkwa_sl2l") {
      consertarNormais(filho.geometry);
      const mapa = filho.material?.map || null;
      filho.material?.dispose?.();
      filho.material = materialDoGlobo(mapa);
      filho.castShadow = false;
      filho.receiveShadow = false;
      filho.renderOrder = 1;
      return;
    }
    consertarNormais(filho.geometry);
    filho.material = ajustarMaterial(filho.material);
    filho.castShadow = true;
    filho.receiveShadow = true;
  });
  const temKage = lixoKage.length > 0;
  for (let i = 0; i < lixoKage.length; i++) {
    const mesh = lixoKage[i];
    mesh.parent?.remove(mesh);
    mesh.geometry?.dispose?.();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (let m = 0; m < mats.length; m++) mats[m]?.dispose?.();
  }
  raiz.updateMatrixWorld(true);
  const caixa = new THREE.Box3().setFromObject(raiz);
  if (volume) marcarVolume(raiz, caixa.min.y);
  const grupo = new THREE.Group();
  // Corpo no y=0; modelos com kage sobem LIFT_KAGE pra não z-fightar com o terreno.
  raiz.position.set(
    -((caixa.min.x + caixa.max.x) * 0.5),
    -caixa.min.y,
    -((caixa.min.z + caixa.max.z) * 0.5),
  );
  grupo.add(raiz);
  grupo.scale.setScalar(1);
  grupo.userData.temKage = temKage;
  grupo.userData.janelas = centrosJanela(grupo);
  return {
    grupo,
    sx: caixa.max.x - caixa.min.x,
    sz: caixa.max.z - caixa.min.z,
    sy: caixa.max.y - caixa.min.y,
    temKage,
  };
}

function escalaDoLote(medido, id = "") {
  const pegada = pegadaDoPapel(id);
  const lx = pegada?.x > 0 ? pegada.x : LADO_X;
  const lz = pegada?.z > 0 ? pegada.z : LADO_Z;
  return Math.min(lx / medido.sx, lz / medido.sz) * FOLGA;
}

function centrosJanela(grupo) {
  grupo.updateMatrixWorld(true);
  const caixa = new THREE.Box3();
  const tmp = new THREE.Box3();
  let achou = false;
  grupo.traverse((filho) => {
    if (!filho.isMesh) return;
    if ((filho.material?.name || "").toLowerCase() !== "h_mado") return;
    tmp.setFromObject(filho);
    if (!achou) {
      caixa.copy(tmp);
      achou = true;
    } else caixa.union(tmp);
  });
  if (!achou || caixa.isEmpty()) return [];
  const c = caixa.getCenter(new THREE.Vector3());
  grupo.worldToLocal(c);
  return [{ x: c.x, y: c.y, z: c.z, cor: "#b9d7ff", raio: 1.15, intensidade: 1.2 }];
}

export function pendurarLuzes(inst, id, dono) {
  let pontos = pontosDoModelo(id);
  if (!pontos.length) pontos = inst.userData.janelas || [];
  if (!pontos.length) return;
  inst.userData.modeloLuz = id;
  inst.userData.donoLuz = dono;
  inst.userData.pontosLuz = pontos;
  const cartoes = [];
  for (let i = 0; i < pontos.length; i++) {
    const p = pontos[i];
    const cartao = criarCartaoLuz(p.cor, p.raio);
    cartao.position.set(p.x, p.y, p.z);
    cartao.userData.fatorLuz = 1;
    cartoes.push(cartao);
    inst.add(cartao);
  }
  inst.userData.cartoesLuz = cartoes;
}

/**
 * @param {string} id
 * @param {{ ladoX?: number, ladoZ?: number }} [opts] pegada alvo (sítios outdoor)
 */
export function carregarMoldeCidade(id, opts = null) {
  return carregarObj(id).then((raiz) => {
    const medido = preparar(raiz, id === "poste");
    const pegada = pegadaDoPapel(id);
    const lx = opts?.ladoX > 0 ? opts.ladoX : pegada.x || LADO_X;
    const lz = opts?.ladoZ > 0 ? opts.ladoZ : pegada.z || LADO_Z;
    const escala =
      id === "poste"
        ? ALTURA_POSTE / medido.sy
        : Math.min(lx / medido.sx, lz / medido.sz) * FOLGA;
    if (id === "poste") aplicarEscalaProp(medido.grupo, escala);
    else aplicarEscalaCasa(medido.grupo, escala);
    aplicarFolgaKage(medido.grupo);
    return medido.grupo;
  });
}

function prepararFolha(tex) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  const img = tex.image;
  const pivo = pivoDaImagem(img);
  return {
    tex,
    largura: (img.width || 0) * PX_MUNDO,
    altura: (img.height || 0) * PX_MUNDO,
    pivo,
  };
}

function carregarFolhas() {
  const pedidos = [];
  for (let n = 1; n <= FOLHAS_CASA; n++) {
    pedidos.push(new Promise((resolve) => {
      new THREE.TextureLoader().load(
        `assets/sprites/casas/casa-${n}.png`,
        (tex) => resolve([n, prepararFolha(tex)]),
        undefined,
        () => resolve([n, null]),
      );
    }));
  }
  return Promise.all(pedidos).then((pares) => {
    const folhas = new Map();
    for (let i = 0; i < pares.length; i++) {
      if (pares[i][1]) folhas.set(pares[i][0], pares[i][1]);
    }
    return folhas;
  });
}

function materialDoCartao(tex) {
  const mat = new THREE.MeshLambertMaterial({
    map: tex,
    transparent: true,
    alphaTest: ALFA_SPRITE,
    side: THREE.FrontSide,
    depthWrite: true,
  });
  aplicarLuzCidade(mat);
  aplicarLuzBillboard(mat);
  return mat;
}

function criarCartaoCasa(folha) {
  const geo = geometriaNoPe(folha.pivo.x, folha.pivo.y, folha.largura, folha.altura);
  if (!folha.material) folha.material = materialDoCartao(folha.tex);
  const mesh = new THREE.Mesh(geo, folha.material);
  mesh.name = "casa-cartao";
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.rotation.order = "YXZ";
  const raiz = aplicarFatorYCasa(new THREE.Group());
  raiz.add(mesh);
  raiz.userData.cartao = mesh;
  return raiz;
}

/** Dist² ao AABB (0 se o ponto está dentro). */
function dist2AoAabb(px, py, x0, y0, x1, y1) {
  const cx = px < x0 ? x0 : px > x1 ? x1 : px;
  const cy = py < y0 ? y0 : py > y1 ? y1 : py;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy;
}

/**
 * Histerese de stream: evita pop na borda do alcance.
 * @param {boolean} visivelAgora
 * @param {number} d2
 * @param {number} alcance
 * @param {number} [folga]
 */
function deveFicarVisivel(visivelAgora, d2, alcance, folga = 40) {
  const in2 = alcance * alcance;
  if (!visivelAgora) return d2 <= in2;
  const out = alcance + folga;
  return d2 <= out * out;
}

function montarCidade(moldes, folhas, def, sprites, predios) {
  const layout = montarLayout(def);
  const grupo = new THREE.Group();
  grupo.name = `cidade-${def.key}`;
  const origem = deLocalKanto(def.ax * AREA_KANTO, def.ay * AREA_KANTO);
  const ox = origem.x;
  const oy = origem.y;
  const volumes = layout.volumes;
  for (let i = 0; i < volumes.length; i++) {
    const v = volumes[i];
    const mx = (v.x0 + v.x1) * 0.5;
    const my = (v.y0 + v.y1) * 0.5;
    if (v.cartao) {
      const folha = folhas.get(v.folha);
      if (!folha) continue;
      const sprite = criarCartaoCasa(folha);
      sprite.position.set(ox + mx, ALTURA_PRACA, oy + v.y1 - 1);
      grupo.add(sprite);
      continue;
    }
    const id = v.modelo;
    const molde = id ? moldes.get(id) : null;
    if (molde) {
      const inst = molde.grupo.clone(true);
      inst.rotation.y = yawDoEdificio(v.papel, mx, my);
      inst.position.set(ox + mx, ALTURA_PRACA, oy + my);
      const dono = `${def.key}:${i}`;
      pendurarLuzes(inst, id, dono);
      if (v.papel === "casa" && inst.userData.pontosLuz) prepararRoletaJanela(inst, dono);
      grupo.add(inst);
      continue;
    }
    const spriteId = chaveSpritePredio(v.papel, def.ginasio);
    const folhaPredio = spriteId ? predios?.get(spriteId) : null;
    if (!folhaPredio) continue;
    const sprite = criarSpritePredio(folhaPredio);
    sprite.position.set(ox + mx, ALTURA_PRACA, oy + my);
    grupo.add(sprite);
  }
  const poste = moldes.get("poste");
  const acender = (inst, dono) => pendurarLuzes(inst, "poste", dono);
  anexarDecoracaoCidade(grupo, poste, layout, ox, oy, acender, sprites);
  if (poste) {
    const pontos = postesDeRua(layout);
    for (let i = 0; i < pontos.length; i++) {
      const inst = poste.grupo.clone(true);
      inst.position.set(ox + pontos[i].x, ALTURA_PRACA, oy + pontos[i].y);
      pendurarLuzes(inst, "poste", `${def.key}:poste:${i}`);
      grupo.add(inst);
    }
  }
  // Centro/AABB no layout (AREA 128 → CENTRO 64).
  const fp = layout.fp;
  return {
    grupo,
    cx: ox + (fp?.cx ?? AREA_KANTO * 0.5),
    cy: oy + (fp?.cy ?? AREA_KANTO * 0.5),
    x0: ox + (fp?.x0 ?? 0),
    y0: oy + (fp?.y0 ?? 0),
    x1: ox + (fp?.x1 ?? AREA_KANTO),
    y1: oy + (fp?.y1 ?? AREA_KANTO),
  };
}

export function criarEdificiosCidade() {
  const grupo = new THREE.Group();
  grupo.name = "edificios-cidade";
  const ids = MODELOS_CIDADE;
  const cargas = ids.map((id) => carregarObj(id).then((raiz) => [id, { grupo: raiz }]));
  let resolverPronto;
  const quandoPronto = new Promise((resolve) => {
    resolverPronto = resolve;
  });
  Promise.all([Promise.all(cargas), carregarCatalogoLuzes(), carregarFolhas(), carregarSpritesPraca().catch((erro) => {
      console.error("sprites da praça", erro);
      return null;
    }), carregarSpritesPredio().catch((erro) => {
      console.error("sprites dos prédios", erro);
      return null;
    })])
    .then(([pares, , folhas, sprites, predios]) => {
      const moldes = new Map();
      for (let i = 0; i < pares.length; i++) {
        const [id, item] = pares[i];
        const medido = preparar(item.grupo, id === "poste");
        const escala = id === "poste" ? ALTURA_POSTE / medido.sy : escalaDoLote(medido, id);
        if (id === "poste") aplicarEscalaProp(medido.grupo, escala);
        else aplicarEscalaCasa(medido.grupo, escala);
        aplicarFolgaKage(medido.grupo);
        moldes.set(id, medido);
      }
      const acender = (inst, dono) => pendurarLuzes(inst, "poste", dono);
      grupo.userData.cidades = [];
      for (let i = 0; i < CIDADES_KANTO.length; i++) {
        const cidade = montarCidade(moldes, folhas, CIDADES_KANTO[i], sprites, predios);
        grupo.add(cidade.grupo);
        grupo.userData.cidades.push(cidade);
      }
      const sala = new THREE.Group();
      sala.name = "sala-interior";
      anexarCascaSala(sala, sprites?.piso, sprites?.saida);
      anexarInteriores(sala, sprites?.moveis);
      grupo.add(sala);
      grupo.userData.sala = sala;
      if (predios) {
        const usina = montarUsina(predios);
        if (usina) {
          grupo.add(usina.grupo);
          grupo.userData.cidades.push(usina);
        }
      }
      const rotas = criarDecoracaoRotas(moldes.get("poste"), acender);
      for (let i = 0; i < rotas.length; i++) {
        grupo.add(rotas[i].grupo);
        grupo.userData.cidades.push(rotas[i]);
      }
      marcarReflexo(grupo);
      resolverPronto?.();
    })
    .catch((erro) => {
      console.error("modelos da cidade", erro);
      resolverPronto?.();
    });

  montarLaboratorio3d(grupo);
  montarCentro3d(grupo);
  montarLoja3d(grupo);
  montarGinasio3d(grupo);
  montarMansao3d(grupo);
  montarCondominio3d(grupo);
  marcarReflexo(grupo);

  let yawAplicado = NaN;
  let inclinacaoAplicada = NaN;
  let pxAplicado = NaN;
  let pyAplicado = NaN;
  const YAW_EPS = 0.002;
  const POS_EPS = 0.35;

  return {
    grupo,
    quandoPronto,
    atualizar(px, py, yaw = 0, inclinacao = 0) {
      atualizarLaboratorio(yaw, inclinacao, px, py);
      atualizarCentro(px, py);
      atualizarParedesDual(inclinacao);
      const pesoNoite = obterPesoNoite();
      const dtJanela = comecarQuadroJanelas();
      if (materialFlare) materialFlare.opacity = pesoNoite;
      if (materialGlobo) materialGlobo.emissiveIntensity = pesoNoite;
      const cidades = grupo.userData.cidades;
      if (!cidades) return;

      const mudouYaw = !(Math.abs(yaw - yawAplicado) <= YAW_EPS);
      const mudouTilt = !(Math.abs(inclinacao - inclinacaoAplicada) <= YAW_EPS);
      const mudouPos =
        !(Math.abs(px - pxAplicado) <= POS_EPS) ||
        !(Math.abs(py - pyAplicado) <= POS_EPS);
      const precisaCartao = mudouYaw || mudouTilt || Number.isNaN(yawAplicado);
      const precisaVisibilidade = mudouPos || Number.isNaN(pxAplicado);
      // Luz do chão: SEMPRE. comecarMapaChao zera fontes todo quadro — pular
      // aqui apaga postes/Pokémon no idle e pisca ao andar (POS_EPS).

      // Alcance: stream + margem. Visibilidade por AABB do footprint (não ponto +64).
      const alcance = (obterRaioStream() + 2) * CHUNK_XZ + 96;
      for (let i = 0; i < cidades.length; i++) {
        const c = cidades[i];
        const d2 =
          Number.isFinite(c.x0) && Number.isFinite(c.y0)
            ? dist2AoAabb(px, py, c.x0, c.y0, c.x1, c.y1)
            : (px - c.cx) * (px - c.cx) + (py - c.cy) * (py - c.cy);
        const visivel = deveFicarVisivel(!!c.grupo.visible, d2, alcance);
        if (precisaVisibilidade) c.grupo.visible = visivel;
        else if (!c.grupo.visible) continue;
        if (!visivel) continue;
        const filhos = c.grupo.children;
        for (let f = 0; f < filhos.length; f++) {
          const inst = filhos[f];
          const cartao = inst.userData.cartao;
          if (cartao && precisaCartao) {
            cartao.rotation.x = inclinacao;
            cartao.rotation.y = yaw;
          }
          const pontos = inst.userData.pontosLuz;
          if (!pontos) continue;
          if (inst.userData.roletaJanela) atualizarRoletaJanela(inst, pesoNoite, dtJanela);
          const brilho = brilhoDaInstancia(inst);
          if (brilho <= 0.05 || pesoNoite <= 0.02) continue;
          inst.updateWorldMatrix(true, false);
          for (let p = 0; p < pontos.length; p++) {
            const ponto = pontos[p];
            _ponto.set(ponto.x, ponto.y, ponto.z).applyMatrix4(inst.matrixWorld);
            oferecerLuzChao(
              inst.userData.modeloLuz,
              _ponto.x,
              _ponto.y,
              _ponto.z,
              ponto.cor,
              ponto.intensidade * brilho,
            );
          }
        }
      }
      const sala = grupo.userData.sala;
      if (sala && precisaCartao) {
        const pecas = sala.children;
        for (let f = 0; f < pecas.length; f++) {
          const cartao = pecas[f].userData.cartao;
          if (!cartao) continue;
          cartao.rotation.x = inclinacao;
          cartao.rotation.y = yaw;
        }
      }
      if (precisaCartao) {
        yawAplicado = yaw;
        inclinacaoAplicada = inclinacao;
      }
      if (precisaVisibilidade) {
        pxAplicado = px;
        pyAplicado = py;
      }
    },
  };
}
