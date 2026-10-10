/**
 * Tooltips da sidebar: hover, foco ou clique. O balão fica fora do painel
 * para não ser cortado pelo scroll e não competir com os controles.
 */
export function ligarDicasPainel() {
  const painel = document.getElementById("painel");
  if (!painel) return;

  const itens = [...painel.querySelectorAll(".info")];
  let aberto = null;
  let timer = 0;

  function posicionar(info) {
    const btn = info.querySelector(".info__btn");
    const balao = info.querySelector(".info__balao");
    if (!btn || !balao) return;
    const margem = 8;
    const r = btn.getBoundingClientRect();
    const painelR = painel.getBoundingClientRect();
    const espacoEsquerda = painelR.left - margem * 2;
    const cabeNaEsquerda = espacoEsquerda >= 180;
    const largura = cabeNaEsquerda
      ? Math.min(320, espacoEsquerda)
      : Math.min(320, window.innerWidth - margem * 2);
    balao.style.width = `${largura}px`;
    const h = balao.offsetHeight;
    let left = painelR.left - largura - margem;
    let top = r.top - 4;
    if (!cabeNaEsquerda) {
      left = Math.max(margem, Math.min(r.left, window.innerWidth - largura - margem));
      top = r.top - h - margem;
      if (top < margem) top = r.bottom + margem;
    }
    if (top + h > window.innerHeight - margem) {
      top = Math.max(margem, window.innerHeight - h - margem);
    }
    if (top < margem) top = margem;
    balao.style.left = `${left}px`;
    balao.style.top = `${top}px`;
  }

  function fechar(info) {
    clearTimeout(timer);
    const btn = info.querySelector(".info__btn");
    const balao = info.querySelector(".info__balao");
    info.classList.remove("info--fixo");
    if (!balao || balao.hidden) {
      if (aberto === info) aberto = null;
      return;
    }
    balao.hidden = true;
    btn?.setAttribute("aria-expanded", "false");
    info.classList.remove("info--aberto");
    if (aberto === info) aberto = null;
  }

  function abrir(info) {
    clearTimeout(timer);
    if (aberto && aberto !== info) fechar(aberto);
    const btn = info.querySelector(".info__btn");
    const balao = info.querySelector(".info__balao");
    if (!btn || !balao) return;
    balao.hidden = false;
    info.classList.add("info--aberto");
    btn.setAttribute("aria-expanded", "true");
    aberto = info;
    posicionar(info);
  }

  function agendarFechar(info) {
    if (info.classList.contains("info--fixo")) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (info.classList.contains("info--fixo")) return;
      if (info.matches(":hover")) return;
      const balao = info.querySelector(".info__balao");
      if (balao?.matches(":hover")) return;
      fechar(info);
    }, 140);
  }

  for (const info of itens) {
    const btn = info.querySelector(".info__btn");
    const balao = info.querySelector(".info__balao");
    if (!btn || !balao) continue;

    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const fixo = info.classList.toggle("info--fixo");
      if (fixo) abrir(info);
      else fechar(info);
    });

    btn.addEventListener("focus", () => abrir(info));
    info.addEventListener("mouseenter", () => abrir(info));
    info.addEventListener("mouseleave", () => {
      if (document.activeElement === btn) return;
      agendarFechar(info);
    });
    btn.addEventListener("blur", () => {
      requestAnimationFrame(() => {
        if (info.contains(document.activeElement)) return;
        agendarFechar(info);
      });
    });
    balao.addEventListener("mouseenter", () => abrir(info));
    balao.addEventListener("mouseleave", () => {
      if (document.activeElement === btn) return;
      agendarFechar(info);
    });
  }

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && aberto) {
      const btn = aberto.querySelector(".info__btn");
      fechar(aberto);
      btn?.blur();
    }
  });

  document.addEventListener("pointerdown", (ev) => {
    if (!aberto) return;
    if (aberto.contains(ev.target)) return;
    const balao = aberto.querySelector(".info__balao");
    if (balao?.contains(ev.target)) return;
    fechar(aberto);
  });

  painel.addEventListener("scroll", () => {
    if (aberto) fechar(aberto);
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (aberto) posicionar(aberto);
  });
}
