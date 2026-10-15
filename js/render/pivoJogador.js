/** Ajuste do pé do jogador, o mesmo arquivo da página de pivôs. */

const CHAVE = "jogador";
const VAZIO = Object.freeze({ offsetY: 0, dx: 0, dy: 0 });

let ajuste = VAZIO;
let pedido = null;

export function pivoDoJogador() {
  return ajuste;
}

export function carregarPivoJogador() {
  if (pedido) return pedido;
  pedido = fetch("/assets/pokemon/pivos.json")
    .then((res) => (res.ok ? res.json() : null))
    .then((json) => {
      const item = json?.[CHAVE];
      if (!item || typeof item !== "object") return;
      const offsetY = Number(item.offsetY);
      const dx = Number(item.dx);
      const dy = Number(item.dy);
      ajuste = {
        offsetY: Number.isFinite(offsetY) ? offsetY : 0,
        dx: Number.isFinite(dx) ? dx : 0,
        dy: Number.isFinite(dy) ? dy : 0,
      };
    })
    .catch(() => {});
  return pedido;
}
