/**
 * Caixas medidas na página de colisores.
 * x e y são o centro no lote, antes do giro da rua: +x leste, +y sul.
 * lx e ly são largura e profundidade. Sem a chave, o jogo continua no automático.
 */

/** @type {Record<string, { corpo?: object, porta?: object | null }>} */
let ajustes = {};

export function definirAjustes(json) {
  ajustes = json && typeof json === "object" && !Array.isArray(json) ? json : {};
}

export function chaveDoVolume(v) {
  if (!v) return "";
  if (v.cartao) return `cartao-${v.folha | 0}`;
  if (v.sprite) return v.sprite;
  return v.modelo || v.id || "";
}

export function ajusteDe(v) {
  const chave = chaveDoVolume(v);
  if (!chave) return null;
  const item = ajustes[chave];
  if (!item || typeof item !== "object") return null;
  return item;
}
