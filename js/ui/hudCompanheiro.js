import {
  aplicarCapacidades,
  CAPS_PADRAO,
  normalizarCaps,
} from "../navegacao/capacidades.js";

const IDS = {
  pular: "cap-pular",
  escalar: "cap-escalar",
  planar: "cap-planar",
  correr: "cap-correr",
  voar: "cap-voar",
  vadear: "cap-vadear",
  nadar: "cap-nadar",
  cachoeira: "cap-cachoeira",
};

let agenteRef = null;
let ligado = false;

export function companheiroLigado() {
  return ligado;
}

/**
 * Liga checkboxes do painel ao perfil do companheiro.
 * @param {(ativo: boolean) => void} [aoMudarLigado]
 */
export function ligarHudCompanheiro(agente, capsIniciais = CAPS_PADRAO, aoMudarLigado) {
  agenteRef = agente;
  const caps = normalizarCaps(capsIniciais);
  aplicarCapacidades(agente, caps);
  sincronizarChecks(caps);

  const ativo = document.getElementById("comp-ativo");
  if (ativo) {
    ativo.checked = ligado;
    ativo.addEventListener("change", () => {
      ligado = ativo.checked;
      aoMudarLigado?.(ligado);
      atualizarHudCompanheiro(agenteRef);
    });
  }

  for (const [chave, id] of Object.entries(IDS)) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener("change", () => {
      if (!agenteRef) return;
      aplicarCapacidades(agenteRef, lerCapsDoDom());
      atualizarHudCompanheiro(agenteRef);
    });
  }

  atualizarHudCompanheiro(agente);
}

export function lerCapsDoDom() {
  return {
    pular: !!document.getElementById(IDS.pular)?.checked,
    escalar: !!document.getElementById(IDS.escalar)?.checked,
    planar: !!document.getElementById(IDS.planar)?.checked,
    correr: !!document.getElementById(IDS.correr)?.checked,
    voar: !!document.getElementById(IDS.voar)?.checked,
    vadear: !!document.getElementById(IDS.vadear)?.checked,
    nadar: !!document.getElementById(IDS.nadar)?.checked,
    cachoeira: !!document.getElementById(IDS.cachoeira)?.checked,
  };
}

function sincronizarChecks(caps) {
  const c = normalizarCaps(caps);
  for (const [chave, id] of Object.entries(IDS)) {
    const el = document.getElementById(id);
    if (el) el.checked = !!c[chave];
  }
}

/** Atualiza texto de status do companheiro no painel. */
export function atualizarHudCompanheiro(agente) {
  if (!agente) return;
  const acao = document.getElementById("comp-acao");
  const perfil = document.getElementById("comp-perfil");
  if (!ligado) {
    if (acao) acao.textContent = "desligado";
    return;
  }
  if (acao) acao.textContent = agente.acao || "—";
  if (perfil) {
    const id = agente.perfil?.id || "—";
    perfil.textContent = id.length > 36 ? `${id.slice(0, 34)}…` : id;
  }
}
