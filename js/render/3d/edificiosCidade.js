import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { CHUNK_XZ, TILE } from "../../config.js";
import { obterRaioStream } from "../../mundo/voxel/storeMundo.js";
import { CIDADES_KANTO } from "../../mundo/regiao/kantoCidades.js";
import { AREA_KANTO } from "../../mundo/regiao/grafoKanto.js";
import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { postesDeRua } from "../../mundo/regiao/decoracaoKanto.js";
import { montarLayout } from "../../mundo/regiao/volumesCidade.js";
import { carregarCatalogoLuzes, pontosDoModelo } from "./luzes/catalogo.js";
import { criarCartaoLuz, obterPesoNoite } from "./luzes/pool.js";
import { aplicarLuzCidade, oferecerLuzChao } from "./luzes/mapaChao.js";
import { aplicarLuzBillboard, aplicarProfundidadeVolume } from "./ceu/luzBillboard.js";
import { pivoDaImagem } from "../pivoPe.js";
import { idsVisuais, origemDoModelo, urlDoModelo } from "../../mundo/cidade/catalogoCasas.js";
import { anexarCascaSala, anexarDecoracaoCidade, anexarInteriores, carregarSpritesPraca, criarDecoracaoRotas } from "./decoracaoCidade.js";
import { atualizarLaboratorio, montarLaboratorio3d } from "./laboratorio3d.js";
import { atualizarCentro, montarCentro3d } from "./centro3d.js";
import { montarLoja3d } from "./loja3d.js";
import { carregarSpritesPredio, chaveSpritePredio, criarSpritePredio, montarUsina } from "./prediosSprite.js";

const FOLGA = 0.96;
const LADO_X = 6;
const LADO_Z = 5;
const ALFA_SPRITE = 0.12;
const FOLHAS_CASA = 5;
const PX_MUNDO = 1 / TILE;
const ALTURA_POSTE = 3.6;
const _ponto = new THREE.Vector3();
const COR_JANELA = 0xb9d7ff;
const materiaisJanela = [];
let materialFlare = null;
let materialGlobo = null;

function materialDaJanela(mapa) {
  if (mapa) {
    mapa.colorSpace = THREE.SRGBColorSpace;
    mapa.magFilter = THREE.NearestFilter;
    mapa.minFilter = THREE.NearestFilter;
    mapa.generateMipmaps = false;
    mapa.needsUpdate = true;
  }
  const mat = new THREE.MeshLambertMaterial({
    name: "h_mado",
    map: mapa || null,
    color: 0xffffff,
    emissive: COR_JANELA,
    emissiveMap: mapa || null,
    emissiveIntensity: 1,
  });
  aplicarLuzCidade(mat);
  materiaisJanela.push(mat);
  return mat;
}

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

function yawDaRua(mx, my) {
  const dx = mx - 64;
  const dy = my - 64;
  if (Math.abs(dy) <= Math.abs(dx)) return dy > 0 ? Math.PI : 0;
  return dx > 0 ? -Math.PI / 2 : Math.PI / 2;
}

function carregarObj(id) {
  const origem = origemDoModelo(id);
  const base = origem ? urlDoModelo(origem.base) : `assets/models/cidade/${id}/`;
  const arquivo = origem?.arquivo || "modelo.obj";
  const mtl = arquivo.replace(/\.obj$/i, ".mtl");
  return new Promise((resolve, reject) => {
    const mats = new MTLLoader();
    mats.setResourcePath(base);
    mats.load(
      `${base}${urlDoModelo(mtl)}`,
      (pronto) => {
        pronto.preload();
        const obj = new OBJLoader();
        obj.setMaterials(pronto);
        obj.load(`${base}${urlDoModelo(arquivo)}`, resolve, undefined, reject);
      },
      undefined,
      reject,
    );
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

function ajustarMaterial(mat) {
  const lista = Array.isArray(mat) ? mat : [mat];
  for (let i = 0; i < lista.length; i++) {
    const m = lista[i];
    if (!m) continue;
    const novo = new THREE.MeshLambertMaterial({
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

function preparar(raiz, volume) {
  const multi = [];
  raiz.traverse((filho) => {
    if (filho.isMesh && Array.isArray(filho.material)) multi.push(filho);
  });
  for (let i = 0; i < multi.length; i++) partirMultiMaterial(multi[i]);
  raiz.traverse((filho) => {
    if (!filho.isMesh) return;
    const nome = (filho.material?.name || "").toLowerCase();
    if (nome.includes("kage")) {
      filho.visible = false;
      filho.castShadow = false;
      filho.receiveShadow = false;
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
    if (nome === "h_mado") {
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
  raiz.updateMatrixWorld(true);
  const caixa = new THREE.Box3().setFromObject(raiz);
  if (volume) marcarVolume(raiz, caixa.min.y);
  const grupo = new THREE.Group();
  raiz.position.set(
    -((caixa.min.x + caixa.max.x) * 0.5),
    -caixa.min.y,
    -((caixa.min.z + caixa.max.z) * 0.5),
  );
  grupo.add(raiz);
  grupo.scale.setScalar(1);
  grupo.userData.janelas = centrosJanela(grupo);
  return {
    grupo,
    sx: caixa.max.x - caixa.min.x,
    sz: caixa.max.z - caixa.min.z,
    sy: caixa.max.y - caixa.min.y,
  };
}

function escalaDoLote(medido) {
  return Math.min(LADO_X / medido.sx, LADO_Z / medido.sz) * FOLGA;
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

function pendurarLuzes(inst, id, dono) {
  let pontos = pontosDoModelo(id);
  if (!pontos.length) pontos = inst.userData.janelas || [];
  if (!pontos.length) return;
  inst.userData.modeloLuz = id;
  inst.userData.donoLuz = dono;
  inst.userData.pontosLuz = pontos;
  for (let i = 0; i < pontos.length; i++) {
    const p = pontos[i];
    const cartao = criarCartaoLuz(p.cor, p.raio);
    cartao.position.set(p.x, p.y, p.z);
    inst.add(cartao);
  }
}

export function carregarMoldeCidade(id) {
  return carregarObj(id).then((raiz) => {
    const medido = preparar(raiz, id === "poste");
    const escala = id === "poste" ? ALTURA_POSTE / medido.sy : escalaDoLote(medido);
    medido.grupo.scale.setScalar(escala);
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
  const geo = new THREE.PlaneGeometry(folha.largura, folha.altura);
  geo.translate(folha.largura * (0.5 - folha.pivo.x), folha.altura * (folha.pivo.y - 0.5), 0);
  if (!folha.material) folha.material = materialDoCartao(folha.tex);
  const mesh = new THREE.Mesh(geo, folha.material);
  mesh.name = "casa-cartao";
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.rotation.order = "YXZ";
  const raiz = new THREE.Group();
  raiz.add(mesh);
  raiz.userData.cartao = mesh;
  return raiz;
}

function montarCidade(moldes, folhas, def, sprites, predios) {
  const layout = montarLayout(def);
  const grupo = new THREE.Group();
  grupo.name = `cidade-${def.key}`;
  const ox = def.ax * AREA_KANTO;
  const oy = def.ay * AREA_KANTO;
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
    const spriteId = chaveSpritePredio(v.papel, def.ginasio);
    const folhaPredio = spriteId ? predios?.get(spriteId) : null;
    if (folhaPredio) {
      const sprite = criarSpritePredio(folhaPredio);
      sprite.position.set(ox + mx, ALTURA_PRACA, oy + my);
      grupo.add(sprite);
      continue;
    }
    const id = v.modelo;
    const molde = id ? moldes.get(id) : null;
    if (!molde) continue;
    const inst = molde.grupo.clone(true);
    inst.rotation.y = v.papel === "casa" || v.papel === "lab" ? 0 : yawDaRua(mx, my);
    inst.position.set(ox + mx, ALTURA_PRACA, oy + my);
    pendurarLuzes(inst, id, `${def.key}:${i}`);
    grupo.add(inst);
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
  return {
    grupo,
    cx: ox + 64,
    cy: oy + 64,
  };
}

export function criarEdificiosCidade() {
  const grupo = new THREE.Group();
  grupo.name = "edificios-cidade";
  const ids = MODELOS_CIDADE;
  const cargas = ids.map((id) => carregarObj(id).then((raiz) => [id, { grupo: raiz }]));
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
        const escala = id === "poste" ? ALTURA_POSTE / medido.sy : escalaDoLote(medido);
        medido.grupo.scale.setScalar(escala);
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
      anexarCascaSala(sala, sprites?.piso);
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
    })
    .catch((erro) => {
      console.error("modelos da cidade", erro);
    });

  montarLaboratorio3d(grupo);
  montarCentro3d(grupo);
  montarLoja3d(grupo);

  return {
    grupo,
    atualizar(px, py, yaw = 0, inclinacao = 0) {
      atualizarLaboratorio(yaw, inclinacao, px, py);
      atualizarCentro(px, py);
      const pesoNoite = obterPesoNoite();
      if (materialFlare) materialFlare.opacity = pesoNoite;
      if (materialGlobo) materialGlobo.emissiveIntensity = pesoNoite;
      for (let j = 0; j < materiaisJanela.length; j++) materiaisJanela[j].emissiveIntensity = pesoNoite;
      const cidades = grupo.userData.cidades;
      if (!cidades) return;
      const alcance = (obterRaioStream() + 2) * CHUNK_XZ + 96;
      const limite = alcance * alcance;
      for (let i = 0; i < cidades.length; i++) {
        const c = cidades[i];
        const dx = px - c.cx;
        const dy = py - c.cy;
        const visivel = dx * dx + dy * dy < limite;
        c.grupo.visible = visivel;
        if (!visivel) continue;
        const filhos = c.grupo.children;
        for (let f = 0; f < filhos.length; f++) {
          const inst = filhos[f];
          const cartao = inst.userData.cartao;
          if (cartao) {
            cartao.rotation.x = inclinacao;
            cartao.rotation.y = yaw;
          }
          const pontos = inst.userData.pontosLuz;
          if (!pontos) continue;
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
              ponto.intensidade,
            );
          }
        }
      }
      const sala = grupo.userData.sala;
      if (sala) {
        const pecas = sala.children;
        for (let f = 0; f < pecas.length; f++) {
          const cartao = pecas[f].userData.cartao;
          if (!cartao) continue;
          cartao.rotation.x = inclinacao;
          cartao.rotation.y = yaw;
        }
      }
    },
  };
}
