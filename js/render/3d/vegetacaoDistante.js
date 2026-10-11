import * as THREE from "three";
import { aplicarLuzBillboard } from "./ceu/luzBillboard.js";
import { aplicarSombraNuvem } from "./ceu/sombraNuvem.js";
import {
  ALTURA_BLOCO,
  CHUNK_XZ,
  IMPOSTOR_CAP,
  TILE,
  VEG_ALPHA_TEST,
  VEG_ARVORE_ESCALA,
  VEG_YAW_EPS,
} from "../../config.js";
import { alturaDoRelevo, obterCatalogo, obterSementeBioma, plantaDoRelevo } from "../../mundo/bioma/catalogo.js";
import { chunksComProps } from "../../mundo/bioma/propsBioma.js";
import { hash2 } from "../../mundo/voxel/ruido.js";
import { COLUNAS, LINHAS } from "../../mundo/regioes/mapaDemoPatch.js";
import { obterRaioStream } from "../../mundo/voxel/storeMundo.js";
import { obterRaioSuave } from "./terrenoSuave.js";
import { fracaoBaseDoProp } from "../pivoProfundidade.js";
import { registrarObjetoCena, removerObjetoCena } from "../../cena/registroCena.js";
import { usarRaycastBillboard } from "../../cena/selecaoCena.js";

/**
 * Árvores billboard em todo o disco suave, fora dos chunks de bloco.
 * Mesmo sorteio do perto. Sem card de grama e sem sombra no shadow map.
 */
export function criarVegetacaoDistante() {
  const grupo = new THREE.Group();
  grupo.name = "vegetacao-distante";
  grupo.visible = false;

  const dummy = new THREE.Object3D();
  /** @type {Map<string, { arvores: object[] }>} */
  const cache = new Map();
  /** @type {Map<string, object>} */
  const lotes = new Map();
  let atlasAtual = null;
  let trabalho = null;
  let sigBanda = "";
  let sigProps = "";
  let geracao = 0;
  let geracaoPublicada = -1;
  let yawAplicado = null;

  function imagemDe(sprite) {
    if (!atlasAtual || !sprite) return null;
    return atlasAtual.sprites?.[sprite] || atlasAtual.arvore || null;
  }

  function soltarLote(lote) {
    removerObjetoCena(lote.mesh?.userData?.cenaId);
    grupo.remove(lote.mesh);
    lote.material.dispose();
    lote.textura.dispose();
    lote.geo.dispose();
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

  function medidasDe(img) {
    const pw = img.naturalWidth || img.width || TILE;
    const ph = img.naturalHeight || img.height || TILE;
    return {
      largura: (pw / TILE) * VEG_ARVORE_ESCALA,
      altura: (ph / TILE) * VEG_ARVORE_ESCALA,
    };
  }

  function montarLote(sprite, amostra, img) {
    const anterior = lotes.get(sprite);
    if (anterior) soltarLote(anterior);
    const tex = criarTextura(img);
    const material = aplicarSombraNuvem(
      aplicarLuzBillboard(
        new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 1,
          metalness: 0,
          transparent: false,
          alphaTest: VEG_ALPHA_TEST,
          depthWrite: true,
          depthTest: true,
          side: THREE.FrontSide,
        }),
      ),
    );
    const geo = new THREE.PlaneGeometry(1, 1);
    const p = fracaoBaseDoProp(amostra);
    geo.translate(0, 0.5 - (Number.isFinite(p) ? p : 0), 0);
    const mesh = new THREE.InstancedMesh(geo, material, IMPOSTOR_CAP);
    mesh.name = `impostor-${sprite}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;
    mesh.count = 0;
    grupo.add(mesh);
    const lote = { sprite, mesh, material, textura: tex, geo, img, itens: [], largura: 1, altura: 1 };
    lotes.set(sprite, lote);
    usarRaycastBillboard(mesh, () => lote);
    registrarObjetoCena(mesh, {
      id: mesh.name,
      pasta: "Vegetação",
      rotulo: mesh.name,
      tipo: "instâncias",
      obterInstancia: (i) => lote.itens[i] || null,
    });
    return lote;
  }

  function escrever(yaw) {
    let algum = false;
    for (const lote of lotes.values()) {
      const img = lote.img;
      const { largura, altura } = medidasDe(img);
      const itens = lote.itens;
      lote.largura = largura;
      lote.altura = altura;
      lote.mesh.count = itens.length;
      lote.mesh.visible = itens.length > 0;
      if (!itens.length) continue;
      algum = true;
      for (let i = 0; i < itens.length; i++) {
        const p = itens[i];
        dummy.position.set(p.x, p.h * ALTURA_BLOCO, p.y);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(largura, altura, 1);
        dummy.updateMatrix();
        lote.mesh.setMatrixAt(i, dummy.matrix);
      }
      lote.mesh.instanceMatrix.needsUpdate = true;
      lote.mesh.computeBoundingBox();
      lote.mesh.computeBoundingSphere();
    }
    grupo.visible = algum;
  }

  function publicar(banda) {
    const props = chunksComProps();
    const todos = [];
    for (let i = 0; i < banda.lista.length; i++) {
      const ch = banda.lista[i];
      if (props.has(ch.k)) continue;
      const salvo = cache.get(ch.k);
      if (!salvo) continue;
      const arvores = salvo.arvores;
      for (let j = 0; j < arvores.length; j++) todos.push(arvores[j]);
    }
    const escolhidas = espalhar(todos);

    const grupos = new Map();
    for (let i = 0; i < escolhidas.length; i++) {
      const item = escolhidas[i];
      let lista = grupos.get(item.sprite);
      if (!lista) {
        lista = [];
        grupos.set(item.sprite, lista);
      }
      lista.push(item);
    }

    for (const [sprite, itens] of grupos) {
      const img = imagemDe(sprite);
      let lote = lotes.get(sprite);
      if (!img) {
        if (lote) {
          lote.itens = [];
          lote.mesh.count = 0;
          lote.mesh.visible = false;
        }
        continue;
      }
      if (!lote || lote.img !== img) lote = montarLote(sprite, itens[0], img);
      lote.itens = itens;
    }
    for (const [sprite, lote] of lotes) {
      if (grupos.has(sprite)) continue;
      lote.itens = [];
      lote.mesh.count = 0;
      lote.mesh.visible = false;
    }
    geracaoPublicada = geracao;
    yawAplicado = null;
  }

  function faltaCache(banda) {
    for (let i = 0; i < banda.lista.length; i++) {
      if (!cache.has(banda.lista[i].k)) return true;
    }
    return false;
  }

  function podarCache(banda) {
    const fica = new Set();
    for (let i = 0; i < banda.lista.length; i++) fica.add(banda.lista[i].k);
    for (const k of cache.keys()) {
      if (!fica.has(k)) cache.delete(k);
    }
  }

  function* varrer(banda) {
    for (let i = 0; i < banda.lista.length; i++) {
      const ch = banda.lista[i];
      if (cache.has(ch.k)) continue;
      cache.set(ch.k, { arvores: arvoresDoChunk(ch.cx, ch.cy) });
      geracao += 1;
      yield;
    }
  }

  function tick(px, py, yawCam) {
    const banda = montarBanda(px, py);
    if (banda.sig !== sigBanda) {
      sigBanda = banda.sig;
      trabalho = null;
      podarCache(banda);
    }
    if (!trabalho && faltaCache(banda)) {
      trabalho = varrer(banda);
    }
    if (trabalho) {
      const t0 = performance.now();
      let passo;
      while (performance.now() - t0 < 3) {
        passo = trabalho.next();
        if (passo.done) break;
      }
      if (passo?.done) trabalho = null;
    }

    const propsSig = assinaturaProps();
    if (geracao !== geracaoPublicada || propsSig !== sigProps) {
      sigProps = propsSig;
      publicar(banda);
    }

    const yaw = Number.isFinite(yawCam) ? yawCam : 0;
    if (yawAplicado == null || yawDiferente(yaw, yawAplicado)) {
      yawAplicado = yaw;
      escrever(yaw);
    }
  }

  function aplicarAtlas(atlas) {
    atlasAtual = atlas;
    geracaoPublicada = -1;
  }

  return {
    grupo,
    tick,
    aplicarAtlas,
    liberar() {
      trabalho = null;
      cache.clear();
      for (const lote of lotes.values()) soltarLote(lote);
      lotes.clear();
    },
  };
}

function yawDiferente(atual, aplicado) {
  const d = Math.atan2(Math.sin(atual - aplicado), Math.cos(atual - aplicado));
  return Math.abs(d) > VEG_YAW_EPS;
}

function assinaturaProps() {
  const props = chunksComProps();
  if (!props.size) return "";
  return [...props].sort().join("|");
}

function tetoArvore() {
  const biomas = obterCatalogo()?.biomas || [];
  let teto = 0;
  for (let i = 0; i < biomas.length; i++) {
    const n = Number(biomas[i].arvore) || 0;
    if (n > teto) teto = n;
  }
  return teto;
}

function montarBanda(px, py) {
  const raioB = obterRaioStream();
  const raioE = obterRaioSuave();
  const pcx = Math.floor(px / CHUNK_XZ);
  const pcy = Math.floor(py / CHUNK_XZ);
  const sig = `${pcx},${pcy},${raioB},${raioE}`;
  const lista = [];
  if (!(raioE > raioB)) return { sig, lista };
  const dentroB = raioB * raioB + 1;
  const dentroE = raioE * raioE + 1;
  for (let dy = -raioE; dy <= raioE; dy++) {
    for (let dx = -raioE; dx <= raioE; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 <= dentroB || d2 > dentroE) continue;
      const cx = pcx + dx;
      const cy = pcy + dy;
      lista.push({ cx, cy, k: `${cx},${cy}`, d2 });
    }
  }
  lista.sort((a, b) => a.d2 - b.d2);
  return { sig, lista };
}

/**
 * Um card por região antes de repetir região. O disco inteiro aparece,
 * em vez de um anel só em volta do jogador.
 */
function espalhar(todos) {
  if (todos.length <= IMPOSTOR_CAP) return todos;
  const raioB = obterRaioStream();
  const raioE = obterRaioSuave();
  const area = Math.PI * Math.max(1, raioE * raioE - raioB * raioB) * CHUNK_XZ * CHUNK_XZ;
  const lado = Math.max(CHUNK_XZ, Math.sqrt(area / IMPOSTOR_CAP));
  const baldes = new Map();
  for (let i = 0; i < todos.length; i++) {
    const item = todos[i];
    const k = `${Math.floor(item.x / lado)},${Math.floor(item.y / lado)}`;
    let lista = baldes.get(k);
    if (!lista) {
      lista = [];
      baldes.set(k, lista);
    }
    lista.push(item);
  }
  const chaves = [...baldes.keys()].sort();
  for (let i = 0; i < chaves.length; i++) {
    baldes.get(chaves[i]).sort((a, b) => hash2(a.x | 0, a.y | 0, 1) - hash2(b.x | 0, b.y | 0, 1));
  }
  const saida = [];
  let rodada = 0;
  while (saida.length < IMPOSTOR_CAP) {
    let avancou = false;
    for (let i = 0; i < chaves.length; i++) {
      const lista = baldes.get(chaves[i]);
      if (rodada >= lista.length) continue;
      saida.push(lista[rodada]);
      avancou = true;
      if (saida.length >= IMPOSTOR_CAP) break;
    }
    if (!avancou) break;
    rodada += 1;
  }
  return saida;
}

function arvoresDoChunk(cx, cy) {
  const baseX = cx * CHUNK_XZ;
  const baseY = cy * CHUNK_XZ;
  const seed = obterSementeBioma();
  const teto = tetoArvore();
  const arvores = [];
  if (!(teto > 0)) return arvores;
  const alturas = new Float32Array(CHUNK_XZ * CHUNK_XZ);
  const tem = new Uint8Array(CHUNK_XZ * CHUNK_XZ);
  const alturaLocal = (lx, ly) => {
    const i = ly * CHUNK_XZ + lx;
    if (tem[i]) return alturas[i];
    tem[i] = 1;
    alturas[i] = alturaDoRelevo(baseX + lx, baseY + ly);
    return alturas[i];
  };
  for (let ly = 0; ly < CHUNK_XZ; ly++) {
    for (let lx = 0; lx < CHUNK_XZ; lx++) {
      const wx = baseX + lx;
      const wy = baseY + ly;
      if (wx >= 0 && wy >= 0 && wx < COLUNAS && wy < LINHAS) continue;
      if (hash2(wx, wy, seed + 9001) >= teto) continue;
      const planta = plantaDoRelevo(wx, wy);
      if (!planta || planta.classe !== "arvore") continue;
      if (ehCliff(lx, ly, alturaLocal)) continue;
      arvores.push({
        x: wx + 0.5,
        y: wy + 0.5,
        h: alturaLocal(lx, ly),
        sprite: planta.sprite,
        tipo: "arvore",
      });
    }
  }
  return arvores;
}

function ehCliff(lx, ly, alturaLocal) {
  const h = alturaLocal(lx, ly);
  const lados = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let i = 0; i < lados.length; i++) {
    const nx = lx + lados[i][0];
    const ny = ly + lados[i][1];
    if (nx < 0 || ny < 0 || nx >= CHUNK_XZ || ny >= CHUNK_XZ) continue;
    if (h - alturaLocal(nx, ny) >= 2) return true;
  }
  return false;
}
