/**
 * Scenery 3D do BattleStage: perfil de bioma → terraços de 3 patamares + props.
 */
import {
  esconderTerrazas,
  limparTerrazas,
  montarTerrazas,
  perfilVisualDoEncontro,
  terrazasAtivas,
} from "./terrazas.js";
import {
  aplicarLuzStage,
  definirModoChaoStage,
  obterCenaStage,
} from "./stage3d.js";

/** @type {string} */
let perfilAtual = "";

/**
 * @param {number} x
 * @param {number} y
 */
export function resolverPerfilStage(x, y) {
  const visual = perfilVisualDoEncontro(x, y);
  let exposure = 1.1;
  let ambient = 0.8;
  const chao = visual.kit?.chao || "";
  if (chao === "stone" || chao === "sand") {
    exposure = 0.98;
    ambient = 0.7;
  } else if (chao === "snow" || chao === "dirty-snowy") {
    exposure = 1.15;
    ambient = 0.88;
  } else if (chao === "lush" || chao === "grass" || chao === "alt-grass") {
    exposure = 1.12;
    ambient = 0.84;
  }
  return {
    key: `${visual.biomaId}|${visual.kitId}|${visual.seed}`,
    biomaId: visual.biomaId,
    kitId: visual.kitId,
    tipo: chao || "grass",
    chaoUrl: visual.chaoUrl,
    cliffUrl: visual.cliffUrl,
    kit: visual.kit,
    seed: visual.seed,
    skyColor: visual.skyColor,
    luz: { exposure, ambient },
  };
}

/**
 * Aplica terraços 3D no renderer do stage.
 * @param {number} x
 * @param {number} y
 * @param {{ forcar?: boolean, activePerSide?: number }} [opts]
 */
export function aplicarSceneryStage(x, y, opts = {}) {
  const perfil = resolverPerfilStage(x, y);
  if (!opts.forcar && perfil.key === perfilAtual && terrazasAtivas()) {
    return perfil;
  }
  perfilAtual = perfil.key;

  const cena = obterCenaStage();
  if (!cena) return perfil;

  // Esconde disco plano da arena lab; liga os 3 decks.
  definirModoChaoStage("terrazas");
  montarTerrazas(cena, perfil, {
    forcar: !!opts.forcar,
    activePerSide: opts.activePerSide || 1,
  });
  if (perfil.luz) aplicarLuzStage(perfil.luz);

  // Céu de fundo da cena.
  if (cena.background?.isColor && perfil.skyColor != null) {
    cena.background.set(perfil.skyColor);
  }

  return perfil;
}

export function limparCacheSceneryStage() {
  perfilAtual = "";
  limparTerrazas();
  definirModoChaoStage("disco");
}

export function ocultarSceneryStage() {
  esconderTerrazas();
}

export function perfilSceneryAtual() {
  return perfilAtual;
}
