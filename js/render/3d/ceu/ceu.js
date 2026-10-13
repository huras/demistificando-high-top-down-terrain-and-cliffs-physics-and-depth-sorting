import * as THREE from "three";
import { criarAtmosfera } from "./atmosfera.js";
import { avaliarClima } from "./clima.js";
import { avaliarVisual } from "./ciclo.js";
import {
  alternarClima,
  avancarCiclo,
  avancarHora,
  definirCiclo,
  definirClima,
  definirHora,
  nomeClima,
  nomeFase,
  obterControleCeu,
  textoHora,
} from "./controleCeu.js";
import { obterMapaNuvem } from "./mapaNuvem.js";
import {
  ALTURA_NUVEM,
  DURACAO_DIA,
  ESCALA_NUVEM,
  uniformsNuvem,
} from "./parametros.js";
import { atualizarPoca } from "./pocaChao.js";
import { criarPrecipitacao } from "./precipitacao.js";
import { atualizarLuzBillboard } from "./luzBillboard.js";
import { definirPesoNoite } from "../luzes/pool.js";
import { criarRelampago } from "./relampago.js";

export {
  alternarClima,
  avancarHora,
  definirCiclo,
  definirClima,
  definirHora,
  nomeClima,
  nomeFase,
  obterControleCeu,
  textoHora,
};

const DIST_LUZ = 72;
/** Piso do volume. Abaixo disso a sombra fica mais perto que o terreno visível. */
const ALCANCE_SOMBRA_MIN = 34;
const vento = new THREE.Vector2();
const dirVento = new THREE.Vector2(0.82, 0.57).normalize();
const corFill = new THREE.Color();
const corRim = new THREE.Color();

/**
 * Céu do modo 3D.
 * Um mapa tileável alimenta o domo e a sombra no terreno. O vento desloca os dois
 * juntos; a cisalha empurra a sombra na direção do sol.
 */
export function criarCeu({ scene, renderer, sol, hemi, ambient, fill, rim }) {
  const mapa = obterMapaNuvem();
  mapa.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  uniformsNuvem.uMapaNuvem.value = mapa;

  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  let alcanceSombra = ALCANCE_SOMBRA_MIN;
  aplicarAlcanceSombra(sol, alcanceSombra);

  const atmosfera = criarAtmosfera();
  const precipitacao = criarPrecipitacao();
  const relampago = criarRelampago();
  scene.add(atmosfera.mesh, precipitacao.mesh, relampago.grupo);
  scene.add(fill.target, rim.target);

  function aplicarLuzes(visual, alvo) {
    const dir = visual.dirLuz;
    const recuo = Math.max(DIST_LUZ, alcanceSombra + 16);
    sol.position.set(alvo.x + dir.x * recuo, alvo.y + dir.y * recuo, alvo.z + dir.z * recuo);
    sol.target.position.set(alvo.x, alvo.y, alvo.z);
    sol.intensity = visual.intensidadeSol;
    sol.color.copy(visual.lua).lerp(visual.sol, visual.pesoDia);
    sol.castShadow = visual.intensidadeSol > 0.12;

    hemi.color.copy(visual.zenite);
    hemi.groundColor.copy(visual.chao);
    hemi.intensity = visual.hemi;

    ambient.color.copy(visual.neblina);
    ambient.intensity = visual.ambiente;

    corFill.copy(visual.zenite).lerp(visual.lua, 1 - visual.pesoDia);
    fill.color.copy(corFill);
    fill.intensity = visual.fill;
    fill.position.set(alvo.x - dir.x * 24, alvo.y + 10, alvo.z - dir.z * 24);
    fill.target.position.set(alvo.x, alvo.y, alvo.z);

    corRim.copy(visual.sol);
    rim.color.copy(corRim);
    rim.intensity = visual.rim;
    rim.position.set(alvo.x - dir.z * 16, alvo.y + 7, alvo.z + dir.x * 16);
    rim.target.position.set(alvo.x, alvo.y, alvo.z);

    atualizarLuzBillboard({ sol, ambient, hemi, fill, rim });
    definirPesoNoite(1 - visual.pesoDia);
  }

  function aplicarNevoa(visual, clima, nevoa) {
    if (!scene.fog || !nevoa) return;
    const perto = Math.max(6, nevoa.near * clima.neblinaPerto);
    let longe = nevoa.far * clima.neblinaLonge;
    if (longe < perto + 10) longe = perto + 10;
    scene.fog.color.copy(visual.neblina);
    scene.fog.near = perto;
    scene.fog.far = longe;
    if (scene.background?.isColor) scene.background.copy(visual.neblina);
  }

  function atualizar(dt, { camera, alvo, nevoa, raioBlocos }) {
    const seguro = Math.min(Math.max(dt || 0, 0), 0.05);
    const meio = Math.max(ALCANCE_SOMBRA_MIN, raioBlocos || 0);
    if (meio !== alcanceSombra) {
      alcanceSombra = meio;
      aplicarAlcanceSombra(sol, meio);
    }
    const hora = avancarCiclo(seguro, DURACAO_DIA);
    const clima = avaliarClima(seguro);
    const visual = avaliarVisual(hora, clima, obterControleCeu());
    const pesoCirrus = smooth(0.2, 0.5, clima.limiar) * (0.25 + visual.brilhoSol * 0.75);

    aplicarNuvemPasso(visual, clima, seguro);
    aplicarLuzes(visual, alvo);
    aplicarNevoa(visual, clima, nevoa);

    const flash = relampago.atualizar(seguro, clima.raio, alvo);
    atmosfera.atualizar(visual, camera, flash * 0.55, pesoCirrus, seguro);
    precipitacao.atualizar(clima, dirVento, seguro, camera, renderer);
    atualizarPoca(seguro, clima.chuva, visual);
    renderer.toneMappingExposure = visual.exposicao * (1 + flash * 1.35);
  }

  function aplicarNuvemPasso(visual, clima, dt) {
    const periodo = 1 / ESCALA_NUVEM;
    vento.x += dirVento.x * clima.vento * dt;
    vento.y += dirVento.y * clima.vento * dt;
    vento.x -= Math.floor(vento.x / periodo) * periodo;
    vento.y -= Math.floor(vento.y / periodo) * periodo;
    uniformsNuvem.uVentoNuvem.value.copy(vento);
    uniformsNuvem.uEscalaNuvem.value = ESCALA_NUVEM;
    uniformsNuvem.uAlturaNuvem.value = ALTURA_NUVEM;
    uniformsNuvem.uLimiarNuvem.value = clima.limiar;
    uniformsNuvem.uUmidade.value = clima.umidade;

    const elev = visual.dirSol.y;
    const apaga = elev > 0.04 ? smooth(0.08, 0.4, elev) : 0.22 * visual.brilhoLua;
    uniformsNuvem.uForcaSombra.value = clima.forcaSombra * apaga * (0.5 + visual.pesoDia * 0.5);
    const y = Math.max(elev, 0.22);
    uniformsNuvem.uCisalha.value.set(
      (visual.dirSol.x / y) * ESCALA_NUVEM,
      (visual.dirSol.z / y) * ESCALA_NUVEM,
    );
  }

  return { atualizar };
}

/**
 * Abre o volume da sombra até o disco de blocos. A resolução do mapa fica em 2048:
 * o texel fica maior, a sombra chega mais longe.
 */
function aplicarAlcanceSombra(sol, meio) {
  const cam = sol.shadow.camera;
  const recuo = Math.max(DIST_LUZ, meio + 16);
  cam.left = -meio;
  cam.right = meio;
  cam.top = meio;
  cam.bottom = -meio;
  cam.near = 1;
  cam.far = recuo + meio + 40;
  cam.updateProjectionMatrix();
  const texel = (meio * 2) / sol.shadow.mapSize.x;
  sol.shadow.normalBias = texel * 1.5;
  sol.shadow.bias = -(texel * 0.35) / (cam.far - cam.near);
}

function smooth(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1)));
  return t * t * (3 - 2 * t);
}
