import { CAMINHOS, VISUAL_REAL_PADRAO } from "../config.js";

export async function carregarImagem(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

/** Tenta carregar; retorna null se falhar (demo segue com fallback). */
async function tentarCarregar(url) {
  try {
    return await carregarImagem(url);
  } catch (err) {
    console.warn("Asset ausente:", url, err);
    return null;
  }
}

/**
 * Sheets de cliff do GBA usam #FF00FF como máscara ("vira terreno" no bake).
 * Aqui vira alpha 0 — o blit preenche o dest com chão antes.
 */
export function removerMagenta(img) {
  if (!img) return null;
  const c = document.createElement("canvas");
  c.width = img.width || img.naturalWidth;
  c.height = img.height || img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, c.width, c.height);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 200 && d[i + 1] < 40 && d[i + 2] > 200) {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(id, 0, 0);
  return c;
}

/**
 * Jogador obrigatório para sprite; terreno opcional — sem ele, cubos procedurais.
 */
export async function montarAtlas(caminhos = CAMINHOS) {
  const [
    jogador,
    grama,
    terra,
    cliffDuploRaw,
    cliffSimplesRaw,
    mata,
    arvore,
  ] = await Promise.all([
    carregarImagem(caminhos.jogador),
    tentarCarregar(caminhos.grama),
    tentarCarregar(caminhos.terra),
    tentarCarregar(caminhos.cliffDuplo),
    tentarCarregar(caminhos.cliffSimples),
    tentarCarregar(caminhos.mata),
    tentarCarregar(caminhos.arvore),
  ]);

  const cliffDuplo = removerMagenta(cliffDuploRaw);
  const cliffSimples = removerMagenta(cliffSimplesRaw);
  const terrenoPronto = !!(grama && (cliffDuplo || cliffSimples));

  return {
    jogador,
    grama,
    terra,
    cliffDuplo,
    cliffSimples,
    mata,
    arvore,
    terrenoPronto,
    visualReal: terrenoPronto && VISUAL_REAL_PADRAO,
  };
}

export function usarTiles(atlas) {
  return !!(atlas && atlas.visualReal && atlas.terrenoPronto);
}

export function alternarVisual(atlas) {
  if (!atlas?.terrenoPronto) return false;
  atlas.visualReal = !atlas.visualReal;
  return atlas.visualReal;
}
