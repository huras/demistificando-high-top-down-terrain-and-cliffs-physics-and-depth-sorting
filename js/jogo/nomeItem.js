import { classificarChave, defItem } from "../wild/catalogo.js";
import { t } from "./i18n.js";

export function nomeDoItem(chave, tipo) {
  const def = (tipo && defItem(tipo, chave)) || defItem(classificarChave(chave), chave);
  if (def?.nameKey) {
    const nome = t(def.nameKey);
    if (nome && nome !== def.nameKey) return nome;
  }
  return def?.nome || chave;
}
