/** Entrar / sair / trocar andar do armazém Rocket. */

import { ALTURA_PRACA } from "../../mundo/regiao/amostraKanto.js";
import { atualizarStreaming, atualizarStreamingDuplo, obterRaioStream } from "../../mundo/voxel/storeMundo.js";
import { estado, avisar } from "../../jogo/estado.js";
import { sfx } from "../../jogo/audio.js";
import { pousarCompanheiro } from "../../pokemon/pousarCompanheiro.js";
import { criarInteriorArmazem, spawnArmazem } from "./interior.js";
import { entradaDesbloqueada, descobrirWarehouse, marcarWarehouseLimpo, warehouseLimpo } from "./quest.js";
import { warehousePerto } from "./placement.js";
import { adicionarAtorScriptado, limparAtoresScriptados } from "../atoresScriptados.js";
import { abrirDialogoHistoria } from "../sequenciador.js";
import { retratoRocket } from "../opening/textos.js";

function pousar(corpo, x, y, z = ALTURA_PRACA) {
  corpo.x = x;
  corpo.y = y;
  corpo.z = z;
  corpo.elevacao = z;
  corpo.vx = 0;
  corpo.vy = 0;
  corpo.vz = 0;
  corpo.noChao = true;
  corpo.hopLift = 0;
  corpo.pulando = false;
  corpo.pulo = null;
  const ox = estado.interior?.outdoorX;
  const oy = estado.interior?.outdoorY;
  if (Number.isFinite(ox) && Number.isFinite(oy)) {
    atualizarStreamingDuplo(ox, oy, x, y, obterRaioStream(), true);
  } else {
    atualizarStreaming(x, y, undefined, true);
  }
  corpo._renasceu = true;
  estado.painel = null;
}

function spawnTrainersInterior(plan) {
  limparAtoresScriptados((a) => a.role === "warehouseTrainer");
  if (!plan) return;
  for (const t of plan.trainers || []) {
    if (estado.historia?.warehouseGuardsDefeated?.includes(t.id)) continue;
    adicionarAtorScriptado({
      id: t.id,
      role: "warehouseTrainer",
      warehouseId: plan.warehouseId,
      floorIndex: plan.floorIndex,
      nome: t.name,
      retrato: retratoRocket(t.female ? "f" : "m"),
      x: t.x,
      y: t.y,
      z: 0,
      level: t.level,
      combativel: true,
    });
  }
}

export function tentarEntrarArmazem(corpo) {
  if (estado.interior) return false;
  const site = warehousePerto(corpo.x, corpo.y, 5);
  if (!site) return false;
  descobrirWarehouse(site.id);
  if (!entradaDesbloqueada(site.id)) {
    estado.prompt = "Guarda Rocket bloqueia a porta.";
    estado.promptEntrar = false;
    return false;
  }
  const plan = criarInteriorArmazem(site.id, 0);
  if (!plan) return false;
  estado.interior = {
    sala3d: true,
    papel: "armazem",
    warehouseId: site.id,
    floorIndex: 0,
    plan,
    outdoorX: corpo.x,
    outdoorY: corpo.y,
    casaId: site.id,
  };
  const sp = spawnArmazem(plan);
  pousar(corpo, sp.x, sp.y, sp.z);
  pousarCompanheiro?.(corpo);
  spawnTrainersInterior(plan);
  sfx("porta");
  estado.itemGet = plan.title;
  avisar();
  return true;
}

export function sairArmazem(corpo) {
  if (estado.interior?.papel !== "armazem") return false;
  const ox = estado.interior.outdoorX;
  const oy = estado.interior.outdoorY;
  limparAtoresScriptados((a) => a.role === "warehouseTrainer");
  estado.interior = null;
  if (Number.isFinite(ox) && Number.isFinite(oy)) {
    pousar(corpo, ox, oy + 2.2);
    atualizarStreaming(ox, oy, undefined, false);
  }
  sfx("porta");
  return true;
}

export function trocarAndarArmazem(corpo, dir) {
  const int = estado.interior;
  if (int?.papel !== "armazem" || !int.plan) return false;
  const next = (int.floorIndex | 0) + (dir > 0 ? 1 : -1);
  const floors = int.plan.floors || [];
  if (next < 0 || next >= floors.length) return false;
  const plan = criarInteriorArmazem(int.warehouseId, next);
  if (!plan) return false;
  int.floorIndex = next;
  int.plan = plan;
  const sp = spawnArmazem(plan);
  pousar(corpo, sp.x, sp.y, sp.z);
  spawnTrainersInterior(plan);
  estado.itemGet = `${plan.title} — andar ${next + 1}`;
  avisar();
  return true;
}

export function checarSaidaArmazem(corpo) {
  const int = estado.interior;
  if (int?.papel !== "armazem" || !int.plan) return;
  const floor = int.plan.floor;
  const ox = int.plan.origemX;
  const oy = int.plan.origemY;
  if (floor.exitSouth) {
    const ex = ox + floor.exitSouth.x;
    const ey = oy + floor.exitSouth.y;
    if (Math.hypot(corpo.x - ex, corpo.y - ey) < 1.4) {
      sairArmazem(corpo);
      return;
    }
  }
  if (floor.stairsUp) {
    const sx = ox + floor.stairsUp.x;
    const sy = oy + floor.stairsUp.y;
    if (Math.hypot(corpo.x - sx, corpo.y - sy) < 1.3) trocarAndarArmazem(corpo, 1);
  }
  if (floor.stairsDown) {
    const sx = ox + floor.stairsDown.x;
    const sy = oy + floor.stairsDown.y;
    if (Math.hypot(corpo.x - sx, corpo.y - sy) < 1.3) trocarAndarArmazem(corpo, -1);
  }
}

export function interagirTrainerArmazem(ator) {
  if (ator?.role !== "warehouseTrainer") return false;
  abrirDialogoHistoria({
    nome: ator.nome,
    linhas: [`Nv.${ator.level} — Prepare-se!`, "(Combate resolvido a favor do jogador.)"],
    retrato: ator.retrato,
    onClose: () => {
      const h = estado.historia;
      if (h && !h.warehouseGuardsDefeated.includes(ator.id)) {
        h.warehouseGuardsDefeated.push(ator.id);
      }
      limparAtoresScriptados((a) => a.id === ator.id);
      verificarClearAndar(ator.warehouseId);
    },
  });
  return true;
}

function verificarClearAndar(warehouseId) {
  const plan = estado.interior?.plan;
  if (!plan || plan.warehouseId !== warehouseId) return;
  const h = estado.historia;
  const todos = (plan.floors || []).flatMap((f) => (f.trainers || []).map((t) => t.id));
  const ok = todos.every((id) => h.warehouseGuardsDefeated.includes(id));
  if (ok && !warehouseLimpo(warehouseId)) {
    marcarWarehouseLimpo(warehouseId);
    estado.itemGet = "Depósito Rocket limpo!";
    avisar();
  }
}

export function promptArmazem(corpo) {
  if (estado.interior) return null;
  const site = warehousePerto(corpo.x, corpo.y, 5);
  if (!site) return null;
  if (!entradaDesbloqueada(site.id)) return { rotulo: "Bloqueado", tecla: "e" };
  return { rotulo: "Entrar", tecla: "e", entrar: true, site };
}
