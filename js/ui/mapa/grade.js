/**
 * Grade do mapa assado. Visão cobre o overworld inteiro;
 * cada tile de perto cobre um quadrado de blocos.
 */
import { LADO_MUNDO as LADO_BOUNDS } from "../../mundo/bounds.js";

export const PASTA_MAPA = "assets/mapa/mundo";
export const SEMENTE_MAPA = 1337;

export const LADO_MUNDO = LADO_BOUNDS;

export const LADO_VISAO = 2048;
export const PASSO_VISAO = LADO_MUNDO / LADO_VISAO;

export const LADO_TILE = 512;
export const PASSO_TILE = 1;
export const LADO_TILE_MUNDO = LADO_TILE * PASSO_TILE;
export const GRADE_TILE = LADO_MUNDO / LADO_TILE_MUNDO;

export const ZOOM_TILE = 0.42;
export const ZOOM_INTIMO = 2;

export const BLOCOS_INTIMO = 128;
export const TEXEL_INTIMO = 4;
export const LADO_INTIMO = BLOCOS_INTIMO * TEXEL_INTIMO;
export const GRADE_INTIMO = LADO_MUNDO / BLOCOS_INTIMO;

/** Chunks da máscara de vegetação (não um blob 8192²). */
export const LADO_VEG_CHUNK = 1024;
export const GRADE_VEG = LADO_MUNDO / LADO_VEG_CHUNK;
