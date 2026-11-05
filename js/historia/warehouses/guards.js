/** Guards outdoor dos warehouses + Jenny em Viridian. */

import { AREA_KANTO } from "../../mundo/regiao/grafoKanto.js";
import { deLocalKanto } from "../../mundo/bounds.js";
import { CIDADES_KANTO } from "../../mundo/regiao/kantoCidades.js";
import { adicionarAtorScriptado, limparAtoresScriptados } from "../atoresScriptados.js";
import { garantirHistoria } from "../persistencia.js";
import { listarWarehousesMundo } from "./placement.js";
import { derrotarGuard, entradaDesbloqueada } from "./quest.js";
import { retratoRocket } from "../opening/textos.js";
import { abrirDialogoHistoria } from "../sequenciador.js";

export function garantirGuardsWarehouses() {
  const h = garantirHistoria();
  const sites = listarWarehousesMundo();
  for (const site of sites) {
    // Fachada placeholder (até GLB 3D)
    adicionarAtorScriptado({
      id: `${site.id}-facade`,
      warehouseId: site.id,
      role: "warehouseFacade",
      nome: site.id,
      x: site.x,
      y: site.y,
      z: 0,
      oculto: false,
      decorativo: true,
    });
    if (entradaDesbloqueada(site.id)) {
      limparAtoresScriptados((a) => a.warehouseId === site.id && a.role?.startsWith("guard"));
      continue;
    }
    const scoutId = `${site.id}-scout`;
    const doorId = `${site.id}-door`;
    if (!h.warehouseGuardsDefeated.includes(scoutId)) {
      adicionarAtorScriptado({
        id: scoutId,
        warehouseId: site.id,
        role: "guardScout",
        nome: "Rocket Scout",
        retrato: retratoRocket("m"),
        x: site.x - 3.5,
        y: site.y + 4,
        z: 0,
        combativel: true,
      });
    }
    if (!h.warehouseGuardsDefeated.includes(doorId)) {
      adicionarAtorScriptado({
        id: doorId,
        warehouseId: site.id,
        role: "guardDoor",
        nome: "Rocket Door Guard",
        retrato: retratoRocket("f"),
        x: site.x,
        y: site.y + 7,
        z: 0,
        combativel: true,
      });
    }
  }
}

export function garantirJennyViridian() {
  const vir = CIDADES_KANTO.find((c) => c.key === "viridian");
  if (!vir) return;
  const pos = deLocalKanto(vir.ax * AREA_KANTO + AREA_KANTO * 0.5, vir.ay * AREA_KANTO + AREA_KANTO * 0.55);
  adicionarAtorScriptado({
    id: "officer-jenny-viridian",
    role: "officerJenny",
    nome: "Jenny",
    retrato: "/assets/people/retratos/officer-jenny/frontal-shot.png",
    x: pos.x,
    y: pos.y,
    z: 0,
  });
}

export function interagirGuard(ator) {
  if (!ator?.role?.startsWith("guard")) return false;
  abrirDialogoHistoria({
    nome: ator.nome,
    linhas: ["Equipe Rocket! Não passe daqui!", "(Você enfrenta o guarda…)"],
    retrato: ator.retrato,
    onClose: () => {
      derrotarGuard(ator.id, ator.warehouseId);
      limparAtoresScriptados((a) => a.id === ator.id);
      garantirGuardsWarehouses();
    },
  });
  return true;
}
