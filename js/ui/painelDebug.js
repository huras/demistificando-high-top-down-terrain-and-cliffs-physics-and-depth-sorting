import { descobrirTodosNinhos, limparWildsDescobertos } from "../mapa/descoberta.js";
import {
  definirNinhosMapaVisiveis,
  ninhosMapaVisiveis,
} from "../mapa/marcasWild.js";
import { definirDebugVaosPorta } from "../render/3d/debugVaosPorta.js";
import { definirDebugCorpos } from "../render/3d/debugCorpos.js";
import { definirDebugCasas } from "../render/3d/debugCasas.js";
import { definirDebugForca } from "../render/3d/debugForca.js";

function escreverNota(nota, ativo, total, um, varios, vazio) {
  if (!nota) return;
  nota.hidden = !ativo;
  if (!ativo) {
    nota.textContent = "";
    return;
  }
  if (!total) nota.textContent = vazio;
  else if (total === 1) nota.textContent = `1 ${um}`;
  else nota.textContent = `${total} ${varios}`;
}

function ligarCaixa(id, notaId, aplicar, um, varios, vazio) {
  const input = document.getElementById(id);
  const nota = document.getElementById(notaId);
  if (!input) return;

  input.addEventListener("change", () => {
    const ativo = input.checked;
    if (!ativo) {
      aplicar(false);
      escreverNota(nota, false, 0, um, varios, vazio);
      return;
    }
    if (nota) {
      nota.hidden = false;
      nota.textContent = "…";
    }
    aplicar(true, (total) => {
      if (input.checked !== ativo) return;
      escreverNota(nota, true, total, um, varios, vazio);
    });
  });
}

function ligarNinhosMapa() {
  const input = document.getElementById("debug-ninhos-mapa");
  const nota = document.getElementById("debug-ninhos-mapa-nota");
  if (!input) return;

  const sincronizar = () => {
    const visivel = definirNinhosMapaVisiveis(input.checked);
    if (!nota) return;
    nota.hidden = false;
    nota.textContent = visivel ? "visíveis no mapa" : "ocultos no mapa";
  };

  if (input.checked !== ninhosMapaVisiveis()) {
    input.checked = ninhosMapaVisiveis();
  }
  input.addEventListener("change", sincronizar);

  const btn = document.getElementById("debug-limpar-ninhos");
  const notaLimpar = document.getElementById("debug-limpar-ninhos-nota");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const n = limparWildsDescobertos();
    if (!notaLimpar) return;
    notaLimpar.hidden = false;
    if (!n) notaLimpar.textContent = "nenhum ninho descoberto";
    else if (n === 1) notaLimpar.textContent = "1 ninho limpo";
    else notaLimpar.textContent = `${n} ninhos limpos`;
  });

  const btnRevelar = document.getElementById("debug-revelar-ninhos");
  const notaRevelar = document.getElementById("debug-revelar-ninhos-nota");
  if (!btnRevelar) return;
  btnRevelar.addEventListener("click", () => {
    if (btnRevelar.disabled) return;
    btnRevelar.disabled = true;
    if (notaRevelar) {
      notaRevelar.hidden = false;
      notaRevelar.textContent = "varrendo…";
    }
    descobrirTodosNinhos((p) => {
      if (!notaRevelar) return;
      if (!p.pronto) {
        const pct = p.total > 0 ? Math.min(100, Math.round((p.feitos / p.total) * 100)) : 0;
        notaRevelar.textContent = `varrendo ${pct}% · ${p.novos} novos`;
        return;
      }
      btnRevelar.disabled = false;
      notaRevelar.textContent = p.novos
        ? `${p.novos} ninhos descobertos`
        : "todos já estavam descobertos";
    });
  });
}

export function ligarPainelDebug() {
  ligarCaixa(
    "debug-vaos-porta",
    "debug-vaos-porta-nota",
    (ativo, aoContar) => {
      const pronto = definirDebugVaosPorta(ativo);
      if (!ativo) return;
      pronto.then((total) => aoContar?.(total)).catch(() => aoContar?.(0));
    },
    "vão",
    "vãos",
    "nenhum vão",
  );
  ligarCaixa(
    "debug-corpos",
    "debug-corpos-nota",
    definirDebugCorpos,
    "entidade",
    "entidades",
    "nenhuma entidade",
  );
  ligarCaixa(
    "debug-casas",
    "debug-casas-nota",
    (ativo, aoContar) => {
      const pronto = definirDebugCasas(ativo);
      if (!ativo) return;
      pronto.then((total) => aoContar?.(total)).catch(() => aoContar?.(0));
    },
    "volume",
    "volumes",
    "nenhum volume",
  );
  ligarCaixa(
    "debug-forca",
    "debug-forca-nota",
    definirDebugForca,
    "alvo no cone",
    "alvos no cone",
    "nenhum alvo no cone",
  );
  ligarNinhosMapa();
}
