/** Locale → chave de texto de golpe (PokeAPI não tem pt-BR). */
export function golpeLocaleLang(locale = "en") {
  switch (String(locale ?? "en")) {
    case "es":
      return "es";
    case "fr":
      return "fr";
    case "de":
      return "de";
    case "ja":
      return "ja";
    case "zh-CN":
    case "zh":
      return "zh";
    default:
      return "en";
  }
}

/**
 * @param {Record<string, string> | null | undefined} dict
 * @param {string} [locale]
 */
export function pickDexText(dict, locale) {
  if (!dict) return "";
  const lang = golpeLocaleLang(locale);
  return dict[lang] || dict.en || dict.es || "";
}
