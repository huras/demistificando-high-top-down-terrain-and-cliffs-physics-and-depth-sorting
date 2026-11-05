/** Cena Viridian: overhear de Rockets após ginásio (beat narrativo). */

import { AREA_KANTO } from "../../mundo/regiao/grafoKanto.js";
import { deLocalKanto } from "../../mundo/bounds.js";
import { CIDADES_KANTO } from "../../mundo/regiao/kantoCidades.js";
import { CAMERA3D_DIST_PADRAO } from "../../config.js";
import { VIRIDIAN_ROCKET } from "../flags.js";
import { garantirHistoria } from "../persistencia.js";
import { beginCamTween, cancelarCameraEvento } from "../cameraEvento.js";
import { travarHistoria, liberarHistoria } from "../travas.js";
import { adicionarAtorScriptado, limparAtoresScriptados } from "../atoresScriptados.js";
import { encadearDialogos } from "../sequenciador.js";
import { TXT, retratoRocket } from "../opening/textos.js";
import { descobrirWarehouse } from "./quest.js";
import { warehouseIdAtIndex } from "./catalogo.js";

let fase = "idle";
let leaveT = 0;

export function armarOverhearViridian() {
  const h = garantirHistoria();
  if (h.viridianRocketScene !== VIRIDIAN_ROCKET.IDLE) return;
  h.viridianRocketScene = VIRIDIAN_ROCKET.ARMED;
}

export function tickOverhearViridian(corpo, dt) {
  const h = garantirHistoria();
  if (h.viridianRocketScene !== VIRIDIAN_ROCKET.ARMED) {
    if (fase === "leave") {
      leaveT += dt;
      if (leaveT > 2.5) {
        limparAtoresScriptados((a) => a.role === "viridianRocket");
        fase = "idle";
        leaveT = 0;
      }
    }
    return;
  }
  const vir = CIDADES_KANTO.find((c) => c.key === "viridian");
  if (!vir) return;
  // Perto da saída oeste do ginásio / centro da cidade
  const foco = deLocalKanto(vir.ax * AREA_KANTO + AREA_KANTO * 0.42, vir.ay * AREA_KANTO + AREA_KANTO * 0.5);
  if (Math.hypot(corpo.x - foco.x, corpo.y - foco.y) > 18) return;
  iniciarCena(corpo, foco);
}

function iniciarCena(corpo, foco) {
  const h = garantirHistoria();
  h.viridianRocketScene = VIRIDIAN_ROCKET.DONE;
  h.cinemaAtiva = true;
  fase = "pan";
  travarHistoria();
  const a = {
    id: "viridian-rocket-a",
    role: "viridianRocket",
    nome: "Rocket Grunt",
    retrato: retratoRocket("m"),
    x: foco.x - 2,
    y: foco.y - 1,
    z: 0,
  };
  const b = {
    id: "viridian-rocket-b",
    role: "viridianRocket",
    nome: "Rocket Grunt",
    retrato: retratoRocket("f"),
    x: foco.x + 2,
    y: foco.y - 1.2,
    z: 0,
  };
  adicionarAtorScriptado(a);
  adicionarAtorScriptado(b);
  beginCamTween(corpo, foco.x, foco.y, CAMERA3D_DIST_PADRAO * 0.7, 1.1);
  window.setTimeout(() => {
    encadearDialogos(
      [
        { nome: a.nome, linhas: TXT.rocketOverhearA, retrato: a.retrato },
        { nome: b.nome, linhas: TXT.rocketOverhearB, retrato: b.retrato },
      ],
      () => {
        descobrirWarehouse(warehouseIdAtIndex(0));
        h.cinemaAtiva = false;
        liberarHistoria();
        beginCamTween(corpo, corpo.x, corpo.y, CAMERA3D_DIST_PADRAO, 0.8, "restore");
        // Empurra NPCs para norte (despawn)
        a.y -= 8;
        b.y -= 8;
        fase = "leave";
        leaveT = 0;
        cancelarCameraEvento(corpo);
      },
    );
  }, 1200);
}

/** Chamado quando o jogador vence o ginásio de Giovanni. */
export function onGiovanniGymCleared() {
  armarOverhearViridian();
}
