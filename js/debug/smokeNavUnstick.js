/**
 * Smoke AAA Nav Unstick — roda no console do jogo:
 *   import("/js/debug/smokeNavUnstick.js").then(m => m.rodarSmokeNav())
 *
 * Ou via window se o bundle expuser.
 */
import { invadeDisco, indexarBases, limparBases } from "../fisica/obstaculos.js";
import { desviarDisco } from "../navegacao/desviarDisco.js";
import { projetarMetaLivre } from "../navegacao/metaLivre.js";
import { invalidarNavCache, obterNavGrade } from "../navegacao/navGrade.js";
import { PERFIL_A_PE } from "../navegacao/perfilMovimento.js";

function ok(nome, cond, detalhe = "") {
  const pass = !!cond;
  console[pass ? "log" : "error"](
    `${pass ? "OK" : "FAIL"}  ${nome}${detalhe ? ` — ${detalhe}` : ""}`,
  );
  return pass;
}

/** Disco sentinela de teste (não colide com chunks reais). */
const CX = -9911;
const CY = -9911;

export function rodarSmokeNav() {
  let falhas = 0;
  const z = 8;
  const discos = [{ x: 100.5, y: 200.5, z, r: 1.2, tipo: "pedra" }];
  indexarBases(CX, CY, discos);

  const dentro = invadeDisco(100.5, 200.5, z, 0.3);
  if (!ok("disco indexado invade centro", dentro)) falhas++;

  const meta = projetarMetaLivre(100.5, 200.5, z, 0.3);
  const livre = !invadeDisco(meta.x, meta.y, z, 0.3);
  if (
    !ok(
      "projetarMetaLivre sai do disco",
      livre,
      `→ (${meta.x.toFixed(2)}, ${meta.y.toFixed(2)})`,
    )
  ) {
    falhas++;
  }

  const corpo = { x: 99.2, y: 200.5, z, elevacao: z, raioCorpo: 0.3 };
  const desvio = desviarDisco(corpo, 1, 0);
  const len = Math.hypot(desvio.x, desvio.y);
  if (!ok("desviarDisco devolve direção unitária", len > 0.9 && len < 1.1)) {
    falhas++;
  }
  if (
    !ok(
      "desviarDisco evita empurrar no disco",
      Math.abs(desvio.x - 1) > 0.05 || Math.abs(desvio.y) > 0.05,
    )
  ) {
    falhas++;
  }

  invalidarNavCache({ x0: 98, y0: 198, x1: 103, y1: 203 });
  if (!ok("invalidarNavCache(AABB) não explode", true)) falhas++;

  // Grade sob demanda (pode ser null se mapa não carregou — não conta falha dura).
  try {
    obterNavGrade(PERFIL_A_PE, 100, 200);
    ok("obterNavGrade após dirty", true);
  } catch (e) {
    falhas++;
    ok("obterNavGrade após dirty", false, String(e?.message || e));
  }

  limparBases(CX, CY);
  if (!ok("limparBases remove disco de teste", !invadeDisco(100.5, 200.5, z, 0.3))) {
    falhas++;
  }

  console.log(
    falhas
      ? `smokeNavUnstick: ${falhas} falha(s)`
      : "smokeNavUnstick: todos os checks passaram",
  );
  return falhas === 0;
}
