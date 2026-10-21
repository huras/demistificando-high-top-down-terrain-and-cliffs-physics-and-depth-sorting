/** Menu BOTW: abas Party / Bag / Quests / Map / System. */

const PAGINAS_SISTEMA = new Set(["settings", "save", "help", "about", "dev"]);
const PAGINAS_PRIMARIAS = new Set(["party", "bag", "quests", "map", "system"]);
const ORDEM_PRIMARIA = Object.freeze(["party", "bag", "quests", "map", "system"]);
const ORDEM_SISTEMA = Object.freeze(["settings", "save", "help", "about", "dev"]);

function wrapIndex(i, len) {
  return ((i % len) + len) % len;
}

export function primariaDaPagina(page) {
  if (PAGINAS_SISTEMA.has(page)) return "system";
  if (PAGINAS_PRIMARIAS.has(page) && page !== "system") return page;
  return "party";
}

/**
 * @param {HTMLElement | null} root
 * @param {{ initialPage?: string, onPageChange?: (page: string, open: boolean) => void }} [opts]
 */
export function criarMenuJogo(root, { initialPage = "party", onPageChange } = {}) {
  if (!root) {
    return {
      open() {},
      close() {},
      toggle() {},
      setPage() {},
      isOpen: () => false,
      page: () => "party",
      primaryPage: () => "party",
      cyclePrimary() {},
      cycleSystem() {},
      syncMoney() {},
    };
  }

  const primaryTabs = [...root.querySelectorAll("[data-menu-primary]")];
  const systemTabs = [...root.querySelectorAll("[data-menu-system]")];
  const pages = [...root.querySelectorAll("[data-menu-page]")];
  const closeBtn = root.querySelector("[data-menu-close]");
  const systemRail = root.querySelector("[data-menu-system-rail]");
  const moneyEl = root.querySelector("[data-menu-money]");

  let activePage = initialPage === "system" ? "settings" : initialPage;
  let lastSystemPage = PAGINAS_SISTEMA.has(activePage) ? activePage : "settings";
  let isOpen = false;

  const notify = () => onPageChange?.(activePage, isOpen);

  const syncDom = () => {
    const primary = primariaDaPagina(activePage);
    root.classList.toggle("is-map-focus", isOpen && activePage === "map");
    root.classList.toggle("is-system", isOpen && primary === "system");
    document.body.classList.toggle("game-menu-open", isOpen);

    if (isOpen) {
      root.hidden = false;
      requestAnimationFrame(() => root.classList.add("is-open"));
    } else {
      root.classList.remove("is-open");
      root.hidden = true;
    }

    for (const tab of primaryTabs) {
      const id = tab.dataset.menuPrimary;
      const selected = id === primary;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
    }

    if (systemRail) systemRail.hidden = primary !== "system";
    for (const tab of systemTabs) {
      const id = tab.dataset.menuSystem;
      const selected = primary === "system" && id === activePage;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
    }

    for (const page of pages) {
      page.hidden = page.dataset.menuPage !== activePage;
    }

    const topMoney = document.querySelector("#jogo-dinheiro [data-dinheiro]");
    if (moneyEl && topMoney) moneyEl.textContent = topMoney.textContent || "₽0";
  };

  const setPage = (page) => {
    if (!page) return;
    if (page === "system") page = "settings";
    if (!pages.some((el) => el.dataset.menuPage === page)) return;
    activePage = page;
    if (PAGINAS_SISTEMA.has(page)) lastSystemPage = page;
    syncDom();
    notify();
  };

  const cyclePrimary = (dir) => {
    const step = dir < 0 ? -1 : 1;
    const cur = primariaDaPagina(activePage);
    const i = ORDEM_PRIMARIA.indexOf(cur);
    const next = ORDEM_PRIMARIA[wrapIndex((i < 0 ? 0 : i) + step, ORDEM_PRIMARIA.length)];
    setPage(next === "system" ? lastSystemPage : next);
  };

  const cycleSystem = (dir) => {
    if (primariaDaPagina(activePage) !== "system") {
      cyclePrimary(dir);
      return;
    }
    const step = dir < 0 ? -1 : 1;
    const vis = ORDEM_SISTEMA.filter((id) => pages.some((el) => el.dataset.menuPage === id));
    if (!vis.length) return;
    const i = vis.indexOf(activePage);
    setPage(vis[wrapIndex((i < 0 ? 0 : i) + step, vis.length)]);
  };

  const open = (page) => {
    if (page) {
      if (page === "system") page = lastSystemPage;
      activePage = page;
      if (PAGINAS_SISTEMA.has(activePage)) lastSystemPage = activePage;
    }
    isOpen = true;
    syncDom();
    notify();
  };

  const close = () => {
    if (!isOpen) return;
    isOpen = false;
    document.body.classList.remove("game-menu-open");
    syncDom();
    notify();
  };

  const toggle = (page) => {
    if (!isOpen) {
      open(page);
      return;
    }
    if (!page) {
      close();
      return;
    }
    if (page === "system") {
      if (primariaDaPagina(activePage) === "system") close();
      else setPage("settings");
      return;
    }
    if (page !== activePage) setPage(page);
    else close();
  };

  for (const tab of primaryTabs) {
    tab.addEventListener("click", () => {
      const id = tab.dataset.menuPrimary;
      if (id === "system") {
        if (primariaDaPagina(activePage) === "system") return;
        setPage("settings");
      } else setPage(id);
    });
  }
  for (const tab of systemTabs) {
    tab.addEventListener("click", () => setPage(tab.dataset.menuSystem));
  }
  closeBtn?.addEventListener("click", close);

  syncDom();

  return {
    open,
    close,
    toggle,
    setPage,
    isOpen: () => isOpen,
    page: () => activePage,
    primaryPage: () => primariaDaPagina(activePage),
    cyclePrimary,
    cycleSystem,
    syncMoney: syncDom,
  };
}
