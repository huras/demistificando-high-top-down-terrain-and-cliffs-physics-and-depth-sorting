/**
 * BattleStage 3D — três terraços + duas faces de cliff (port do layoutPokemon AI).
 * Camera em +Z olha para −Z (longe = plateau).
 */
import * as THREE from "three";
import { BILLBOARD_INCLINACAO } from "../../config.js";
import {
  aplicarPivoCartao,
  criarAtorCartao,
  poseAtorCartao,
} from "../../render/3d/billboard/atorCartao.js";
import { arquivoSprite, obterKit } from "../../mundo/bioma/kits.js";
import { biomaDominante } from "../../mundo/bioma/catalogo.js";

/** Largura total do stage (eixo X). */
export const STAGE_W = 28;
/** Profundidade do piso de luta (battlers). */
export const FLOOR_DZ = 12;
/** Shelf do mid ledge. */
export const MID_DZ = 3.6;
/** Plateau longe. */
export const PLATEAU_DZ = 4.2;
/** Altura de cada cliff (dois degraus → 3 decks). */
export const STEP_H = 1.45;
/** Lip do piso (Z mais longe do floor / base do cliff inferior). */
export const FLOOR_FAR_Z = -5.2;
/** Perto da câmera (Z positivo). */
export const FLOOR_NEAR_Z = FLOOR_FAR_Z + FLOOR_DZ;

const CAP_PROP = 64;
const texCache = new Map();
const spriteCache = new Map();

/** @type {THREE.Group|null} */
let grupo = null;
/** @type {THREE.Scene|null} */
let cenaHost = null;
/** @type {string} */
let keyAtual = "";
/** @type {{ sprite: THREE.Sprite, mat: THREE.SpriteMaterial }[]} */
const props = [];

function hash2(a, b) {
  let x = ((a | 0) * 374761393 + (b | 0) * 668265263) | 0;
  x = (x ^ (x >>> 13)) * 1274126177;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function texturaRepetida(url) {
  let tex = texCache.get(url);
  if (tex) return tex;
  tex = new THREE.Texture();
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  texCache.set(url, tex);
  const img = new Image();
  img.onload = () => {
    tex.image = img;
    tex.needsUpdate = true;
  };
  img.src = url;
  return tex;
}

function texturaSprite(url) {
  let tex = spriteCache.get(url);
  if (tex) return tex;
  tex = new THREE.Texture();
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  spriteCache.set(url, tex);
  const img = new Image();
  img.onload = () => {
    tex.image = img;
    tex.userData.w = img.width;
    tex.userData.h = img.height;
    tex.needsUpdate = true;
  };
  img.src = url;
  return tex;
}

function placaChao(w, d, y, zCenter, map, repeatX, repeatZ) {
  const geo = new THREE.PlaneGeometry(w, d, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.92,
    metalness: 0,
  });
  if (map) {
    map.repeat.set(repeatX, repeatZ);
    map.needsUpdate = true;
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, y, zCenter);
  mesh.receiveShadow = false;
  return mesh;
}

function faceCliff(w, h, y0, z, map) {
  const geo = new THREE.PlaneGeometry(w, h, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.88,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  if (map) {
    map.repeat.set(Math.max(2, w / 2.2), Math.max(1, h / 1.1));
    map.needsUpdate = true;
  }
  const mesh = new THREE.Mesh(geo, mat);
  // Face sul: normal aponta para +Z (câmera).
  mesh.position.set(0, y0 + h * 0.5, z);
  return mesh;
}

function labio(w, z, y) {
  const geo = new THREE.BoxGeometry(w, 0.06, 0.12);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1a221c,
    roughness: 1,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, y + 0.03, z);
  return mesh;
}

/**
 * Layout dos três decks (mesma lógica relativa do bake AI).
 */
export function layoutTerrazas() {
  const midFarZ = FLOOR_FAR_Z - MID_DZ;
  const plateauFarZ = midFarZ - PLATEAU_DZ;
  return {
    floor: {
      y: 0,
      zNear: FLOOR_NEAR_Z,
      zFar: FLOOR_FAR_Z,
      zCenter: (FLOOR_NEAR_Z + FLOOR_FAR_Z) * 0.5,
      depth: FLOOR_DZ,
    },
    mid: {
      y: STEP_H,
      zNear: FLOOR_FAR_Z,
      zFar: midFarZ,
      zCenter: (FLOOR_FAR_Z + midFarZ) * 0.5,
      depth: MID_DZ,
    },
    plateau: {
      y: STEP_H * 2,
      zNear: midFarZ,
      zFar: plateauFarZ,
      zCenter: (midFarZ + plateauFarZ) * 0.5,
      depth: PLATEAU_DZ,
    },
    cliffLowZ: FLOOR_FAR_Z,
    cliffHighZ: midFarZ,
    step: STEP_H,
    width: STAGE_W,
  };
}

function sortearIds(lista, n, seed, salt) {
  const out = [];
  if (!lista?.length || n <= 0) return out;
  for (let i = 0; i < n; i++) {
    const u = hash2(seed, salt + i * 17);
    let soma = 0;
    for (let k = 0; k < lista.length; k++) soma += Math.max(0.01, Number(lista[k].peso) || 1);
    let acc = u * soma;
    let pick = lista[0].id;
    for (let k = 0; k < lista.length; k++) {
      acc -= Math.max(0.01, Number(lista[k].peso) || 1);
      if (acc <= 0) {
        pick = lista[k].id;
        break;
      }
    }
    out.push(pick);
  }
  return out;
}

function urlProp(id) {
  const arq = arquivoSprite(id);
  if (arq) return arq;
  if (!id) return null;
  if (id.includes("/")) return id;
  // Fallbacks por classe comum.
  if (id.includes("rock") || id.includes("stone") || id.includes("dirt-rock")) {
    return `assets/rocks/${id}.png`;
  }
  if (id.includes("grass") || id.includes("tuft") || id.includes("flower")) {
    return `assets/vegetation/${id}.png`;
  }
  return `assets/trees/${id}.png`;
}

function emKeepOut(x, z, zonas) {
  for (let i = 0; i < zonas.length; i++) {
    const o = zonas[i];
    const dx = (x - o.x) / o.rX;
    const dz = (z - o.z) / o.rZ;
    if (dx * dx + dz * dz < 1) return true;
  }
  return false;
}

/** Keep-outs elípticos no floor (player / foe + fan). */
function keepOutsFloor(activeN = 1) {
  const n = Math.max(1, Math.min(5, activeN | 0));
  const crowd = Math.max(0, n - 1);
  return [
    { x: -5.2, z: 0.35, rX: 0.15 * STAGE_W + crowd * 0.35, rZ: 1.7 },
    { x: 5.2, z: -0.8, rX: 0.13 * STAGE_W + crowd * 0.3, rZ: 1.9 },
    { x: -5.2, z: 1.2, rX: 2.4, rZ: 1.2 },
    { x: 5.2, z: -1.6, rX: 2.2, rZ: 1.4 },
  ];
}

function garantirProps(n) {
  while (props.length < n) {
    const sprite = criarAtorCartao(null, {
      nome: "stage-prop",
      transparent: true,
      depthWrite: false,
      alphaTest: 0.12,
      opacity: 1,
      renderOrder: 2,
    });
    sprite.visible = false;
    aplicarPivoCartao(sprite, 0.5, 1);
    props.push({ sprite, mat: sprite.material });
    if (grupo) grupo.add(sprite);
  }
}

function colocarProp(slot, url, x, y, z, escala, yaw) {
  const tex = texturaSprite(url);
  slot.mat.map = tex;
  slot.mat.needsUpdate = true;
  const iw = tex.userData.w || 64;
  const ih = tex.userData.h || 64;
  const aspect = iw / Math.max(1, ih);
  const h = escala;
  const w = h * aspect;
  slot.px = x;
  slot.py = y;
  slot.pz = z;
  slot.largura = w;
  slot.altura = h;
  poseAtorCartao(slot.sprite, {
    x,
    y,
    z,
    largura: w,
    altura: h,
    yaw,
    inclinacao: BILLBOARD_INCLINACAO,
    pivotX: 0.5,
    pivotY: 1,
  });
  slot.sprite.visible = true;
}

/**
 * @param {object} perfil
 * @param {{ activePerSide?: number, seed?: number }} [opts]
 */
function popularProps(perfil, opts = {}) {
  const kit = perfil.kit || {};
  const seed = (opts.seed | 0) || perfil.seed | 0 || 1;
  const layout = layoutTerrazas();
  const zonas = keepOutsFloor(opts.activePerSide || 1);
  const yaw = 0.15;
  let pi = 0;

  const arvores = sortearIds(kit.arvore, 10, seed, 11);
  const pedras = sortearIds(kit.pedra, 14, seed, 29);
  const gramas = sortearIds(kit.grama, 28, seed, 47);

  // Plateau trees (sem keep-out).
  for (let i = 0; i < Math.min(7, arvores.length); i++) {
    const url = urlProp(arvores[i]);
    if (!url) continue;
    const u = hash2(seed, 100 + i);
    const v = hash2(seed, 200 + i);
    const x = (u - 0.5) * (STAGE_W * 0.88);
    const z =
      layout.plateau.zFar +
      0.35 +
      v * Math.max(0.6, layout.plateau.depth - 0.8);
    garantirProps(pi + 1);
    colocarProp(props[pi++], url, x, layout.plateau.y, z, 2.2 + u * 1.1, yaw);
  }

  // Mid ledge: árvores menores + pedras + grama.
  for (let i = 0; i < 4; i++) {
    const id = arvores[(i + 3) % Math.max(1, arvores.length)];
    const url = urlProp(id);
    if (!url) continue;
    const u = hash2(seed, 300 + i);
    const v = hash2(seed, 310 + i);
    const x = (u < 0.5 ? -1 : 1) * (4 + u * 8);
    const z = layout.mid.zFar + 0.3 + v * (layout.mid.depth - 0.6);
    garantirProps(pi + 1);
    colocarProp(props[pi++], url, x, layout.mid.y, z, 1.55 + v * 0.6, yaw);
  }
  for (let i = 0; i < 8; i++) {
    const url = urlProp(pedras[i % Math.max(1, pedras.length)]);
    if (!url) continue;
    const u = hash2(seed, 400 + i);
    const v = hash2(seed, 410 + i);
    const x = (u - 0.5) * STAGE_W * 0.9;
    const z = layout.mid.zFar + 0.2 + v * (layout.mid.depth - 0.4);
    garantirProps(pi + 1);
    colocarProp(props[pi++], url, x, layout.mid.y, z, 0.55 + u * 0.45, yaw);
  }
  for (let i = 0; i < 12; i++) {
    const url = urlProp(gramas[i % Math.max(1, gramas.length)]);
    if (!url) continue;
    const u = hash2(seed, 500 + i);
    const v = hash2(seed, 510 + i);
    const x = (u - 0.5) * STAGE_W * 0.92;
    const z = layout.mid.zFar + 0.15 + v * (layout.mid.depth - 0.3);
    garantirProps(pi + 1);
    colocarProp(props[pi++], url, x, layout.mid.y, z, 0.35 + v * 0.25, yaw);
  }

  // Floor details com keep-out.
  for (let i = 0; i < 10; i++) {
    const url = urlProp(pedras[(i + 3) % Math.max(1, pedras.length)]);
    if (!url) continue;
    const u = hash2(seed, 600 + i);
    const v = hash2(seed, 610 + i);
    const side = u < 0.5;
    const x = side
      ? -STAGE_W * 0.42 + hash2(seed, 620 + i) * 3.2
      : STAGE_W * 0.42 - hash2(seed, 630 + i) * 3.2;
    const z = layout.floor.zFar + 1.2 + v * (layout.floor.depth - 2.4);
    if (emKeepOut(x, z, zonas)) continue;
    garantirProps(pi + 1);
    colocarProp(props[pi++], url, x, 0, z, 0.5 + u * 0.4, yaw);
  }
  for (let i = 0; i < 18; i++) {
    const url = urlProp(gramas[(i + 5) % Math.max(1, gramas.length)]);
    if (!url) continue;
    const u = hash2(seed, 700 + i);
    const v = hash2(seed, 710 + i);
    const x =
      u < 0.5
        ? -STAGE_W * 0.5 + hash2(seed, 720 + i) * STAGE_W * 0.18
        : STAGE_W * 0.32 + hash2(seed, 730 + i) * STAGE_W * 0.18;
    const z = layout.floor.zFar + 1.5 + v * (layout.floor.depth - 2.8);
    if (emKeepOut(x, z, zonas)) continue;
    garantirProps(pi + 1);
    colocarProp(props[pi++], url, x, 0, z, 0.32 + v * 0.22, yaw);
  }

  for (; pi < props.length; pi++) props[pi].sprite.visible = false;
}

/**
 * @param {THREE.Scene} cena
 * @param {object} perfil — de resolverPerfilStage
 * @param {{ forcar?: boolean, activePerSide?: number }} [opts]
 */
export function montarTerrazas(cena, perfil, opts = {}) {
  if (!cena || !perfil) return null;
  const key = `${perfil.key}|n${opts.activePerSide | 0 || 1}`;
  if (!opts.forcar && key === keyAtual && grupo) {
    grupo.visible = true;
    return layoutTerrazas();
  }
  keyAtual = key;
  cenaHost = cena;

  if (grupo) {
    cena.remove(grupo);
    grupo.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
        else o.material.dispose?.();
      }
    });
    grupo = null;
    props.length = 0;
  }

  grupo = new THREE.Group();
  grupo.name = "batalha-terrazas";
  const layout = layoutTerrazas();
  const chaoUrl = perfil.chaoUrl || "assets/terrain/centro/grass.png";
  const cliffUrl = perfil.cliffUrl || "assets/terrain/cliffs/light-grass.png";
  const texChao = texturaRepetida(chaoUrl);
  const texCliff = texturaRepetida(cliffUrl);

  texChao.repeat.set(STAGE_W / 2.4, FLOOR_DZ / 2.4);
  grupo.add(
    placaChao(
      STAGE_W,
      layout.floor.depth,
      layout.floor.y,
      layout.floor.zCenter,
      texChao,
      STAGE_W / 2.4,
      layout.floor.depth / 2.4,
    ),
  );
  grupo.add(
    placaChao(
      STAGE_W,
      layout.mid.depth,
      layout.mid.y,
      layout.mid.zCenter,
      texChao,
      STAGE_W / 2.4,
      layout.mid.depth / 2.0,
    ),
  );
  grupo.add(
    placaChao(
      STAGE_W,
      layout.plateau.depth,
      layout.plateau.y,
      layout.plateau.zCenter,
      texChao,
      STAGE_W / 2.4,
      layout.plateau.depth / 2.0,
    ),
  );

  texCliff.repeat.set(STAGE_W / 2.2, STEP_H / 1.1);
  grupo.add(faceCliff(STAGE_W, STEP_H, 0, layout.cliffLowZ, texCliff));
  grupo.add(faceCliff(STAGE_W, STEP_H, STEP_H, layout.cliffHighZ, texCliff));
  grupo.add(labio(STAGE_W, layout.cliffLowZ, 0));
  grupo.add(labio(STAGE_W, layout.cliffHighZ, STEP_H));

  // Sky backdrop simples atrás do plateau.
  const bgGeo = new THREE.PlaneGeometry(STAGE_W * 1.35, 10);
  const bgMat = new THREE.MeshBasicMaterial({
    color: perfil.skyColor || 0x87b7e0,
    depthWrite: false,
  });
  const bg = new THREE.Mesh(bgGeo, bgMat);
  bg.position.set(0, layout.plateau.y + 4.2, layout.plateau.zFar - 0.4);
  grupo.add(bg);

  cena.add(grupo);
  popularProps(perfil, {
    seed: perfil.seed,
    activePerSide: opts.activePerSide || 1,
  });
  grupo.visible = true;
  return layout;
}

export function girarPropsTerrazas(yaw) {
  if (!grupo) return;
  for (let i = 0; i < props.length; i++) {
    const slot = props[i];
    if (!slot.sprite.visible || !(slot.altura > 0)) continue;
    poseAtorCartao(slot.sprite, {
      x: slot.px,
      y: slot.py,
      z: slot.pz,
      largura: slot.largura,
      altura: slot.altura,
      yaw,
      inclinacao: BILLBOARD_INCLINACAO,
      pivotX: 0.5,
      pivotY: 1,
    });
  }
}

export function esconderTerrazas() {
  if (grupo) grupo.visible = false;
}

export function limparTerrazas() {
  if (grupo && cenaHost) {
    cenaHost.remove(grupo);
    grupo.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }
  grupo = null;
  cenaHost = null;
  keyAtual = "";
  props.length = 0;
}

export function terrazasAtivas() {
  return !!(grupo && grupo.visible);
}

/**
 * Resolve kit/bioma → urls de chão/cliff + listas de props.
 * @param {number} x
 * @param {number} y
 */
export function perfilVisualDoEncontro(x, y) {
  const wx = Number.isFinite(x) ? x : 0;
  const wy = Number.isFinite(y) ? y : 0;
  const bioma = biomaDominante(wx | 0, wy | 0);
  const kitId = bioma?.kit || bioma?.id || "light-grass";
  const kit = obterKit(kitId) || obterKit("light-grass") || {};
  const seed =
    (((wx * 73856093) ^ (wy * 19349663) ^ String(kitId).length * 83492791) >>> 0);
  return {
    biomaId: String(bioma?.id || kitId),
    kitId: String(kitId),
    kit,
    chaoUrl: kit.chaoArquivo || "assets/terrain/centro/grass.png",
    cliffUrl: kit.cliffArquivo || "assets/terrain/cliffs/light-grass.png",
    seed,
    skyColor: kit.chao === "snow" || kit.chao === "dirty-snowy" ? 0xb8cce0 : 0x87b7e0,
  };
}
