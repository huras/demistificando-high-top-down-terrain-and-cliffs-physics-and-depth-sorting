/**
 * Colmeia 3D no lugar da palha para linhagens de abelha/vespa (gens 1–4).
 * Crédito: "Bee Hive" por science.tle999, CC-BY-4.0 (ver license.txt da pasta).
 */
export const BASE_COLMEIA = "assets/models/overworld/colmeia/scene.gltf";

/** Altura alvo em metros. Sprite do treinador tem 2 m. */
export const COLMEIA_ALTURA_ALVO = 1.65;

/**
 * Recuo do corpo atrás do ponto do lar, no sentido oposto à abertura.
 * Maior que raio + folga de navegação para o ponto do lar continuar andável.
 */
export const COLMEIA_RECUO = 1.02;

/** Disco sólido no centro da caixa (não no ponto onde o Pokémon dorme). */
export const COLMEIA_RAIO = 0.42;

/** Folga pra não z-fightar com o chão voxel. Igual à palha. */
export const COLMEIA_LIFT_Y = 0.04;

/**
 * Soma ao yaw da abertura. 0 = a frente local +Z aponta para o vão.
 * Afinar se o alvado do molde não nascer em +Z.
 */
export const COLMEIA_YAW_MODELO = 0;

export const COLMEIA_CAP = 48;

const CHAVES = new Set(["weedle", "kakuna", "beedrill", "combee", "vespiquen"]);

export function ehNinhoColmeia(chave) {
  return CHAVES.has(chave);
}
