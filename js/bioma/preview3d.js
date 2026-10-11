import * as THREE from "three";
import {
  ALTURA_BLOCO,
  TILE,
  VEG_ALPHA_TEST,
  VEG_ARVORE_ESCALA,
  VEG_MATA_ESCALA,
  VEG_YAW_EPS,
} from "../config.js";
import { pivoDaImagem } from "../render/pivoPe.js";
import { avaliarGrafo } from "../mundo/bioma/grafo.js";
import {
  arquivoSprite,
  chanceGrama,
  chancePedra,
  obterKit,
  sortearSprite,
} from "../mundo/bioma/kits.js";
import { hash2 } from "../mundo/voxel/ruido.js";
import { carregarVisuaisKits } from "../render/visuaisKit.js";
import { canvasParaTextura, texturaCliffDeFolha } from "../render/3d/texturasTerreno3d.js";

const LADO = 48;
const PASSO = 1;
const ORIGEM = 8;

/** Grade do demo 3D, em blocos. A miniatura do nó usa o dobro deste lado. */
export const DEMO_3D = { lado: LADO, passo: PASSO, origem: ORIGEM };

/** @type {HTMLCanvasElement | null} */
let canvas = null;
/** @type {THREE.WebGLRenderer | null} */
let renderer = null;
/** @type {THREE.Scene | null} */
let cena = null;
/** @type {THREE.PerspectiveCamera | null} */
let camera = null;
/** @type {THREE.DirectionalLight | null} */
let sol = null;
/** @type {THREE.Mesh | null} */
let malhaTopo = null;
/** @type {THREE.Mesh | null} */
let malhaParede = null;
/** @type {THREE.Mesh | null} */
let disco = null;
/** @type {THREE.Group | null} */
let grupoProps = null;
/** @type {THREE.PlaneGeometry | null} */
let visuais = null;
let pronto = false;
let vivo = false;
let raf = 0;
let timer = 0;
/** @type {object | null} */
let pedido = null;
let idEnquadrado = null;
let minBloco = 1;
let maxBloco = 1;
let baseY = 0;

const alvo = new THREE.Vector3();
const dummy = new THREE.Object3D();
let az = 0.85;
let azAlvo = 0.85;
let pol = 1.02;
let polAlvo = 1.02;
let dist = 42;
let distAlvo = 42;
let yawCartaz = null;
let propsSujos = true;

/** @type {{ x: number, y: number, modo: string } | null} */
let arraste = null;

/** @type {Map<string, THREE.Texture | null>} */
const texturasChao = new Map();
/** @type {Map<string, THREE.Texture | null>} */
const texturasCliff = new Map();
/** @type {Map<string, { material: THREE.Material, depth: THREE.Material, textura: THREE.Texture, largura: number, altura: number }>} */
const materiaisSprite = new Map();

function contextoDe(catalogo) {
  return {
    metrosPorBloco: Number(catalogo?.metrosPorBloco) || 48,
    metrosPorCelula: Number(catalogo?.metrosPorCelula) || 1000,
  };
}

function alturaBlocos(bioma, wx, wy, seed, catalogo) {
  const n = avaliarGrafo(bioma, wx, wy, seed, contextoDe(catalogo));
  if (bioma?.modo !== "unity") return n;
  const piso = Number(bioma.pisoMetros) || 0;
  const faixa = Number(bioma.faixaMetros) || 1;
  const metros = piso + Math.max(0, Math.min(1, n)) * faixa;
  const origem = Number(catalogo?.origemMetros);
  const base = Number.isFinite(origem) ? origem : -200;
  const mpb = Number(catalogo?.metrosPorBloco) || 48;
  return (metros - base) / mpb;
}

function encaixar(h, degrau) {
  const n = Number(h);
  if (!Number.isFinite(n)) return 1;
  const d = Math.max(1, Number(degrau) || 1);
  const q = Math.round(n / d) * d;
  return Math.max(1, Math.min(60, q));
}

function acumular() {
  return { pos: [], uv: [], cor: [] };
}

function quad(acc, verts, uvs, cors) {
  const [a, b, c, d] = verts;
  const [ua, ub, uc, ud] = uvs;
  const [ca, cb, cc, cd] = cors;
  acc.pos.push(
    a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2],
    a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2],
  );
  acc.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1], ua[0], ua[1], uc[0], uc[1], ud[0], ud[1]);
  acc.cor.push(ca, ca, ca, cb, cb, cb, cc, cc, cc, ca, ca, ca, cc, cc, cc, cd, cd, cd);
}

function geometriaDe(acc) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(acc.pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(acc.uv, 2));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(acc.cor, 3));
  geo.computeVertexNormals();
  return geo;
}

function parede(acc, x0, z0, x1, z1, y0, y1, u0, u1) {
  const blocos = Math.max(0.15, (y1 - y0) / ALTURA_BLOCO);
  const topo = y1 - 0.012;
  const claro = 0.92;
  const sombra = 0.48;
  quad(
    acc,
    [
      [x0, y0, z0],
      [x1, y0, z1],
      [x1, topo, z1],
      [x0, topo, z0],
    ],
    [
      [u0, 0],
      [u1, 0],
      [u1, blocos],
      [u0, blocos],
    ],
    [sombra, sombra, claro, claro],
  );
}

function texturaChao(kitId) {
  const chave = kitId || "";
  if (texturasChao.has(chave)) return texturasChao.get(chave);
  const kit = obterKit(kitId);
  const img = kit?.chao ? visuais?.centros?.[kit.chao] : null;
  const tex = img ? canvasParaTextura(img, { repeat: true }) : null;
  texturasChao.set(chave, tex);
  return tex;
}

function texturaCliff(kitId) {
  const chave = kitId || "";
  if (texturasCliff.has(chave)) return texturasCliff.get(chave);
  const img = kitId ? visuais?.cliffs?.[kitId] : null;
  const tex = img ? texturaCliffDeFolha(img) : null;
  texturasCliff.set(chave, tex);
  return tex;
}

function aplicarMateriais(bioma) {
  const chao = texturaChao(bioma.kit);
  const cliff = texturaCliff(bioma.kit);
  malhaTopo.material.map = chao;
  malhaParede.material.map = cliff || chao;
  malhaTopo.material.color.set(chao ? "#ffffff" : (bioma.cor || "#6d9a48"));
  malhaParede.material.color.set(cliff || chao ? "#ffffff" : "#6a5344");
  malhaTopo.material.needsUpdate = true;
  malhaParede.material.needsUpdate = true;
}

function montarRelevo(bioma, catalogo, seed) {
  const alturas = new Float32Array(LADO * LADO);
  minBloco = 99;
  maxBloco = 1;
  for (let iz = 0; iz < LADO; iz++) {
    for (let ix = 0; ix < LADO; ix++) {
      let h = encaixar(
        alturaBlocos(bioma, ORIGEM + ix * PASSO, ORIGEM + iz * PASSO, seed, catalogo),
        bioma.degrau,
      );
      if (bioma?.camada === "mar") {
        const nivel = Math.max(2, Math.round(Number(catalogo?.nivelMarBlocos) || 12));
        h = Math.min(h, nivel - 1);
      }
      alturas[iz * LADO + ix] = h;
      if (h < minBloco) minBloco = h;
      if (h > maxBloco) maxBloco = h;
    }
  }

  baseY = minBloco * ALTURA_BLOCO - 0.62;
  const topo = acumular();
  const paredes = acumular();

  for (let iz = 0; iz < LADO; iz++) {
    for (let ix = 0; ix < LADO; ix++) {
      const y = alturas[iz * LADO + ix] * ALTURA_BLOCO;
      quad(
        topo,
        [
          [ix, y, iz],
          [ix, y, iz + 1],
          [ix + 1, y, iz + 1],
          [ix + 1, y, iz],
        ],
        [
          [ix, iz],
          [ix, iz + 1],
          [ix + 1, iz + 1],
          [ix + 1, iz],
        ],
        [1, 1, 1, 1],
      );

      const sul = iz + 1 < LADO ? alturas[(iz + 1) * LADO + ix] * ALTURA_BLOCO : baseY;
      const norte = iz > 0 ? alturas[(iz - 1) * LADO + ix] * ALTURA_BLOCO : baseY;
      const leste = ix + 1 < LADO ? alturas[iz * LADO + ix + 1] * ALTURA_BLOCO : baseY;
      const oeste = ix > 0 ? alturas[iz * LADO + ix - 1] * ALTURA_BLOCO : baseY;
      if (y > sul + 0.02) parede(paredes, ix, iz + 1, ix + 1, iz + 1, sul, y, 0, 1);
      if (y > norte + 0.02) parede(paredes, ix + 1, iz, ix, iz, norte, y, 0, 1);
      if (y > leste + 0.02) parede(paredes, ix + 1, iz + 1, ix + 1, iz, leste, y, 0, 1);
      if (y > oeste + 0.02) parede(paredes, ix, iz, ix, iz + 1, oeste, y, 0, 1);
    }
  }

  const geoTopo = geometriaDe(topo);
  const geoParede = paredes.pos.length ? geometriaDe(paredes) : new THREE.BufferGeometry();
  const antigaTopo = malhaTopo.geometry;
  const antigaParede = malhaParede.geometry;
  malhaTopo.geometry = geoTopo;
  malhaParede.geometry = geoParede;
  antigaTopo.dispose();
  antigaParede.dispose();

  disco.position.set(LADO * 0.5, baseY - 0.03, LADO * 0.5);
  aplicarMateriais(bioma);
  return alturas;
}

function estiloDe(classe) {
  if (classe === "arvore") return VEG_ARVORE_ESCALA;
  if (classe === "pedra" || classe === "cristal") return 1;
  return VEG_MATA_ESCALA;
}

function plantaNaCelula(bioma, ix, iz, seed) {
  const kit = obterKit(bioma.kit);
  const wx = ORIGEM + ix * PASSO;
  const wz = ORIGEM + iz * PASSO;
  const arvore = Math.max(0, Number(bioma.arvore) || 0);
  if (hash2(wx, wz, seed + 9001) < arvore) {
    const sprite = sortearSprite(kit?.arvore, hash2(wx, wz, seed + 9002));
    if (sprite) return { classe: "arvore", sprite };
    return null;
  }
  if (hash2(wx, wz, seed + 9003) < chancePedra()) {
    const lista = (kit?.pedra || []).concat(kit?.cristal || []);
    const sprite = sortearSprite(lista, hash2(wx, wz, seed + 9004));
    if (sprite) {
      const cristal = (kit?.cristal || []).some((item) => item.id === sprite);
      return { classe: cristal ? "cristal" : "pedra", sprite };
    }
  }
  if (hash2(wx, wz, seed + 9006) < chanceGrama()) {
    const sprite = sortearSprite(kit?.grama, hash2(wx, wz, seed + 9007));
    if (sprite) return { classe: "grama", sprite };
  }
  return null;
}

function loteSprite(id, classe) {
  const prontoSprite = materiaisSprite.get(id);
  if (prontoSprite) return prontoSprite;
  const img = visuais?.sprites?.[id];
  if (!img && !arquivoSprite(id)) return null;
  const fonte = img || null;
  if (!fonte) return null;
  const tex = new THREE.Texture(fonte);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  const escala = estiloDe(classe);
  const pw = fonte.naturalWidth || fonte.width || TILE;
  const ph = fonte.naturalHeight || fonte.height || TILE;
  const material = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.9,
    metalness: 0,
    transparent: false,
    alphaTest: VEG_ALPHA_TEST,
    depthWrite: true,
    side: THREE.FrontSide,
  });
  const depth = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: tex,
    alphaTest: VEG_ALPHA_TEST,
  });
  const lote = {
    material,
    depth,
    textura: tex,
    largura: (pw / TILE) * escala,
    altura: (ph / TILE) * escala,
    pivotY: pivoDaImagem(fonte).y,
  };
  materiaisSprite.set(id, lote);
  return lote;
}

function limparProps() {
  if (!grupoProps) return;
  for (let i = grupoProps.children.length - 1; i >= 0; i--) {
    const obj = grupoProps.children[i];
    grupoProps.remove(obj);
    obj.geometry?.dispose();
    obj.dispose?.();
  }
}

function montarProps(bioma, alturas, seed) {
  limparProps();
  /** @type {Map<string, { lote: object, itens: { x: number, y: number, z: number, s: number }[] }>} */
  const grupos = new Map();
  for (let iz = 0; iz < LADO; iz++) {
    for (let ix = 0; ix < LADO; ix++) {
      const planta = plantaNaCelula(bioma, ix, iz, seed);
      if (!planta) continue;
      const lote = loteSprite(planta.sprite, planta.classe);
      if (!lote) continue;
      let grupo = grupos.get(planta.sprite);
      if (!grupo) {
        grupo = { lote, itens: [] };
        grupos.set(planta.sprite, grupo);
      }
      const wx = ORIGEM + ix;
      const wz = ORIGEM + iz;
      const jx = (hash2(wx, wz, seed + 42) - 0.5) * 0.55;
      const jz = (hash2(wx, wz, seed + 77) - 0.5) * 0.55;
      const variacao = 0.86 + hash2(wx, wz, seed + 19) * 0.28;
      const y =
        alturas[iz * LADO + ix] * ALTURA_BLOCO -
        (1 - lote.pivotY) * lote.altura * variacao;
      grupo.itens.push({ x: ix + 0.5 + jx, y, z: iz + 0.5 + jz, s: variacao });
    }
  }

  for (const grupo of grupos.values()) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);
    const mesh = new THREE.InstancedMesh(geo, grupo.lote.material, grupo.itens.length);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.customDepthMaterial = grupo.lote.depth;
    mesh.frustumCulled = false;
    mesh.count = grupo.itens.length;
    mesh.userData.itens = grupo.itens;
    mesh.userData.largura = grupo.lote.largura;
    mesh.userData.altura = grupo.lote.altura;
    grupoProps.add(mesh);
  }
  propsSujos = true;
  yawCartaz = null;
}

function escreverCartazes(yaw) {
  if (!grupoProps) return;
  for (let g = 0; g < grupoProps.children.length; g++) {
    const mesh = grupoProps.children[g];
    const itens = mesh.userData.itens;
    if (!itens) continue;
    const largura = mesh.userData.largura;
    const altura = mesh.userData.altura;
    for (let i = 0; i < itens.length; i++) {
      const p = itens[i];
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(largura * p.s, altura * p.s, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}

function yawDaCamera() {
  return Math.atan2(camera.position.x - alvo.x, camera.position.z - alvo.z);
}

function atualizarCartazes() {
  const yaw = yawDaCamera();
  const mudou = yawCartaz == null
    || Math.abs(Math.atan2(Math.sin(yaw - yawCartaz), Math.cos(yaw - yawCartaz))) > VEG_YAW_EPS;
  if (!mudou && !propsSujos) return;
  yawCartaz = yaw;
  propsSujos = false;
  escreverCartazes(yaw);
}

function aproximarAngulo(atual, destino, t) {
  const d = Math.atan2(Math.sin(destino - atual), Math.cos(destino - atual));
  return atual + d * t;
}

function aplicarCamera() {
  const r = Math.sin(pol) * dist;
  camera.position.set(
    alvo.x + Math.sin(az) * r,
    alvo.y + Math.cos(pol) * dist,
    alvo.z + Math.cos(az) * r,
  );
  camera.lookAt(alvo);
  sol.position.set(alvo.x + 26, alvo.y + 42, alvo.z + 14);
  sol.target.position.copy(alvo);
  sol.target.updateMatrixWorld();
}

function enquadrar(imediato) {
  const meio = LADO * 0.5;
  const cy = ((minBloco + maxBloco) * 0.5) * ALTURA_BLOCO;
  alvo.set(meio, Math.max(cy, baseY + 1.2), meio);
  const alcance = Math.max(LADO * 0.9, (maxBloco - minBloco) * ALTURA_BLOCO + 5);
  distAlvo = Math.max(18, alcance * 1.08);
  azAlvo = 0.65;
  polAlvo = 1.16;
  if (imediato) {
    dist = distAlvo;
    az = azAlvo;
    pol = polAlvo;
    aplicarCamera();
    atualizarCartazes();
  }
}

function ajustarTamanho() {
  if (!canvas || !renderer || !camera) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w < 2 || h < 2) return;
  const bufW = Math.floor(w * Math.min(window.devicePixelRatio || 1, 2));
  const bufH = Math.floor(h * Math.min(window.devicePixelRatio || 1, 2));
  if (canvas.width === bufW && canvas.height === bufH) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

function quadro(agora) {
  if (!vivo) return;
  raf = requestAnimationFrame(quadro);
  ajustarTamanho();
  const dt = Math.min(0.05, (agora - (quadro.antes || agora)) / 1000);
  quadro.antes = agora;
  const k = 1 - Math.exp(-dt * 14);
  az = aproximarAngulo(az, azAlvo, k);
  pol += (polAlvo - pol) * k;
  dist += (distAlvo - dist) * k;
  aplicarCamera();
  atualizarCartazes();
  renderer.render(cena, camera);
}

function aplicarPedido(dados) {
  if (!pronto || !dados?.bioma) return;
  const alturas = montarRelevo(dados.bioma, dados.catalogo, dados.seed | 0);
  montarProps(dados.bioma, alturas, dados.seed | 0);
  const id = dados.bioma.id;
  if (id !== idEnquadrado) {
    idEnquadrado = id;
    enquadrar(true);
  }
}

function agendar() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const atual = pedido;
    if (!atual) return;
    try {
      aplicarPedido(atual);
    } catch (erro) {
      console.error(erro);
    }
  }, 50);
}

function aoPonteiroBaixo(ev) {
  if (ev.button !== 0 && ev.button !== 1 && ev.button !== 2) return;
  arraste = {
    x: ev.clientX,
    y: ev.clientY,
    modo: ev.button === 2 || ev.button === 1 || ev.shiftKey ? "pan" : "orbit",
  };
  canvas.setPointerCapture(ev.pointerId);
  canvas.classList.add("arrastando");
}

function aoPonteiroMover(ev) {
  if (!arraste) return;
  const dx = ev.clientX - arraste.x;
  const dy = ev.clientY - arraste.y;
  arraste.x = ev.clientX;
  arraste.y = ev.clientY;
  if (arraste.modo === "orbit") {
    azAlvo -= dx * 0.008;
    polAlvo = Math.max(0.28, Math.min(1.28, polAlvo + dy * 0.005));
    return;
  }
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const direita = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
  const frente = new THREE.Vector3(dir.x, 0, dir.z);
  if (frente.lengthSq() < 1e-6) frente.set(0, 0, -1);
  frente.normalize();
  const escala = dist * 0.0016;
  alvo.x += (-direita.x * dx + frente.x * dy) * escala;
  alvo.z += (-direita.z * dx + frente.z * dy) * escala;
}

function aoPonteiroCima(ev) {
  arraste = null;
  canvas.classList.remove("arrastando");
  if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
}

function aoRoda(ev) {
  ev.preventDefault();
  distAlvo = Math.max(10, Math.min(140, distAlvo * Math.exp(ev.deltaY * 0.0014)));
}

function materialRelevo(parede) {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: parede ? 0.9 : 0.94,
    metalness: 0.02,
    vertexColors: true,
    polygonOffset: parede,
    polygonOffsetFactor: parede ? 1 : 0,
    polygonOffsetUnits: parede ? 1 : 0,
  });
}

export async function iniciarPreviewBioma(elemento) {
  canvas = elemento;
  visuais = await carregarVisuaisKits();

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  cena = new THREE.Scene();
  cena.background = new THREE.Color(0x8eafc2);
  cena.fog = new THREE.Fog(0xb7cdc4, 70, 150);

  camera = new THREE.PerspectiveCamera(40, 1, 0.12, 400);

  cena.add(new THREE.HemisphereLight(0xd5ebf6, 0x3c4a34, 0.46));
  cena.add(new THREE.AmbientLight(0xfff3e4, 0.2));

  sol = new THREE.DirectionalLight(0xfff0d8, 1.75);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  sol.shadow.camera.near = 2;
  sol.shadow.camera.far = 140;
  sol.shadow.camera.left = -70;
  sol.shadow.camera.right = 70;
  sol.shadow.camera.top = 70;
  sol.shadow.camera.bottom = -70;
  sol.shadow.camera.updateProjectionMatrix();
  sol.shadow.bias = -0.00025;
  sol.shadow.normalBias = 0.035;
  cena.add(sol);
  cena.add(sol.target);

  const fill = new THREE.DirectionalLight(0x9eb6cc, 0.34);
  fill.position.set(-22, 14, -12);
  cena.add(fill);
  const rim = new THREE.DirectionalLight(0xf0a86a, 0.32);
  rim.position.set(-6, 8, 24);
  cena.add(rim);

  malhaTopo = new THREE.Mesh(new THREE.BufferGeometry(), materialRelevo(false));
  malhaTopo.castShadow = true;
  malhaTopo.receiveShadow = true;
  malhaParede = new THREE.Mesh(new THREE.BufferGeometry(), materialRelevo(true));
  malhaParede.castShadow = true;
  malhaParede.receiveShadow = true;
  cena.add(malhaTopo, malhaParede);

  disco = new THREE.Mesh(
    new THREE.CircleGeometry(LADO * 0.92, 64),
    new THREE.MeshStandardMaterial({ color: 0x243028, roughness: 1, metalness: 0 }),
  );
  disco.rotation.x = -Math.PI / 2;
  disco.receiveShadow = true;
  cena.add(disco);

  grupoProps = new THREE.Group();
  cena.add(grupoProps);

  canvas.addEventListener("pointerdown", aoPonteiroBaixo);
  canvas.addEventListener("pointermove", aoPonteiroMover);
  canvas.addEventListener("pointerup", aoPonteiroCima);
  canvas.addEventListener("pointercancel", aoPonteiroCima);
  canvas.addEventListener("wheel", aoRoda, { passive: false });
  canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());
  canvas.addEventListener("dblclick", (ev) => {
    ev.preventDefault();
    enquadrar(false);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      vivo = false;
      cancelAnimationFrame(raf);
      return;
    }
    if (!vivo) {
      vivo = true;
      quadro.antes = performance.now();
      raf = requestAnimationFrame(quadro);
    }
  });

  pronto = true;
  vivo = true;
  ajustarTamanho();
  if (pedido) agendar();
  quadro.antes = performance.now();
  raf = requestAnimationFrame(quadro);
}

export function atualizarPreviewBioma(proximo) {
  pedido = proximo;
  if (!pronto) return;
  agendar();
}
