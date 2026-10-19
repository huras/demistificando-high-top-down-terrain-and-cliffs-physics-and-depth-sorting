/**
 * Grade do mapa assado. A visão cobre Kanto inteiro;
 * cada tile de perto cobre um quadrado de blocos.
 */
import { EXTENSAO_KANTO } from "../../mundo/regiao/grafoKanto.js";

export const PASTA_MAPA = "assets/mapa/kanto";
export const SEMENTE_MAPA = 1337;

export const LADO_VISAO = 1024;
export const PASSO_VISAO = EXTENSAO_KANTO / LADO_VISAO;

export const LADO_TILE = 512;
export const PASSO_TILE = 1;
export const LADO_TILE_MUNDO = LADO_TILE * PASSO_TILE;
export const GRADE_TILE = EXTENSAO_KANTO / LADO_TILE_MUNDO;

export const ZOOM_TILE = 0.42;
