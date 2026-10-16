import { definirDebugVaosPorta } from "../render/3d/debugVaosPorta.js";
import { definirDebugCorpos } from "../render/3d/debugCorpos.js";
import { definirDebugCasas } from "../render/3d/debugCasas.js";

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
}
