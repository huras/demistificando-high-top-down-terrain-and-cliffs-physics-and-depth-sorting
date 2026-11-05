/** Helpers de diálogo encadeado e avanço de fase. */

import { estado, avisar } from "../jogo/estado.js";

/**
 * Abre diálogo e chama onClose ao terminar.
 * @param {{ nome?: string, linhas: string[], retrato?: string, ancora?: object, onClose?: Function }} opts
 */
export function abrirDialogoHistoria(opts) {
  const linhas = Array.isArray(opts.linhas) ? opts.linhas.filter(Boolean) : [];
  if (!linhas.length) {
    opts.onClose?.();
    return;
  }
  estado.dialogo = {
    nome: opts.nome || "",
    linhas,
    i: 0,
    retrato: opts.retrato || "",
    ancora: opts.ancora || null,
    npcRef: opts.npcRef || null,
    onClose: opts.onClose || null,
  };
  avisar();
}

/**
 * Encadeia beats de diálogo (cada um é { nome, linhas, retrato?, emotion? }).
 * @param {object[]} beats
 * @param {() => void} [aoFim]
 */
export function encadearDialogos(beats, aoFim) {
  let i = 0;
  const next = () => {
    if (i >= beats.length) {
      aoFim?.();
      return;
    }
    const b = beats[i++];
    abrirDialogoHistoria({
      nome: b.nome,
      linhas: b.linhas,
      retrato: b.retrato || "",
      ancora: b.ancora || null,
      onClose: next,
    });
  };
  next();
}
