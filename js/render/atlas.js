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

/** Sheet cliff legado (5×N). grass-on-dirt tem UNDER próprio. */
export function sheetCliffDoAtlas(atlas) {
  if (!atlas) return null;
  return atlas.cliffSimples || atlas.cliffDuplo || null;
}

/** Path principal: chão com lip + cliff UNDER. */
export function usarGrassOnDirt(atlas) {
  return !!(atlas && atlas.visualReal && atlas.grassOnDirt);
}

/**
 * Jogador obrigatório para sprite; terreno opcional — sem ele, cubos procedurais.
 */
export async function montarAtlas(caminhos = CAMINHOS) {
  const [
    jogador,
    grama,
    terra,
    grassOnDirtRaw,
    cliffSimplesRaw,
    cliffDuploRaw,
    mata,
    arvore,
    penhascoDs,
  ] = await Promise.all([
    carregarImagem(caminhos.jogador),
    tentarCarregar(caminhos.grama),
    tentarCarregar(caminhos.terra),
    tentarCarregar(caminhos.grassOnDirt),
    tentarCarregar(caminhos.cliffSimples),
    tentarCarregar(caminhos.cliffDuplo),
    tentarCarregar(caminhos.mata),
    tentarCarregar(caminhos.arvore),
    tentarCarregar(caminhos.penhascoDs),
  ]);

  const grassOnDirt = grassOnDirtRaw
    ? (() => {
        const c = document.createElement("canvas");
        c.width = grassOnDirtRaw.width || grassOnDirtRaw.naturalWidth;
        c.height = grassOnDirtRaw.height || grassOnDirtRaw.naturalHeight;
        const ctx = c.getContext("2d");
        ctx.drawImage(grassOnDirtRaw, 0, 0);
        return c;
      })()
    : null;
  const cliffSimples = removerMagenta(cliffSimplesRaw);
  const cliffDuplo = removerMagenta(cliffDuploRaw);
  const terrenoPronto = !!(
    grassOnDirt ||
    (grama && (cliffSimples || cliffDuplo))
  );

  return {
    jogador,
    grama,
    terra,
    grassOnDirt,
    cliffSimples,
    cliffDuplo,
    mata,
    arvore,
    penhascoDs,
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
